"use server";

import { after } from "next/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { sendEmail } from "@/lib/notifications/email";
import { logAudit } from "@/lib/audit";
import {
  MAX_PER_EMAIL_PER_HOUR,
  MAX_PER_IP_PER_HOUR,
  RESET_KIND,
  RESET_TTL_MS,
  emailKey,
  findValidReset,
  hashToken,
  newToken,
} from "@/lib/passwordReset";

type State = { error: string | null; done?: boolean };

/**
 * Asks for a reset link. The answer is always the same whether or not the email
 * belongs to an account, so the form can't be used to find out who has one.
 */
export async function requestPasswordResetAction(_prev: State, formData: FormData): Promise<State> {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) return { error: "Enter the email address you sign in with." };

  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || null;
  const since = new Date(Date.now() - 60 * 60 * 1000);
  const [byEmail, byIp] = await Promise.all([
    prisma.otpChallenge.count({ where: { kind: RESET_KIND, phone: emailKey(email), createdAt: { gt: since } } }),
    ip ? prisma.otpChallenge.count({ where: { kind: RESET_KIND, ip, createdAt: { gt: since } } }) : Promise.resolve(0),
  ]);
  if (byEmail >= MAX_PER_EMAIL_PER_HOUR || byIp >= MAX_PER_IP_PER_HOUR) return { error: null, done: true };

  const user = await prisma.user.findUnique({ where: { email } });
  // Count the attempt for unknown emails too, so the limits can't be used to probe for accounts.
  const token = newToken();
  await prisma.otpChallenge.create({
    data: { kind: RESET_KIND, phone: emailKey(email), codeHash: user?.isActive ? hashToken(token) : "-", ip, expiresAt: new Date(Date.now() + RESET_TTL_MS) },
  });

  if (user?.isActive) {
    const base = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "") || `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
    const link = `${base}/login/reset?token=${token}`;
    // After the response, so a real account and an unknown one answer in the same time.
    after(async () => {
      await sendEmail(
        user.email,
        "Reset your ManpowerSync password",
        `Hi ${user.name},\n\nSomeone asked to reset the password for your ManpowerSync account. Use this link to choose a new one. It works once and expires in 1 hour:\n\n${link}\n\nIf you didn't ask for this, you can ignore this email and your password stays the same.\n`
      );
    });
  }
  return { error: null, done: true };
}

export async function resetPasswordAction(_prev: State, formData: FormData): Promise<State> {
  const token = String(formData.get("token") || "");
  const password = String(formData.get("password") || "");
  const confirm = String(formData.get("confirm") || "");

  const found = await findValidReset(token);
  if (!found) return { error: "This reset link has expired or was already used. Ask for a new one." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  if (password !== confirm) return { error: "The two passwords don't match." };

  const { challenge, user } = found;
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { passwordHash: hashPassword(password) } }),
    prisma.otpChallenge.update({ where: { id: challenge.id }, data: { consumedAt: new Date() } }),
    // Any other outstanding links stop working, and a lock from earlier failed attempts is cleared.
    prisma.otpChallenge.deleteMany({ where: { kind: RESET_KIND, phone: emailKey(user.email), consumedAt: null, NOT: { id: challenge.id } } }),
    prisma.otpChallenge.deleteMany({ where: { kind: "STAFF_LOGIN", phone: emailKey(user.email) } }),
  ]);
  await logAudit({
    entityType: "USER",
    entityId: user.id,
    action: "UPDATE",
    before: { password: "(previous)" },
    after: { password: "(reset by email link)" },
    userId: user.id,
    userName: user.name,
    branchId: user.branchId,
  });
  redirect("/login?reset=1");
}
