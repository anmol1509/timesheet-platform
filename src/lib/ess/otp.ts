import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db";
import { normalizePhone, phoneTail } from "@/lib/phone";
import { isSmsConfigured, sendSms } from "@/lib/notifications/sms";
import { sendWhatsAppMessage } from "@/lib/notifications/whatsapp";
import { demoCodeMatches, isDemoPhone, isDemoPrincipal } from "@/lib/ess/demoLogin";

const CODE_TTL_MS = 10 * 60_000;
const RESEND_COOLDOWN_MS = 45_000;
const MAX_PER_PHONE_PER_HOUR = 5;
const MAX_PER_IP_PER_HOUR = 20;
const MAX_ATTEMPTS = 5;

const hash = (code: string, phone: string) =>
  createHmac("sha256", process.env.SESSION_SECRET ?? "").update(`${phone}:${code}`).digest("hex");

export type OtpKind = "EMPLOYEE" | "SUPPLIER";

/** Suppliers (portal enabled) whose contact, secondary or coordinator number equals this E.164 number. */
async function suppliersForPhone(e164: string) {
  const tail = phoneTail(e164);
  const rows = await prisma.$queryRaw<{ id: string; contactPhone: string | null; phone: string | null; coordinatorPhone: string | null }[]>`
    SELECT id, "contactPhone", phone, "coordinatorPhone" FROM "Supplier"
    WHERE "portalEnabled" = true
      AND (regexp_replace(coalesce("contactPhone", ''), '\\D', '', 'g') LIKE ${"%" + tail}
        OR regexp_replace(coalesce(phone, ''), '\\D', '', 'g') LIKE ${"%" + tail}
        OR regexp_replace(coalesce("coordinatorPhone", ''), '\\D', '', 'g') LIKE ${"%" + tail})`;
  return rows.filter((r) => [r.contactPhone, r.phone, r.coordinatorPhone].some((n) => normalizePhone(n) === e164));
}

/** Employees whose recorded mobile or WhatsApp number equals this E.164 number. */
async function employeesForPhone(e164: string) {
  const tail = phoneTail(e164);
  const rows = await prisma.$queryRaw<{ id: string; mobileNumber: string | null; whatsappNumber: string | null }[]>`
    SELECT id, "mobileNumber", "whatsappNumber" FROM "Employee"
    WHERE "essEnabled" = true AND status <> 'TERMINATED'
      AND (regexp_replace(coalesce("mobileNumber", ''), '\\D', '', 'g') LIKE ${"%" + tail}
        OR regexp_replace(coalesce("whatsappNumber", ''), '\\D', '', 'g') LIKE ${"%" + tail})`;
  return rows.filter((r) => normalizePhone(r.mobileNumber) === e164 || normalizePhone(r.whatsappNumber) === e164);
}

export type RequestResult = { ok: true } | { ok: false; error: string };

/**
 * Starts a sign-in. Always answers the same way whether or not the number
 * belongs to an employee, so the form can't be used to discover who works here.
 */
export async function requestOtp(rawPhone: string, ip: string | null, kind: OtpKind = "EMPLOYEE"): Promise<RequestResult> {
  const phone = normalizePhone(rawPhone);
  if (!phone) return { ok: false, error: "Enter your mobile number with country code, e.g. +971 50 123 4567." };

  const hourAgo = new Date(Date.now() - 3_600_000);
  const [byPhone, byIp, last] = await Promise.all([
    prisma.otpChallenge.count({ where: { phone, createdAt: { gte: hourAgo } } }),
    ip ? prisma.otpChallenge.count({ where: { ip, createdAt: { gte: hourAgo } } }) : Promise.resolve(0),
    prisma.otpChallenge.findFirst({ where: { phone }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
  ]);
  if (last && Date.now() - last.createdAt.getTime() < RESEND_COOLDOWN_MS) {
    return { ok: false, error: "A code was just sent. Wait a moment before asking for another." };
  }
  if (byPhone >= MAX_PER_PHONE_PER_HOUR || byIp >= MAX_PER_IP_PER_HOUR) {
    return { ok: false, error: "Too many attempts. Try again in an hour." };
  }

  const matches = kind === "SUPPLIER" ? await suppliersForPhone(phone) : await employeesForPhone(phone);
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  // Record the attempt even for unknown numbers, so the limits above apply equally.
  await prisma.otpChallenge.create({
    data: {
      phone,
      codeHash: hash(code, phone),
      ip,
      expiresAt: new Date(Date.now() + CODE_TTL_MS),
      kind,
      // Only a number that maps to exactly one person/company can ever be verified.
      employeeId: kind === "EMPLOYEE" && matches.length === 1 ? matches[0].id : null,
      supplierId: kind === "SUPPLIER" && matches.length === 1 ? matches[0].id : null,
    },
  });

  // The demo number is a placeholder: never send a message to it. Demo sign-in
  // (see demoLogin.ts) needs only the challenge recorded above.
  if (isDemoPhone(phone)) return { ok: true };

  if (matches.length === 1) {
    const text = `${code} is your Burj Al Aweer ${kind === "SUPPLIER" ? "supplier portal " : ""}sign-in code. It expires in 10 minutes. Don't share it with anyone.`;
    const channel = process.env.OTP_CHANNEL ?? (isSmsConfigured() ? "sms" : "whatsapp");
    const result = channel === "whatsapp" ? await sendWhatsAppMessage(phone, text) : await sendSms(phone, text);
    if (!result.sent) {
      console.warn(`[ess-otp] code not delivered (${result.reason}).`);
      // Development convenience only — never in production.
      if (process.env.NODE_ENV !== "production") console.warn(`[ess-otp] DEV code for ${phone}: ${code}`);
    }
  } else if (matches.length > 1) {
    console.warn(`[ess-otp] ${matches.length} ${kind.toLowerCase()} records share ${phone}; no code sent.`);
  }
  return { ok: true };
}

export type VerifyResult = { ok: true; id: string } | { ok: false; error: string };

export async function verifyOtp(rawPhone: string, rawCode: string, kind: OtpKind = "EMPLOYEE"): Promise<VerifyResult> {
  const generic = { ok: false as const, error: "That code isn't right, or it has expired. Request a new one." };
  const phone = normalizePhone(rawPhone);
  const code = rawCode.replace(/\D/g, "");
  if (!phone || code.length !== 6) return generic;

  const challenge = await prisma.otpChallenge.findFirst({
    where: { phone, kind, consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!challenge || challenge.attempts >= MAX_ATTEMPTS) return generic;

  // Count the attempt first so parallel guesses can't outrun the limit.
  await prisma.otpChallenge.update({ where: { id: challenge.id }, data: { attempts: { increment: 1 } } });
  const principalId = kind === "SUPPLIER" ? challenge.supplierId : challenge.employeeId;
  // Demo sign-in: the fixed code, only for the demo number, only for a record marked as demo.
  const demo = isDemoPhone(phone) && demoCodeMatches(code);
  if (demo) {
    if (!principalId || !(await isDemoPrincipal(kind, principalId))) return generic;
  } else {
    const a = Buffer.from(hash(code, phone), "hex");
    const b = Buffer.from(challenge.codeHash, "hex");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return generic;
    if (!principalId) return generic;
  }

  const consumed = await prisma.otpChallenge.updateMany({ where: { id: challenge.id, consumedAt: null }, data: { consumedAt: new Date() } });
  if (consumed.count !== 1) return generic;
  return { ok: true, id: principalId };
}
