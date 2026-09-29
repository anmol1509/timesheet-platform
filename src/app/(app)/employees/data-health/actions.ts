"use server";

import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { isAdminRole } from "@/lib/roles";
import { HEALTH_KEYS, getDataHealth, type HealthKey } from "@/lib/dataHealth";
import { normalizePhone } from "@/lib/phone";
import { isSmsConfigured, sendSms } from "@/lib/notifications/sms";
import { isWhatsAppConfigured, sendWhatsAppMessage } from "@/lib/notifications/whatsapp";

export type RequestOutcome = {
  sent: number;
  failed: number;
  skippedRecent: number;
  noMobile: number;
  /** Neither WhatsApp nor SMS is set up: nothing was sent and nothing was recorded. */
  notConfigured: boolean;
  message: string;
  numbers: string[];
};

const RECENT_DAYS = 7;
const MAX_PER_REQUEST = 300;

/** Ask workers with gaps in their record to fill them in through the worker portal. */
export async function requestProfileCompletionAction(missing: string | null): Promise<RequestOutcome> {
  const { user, branchId } = await requireUserWithBranch();
  const empty: RequestOutcome = { sent: 0, failed: 0, skippedRecent: 0, noMobile: 0, notConfigured: false, message: "", numbers: [] };
  if (!isAdminRole(user.role) || !branchId) return empty;
  const focus = HEALTH_KEYS.includes(missing as HealthKey) ? (missing as HealthKey) : null;

  const [health, branch] = await Promise.all([
    getDataHealth(branchId),
    prisma.branch.findUnique({ where: { id: branchId }, select: { name: true } }),
  ]);
  const targets = health.list.filter((w) => w.score < 100 && (!focus || w.missing.includes(focus)));

  const since = new Date(Date.now() - RECENT_DAYS * 86_400_000);
  const recent = new Set(
    (await prisma.auditLog.findMany({
      where: { entityType: "EMPLOYEE", action: "PROFILE_REQUEST", branchId, createdAt: { gt: since }, entityId: { in: targets.map((t) => t.id) } },
      select: { entityId: true },
    })).map((a) => a.entityId)
  );

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  // The address the admin is on is, by definition, one that serves the worker portal.
  const origin = (host ? `${host.startsWith("localhost") ? "http" : "https"}://${host}` : (process.env.NEXT_PUBLIC_APP_URL ?? "")).replace(/\/$/, "");
  const link = `${origin}/me/login`;
  const text = (name: string) =>
    `Hello ${name}, ${branch?.name ?? "your company"} is updating worker records. Please take 2 minutes to add your missing details: ${link} (sign in with this mobile number).`;

  const out = { ...empty };
  const todo: { id: string; name: string; phone: string }[] = [];
  for (const w of targets) {
    const phone = normalizePhone(w.mobileNumber);
    if (!phone) out.noMobile++;
    else if (recent.has(w.id)) out.skippedRecent++;
    else todo.push({ id: w.id, name: w.name.split(/\s+/)[0], phone });
  }
  const batch = todo.slice(0, MAX_PER_REQUEST);

  if (!isWhatsAppConfigured() && !isSmsConfigured()) {
    return { ...out, notConfigured: batch.length > 0, message: text("{first name}"), numbers: batch.map((b) => b.phone) };
  }

  const done: string[] = [];
  for (let i = 0; i < batch.length; i += 5) {
    await Promise.all(
      batch.slice(i, i + 5).map(async (w) => {
        const body = text(w.name);
        let ok = (await sendWhatsAppMessage(w.phone, body)).sent;
        if (!ok) ok = (await sendSms(w.phone, body)).sent;
        if (ok) { out.sent++; done.push(w.id); } else out.failed++;
      })
    );
  }
  if (done.length > 0) {
    await prisma.auditLog.createMany({
      data: done.map((id) => ({ entityType: "EMPLOYEE", entityId: id, action: "PROFILE_REQUEST", userId: user.id, userName: user.name, branchId })),
    });
  }
  return out;
}
