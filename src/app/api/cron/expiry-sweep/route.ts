import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getRenewals, summarise } from "@/lib/renewals";
import { notifyUsers } from "@/lib/notifications/notify";
import { getExpiryDigestRecipients, sendWhatsAppMessage } from "@/lib/notifications/whatsapp";

/**
 * Daily sweep for documents falling due.
 *
 * Until now nothing in the app ran on a schedule: expiry was only ever
 * computed when somebody happened to open a page, so a passport lapsing while
 * the PRO was on leave went unnoticed. This runs per branch and returns a
 * digest.
 *
 * Delivery is via WhatsApp (Twilio) once TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN/
 * TWILIO_WHATSAPP_FROM/EXPIRY_DIGEST_WHATSAPP_TO are set in the environment —
 * see src/lib/notifications/whatsapp.ts. Without those, sendWhatsAppMessage
 * no-ops and this still returns the JSON digest, same as before.
 */

function formatDigestMessage(branchName: string, counts: ReturnType<typeof summarise>, top: { subject: string; document: string; days: number }[]) {
  const lines = [
    `*Expiry sweep — ${branchName}*`,
    `Expired: ${counts.expired} · Within 7d: ${counts.urgent} · Within 30d: ${counts.soon}`,
    "",
    ...top.slice(0, 10).map((i) => {
      const runway = i.days < 0 ? `${Math.abs(i.days)}d overdue` : `${i.days}d left`;
      return `• ${i.subject} — ${i.document} (${runway})`;
    }),
  ];
  if (top.length > 10) lines.push(`…and ${top.length - 10} more.`);
  return lines.join("\n");
}
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. Without the secret
  // set this endpoint stays closed rather than silently public.
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Not authorised." }, { status: 401 });
  }

  const branches = await prisma.branch.findMany({
    where: { isActive: true },
    select: { id: true, code: true, name: true },
  });

  const recipients = getExpiryDigestRecipients();

  const digest = [];
  for (const branch of branches) {
    const items = await getRenewals(branch.id);
    const counts = summarise(items);
    const actionable = items.filter((i) => i.tier !== "horizon");

    const top = actionable.slice(0, 20).map((i) => ({
      subject: `${i.subjectName} (${i.subjectRef})`,
      kind: i.kind,
      document: i.document,
      days: i.days,
      expiry: i.expiry.slice(0, 10),
    }));

    digest.push({ branch: branch.code, counts, top });

    // Left in the server log so a run is traceable even before delivery is configured.
    console.info(
      `[expiry-sweep] ${branch.code}: ${counts.expired} expired, ${counts.urgent} within 7d, ${counts.soon} within 30d, ${counts.planned} within 60d, ${counts.horizon} within 90d`
    );

    // Nothing due beyond the 90-day horizon means nothing worth a message.
    if (actionable.length === 0) continue;

    // In-app + (opted-in) email/WhatsApp digest for the admins who own this
    // branch, once per day even if the cron is retried.
    const title = `Expiry digest — ${branch.name}`;
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const [admins, already] = await Promise.all([
      prisma.user.findMany({
        where: { isActive: true, OR: [{ role: "SUPER_ADMIN" }, { role: "BRANCH_ADMIN", branchId: branch.id }] },
        select: { id: true },
      }),
      prisma.notification.findMany({ where: { kind: "EXPIRY_DIGEST", title, createdAt: { gte: startOfDay } }, select: { userId: true } }),
    ]);
    const done = new Set(already.map((a) => a.userId));
    await notifyUsers({
      userIds: admins.map((a) => a.id).filter((id) => !done.has(id)),
      kind: "EXPIRY_DIGEST",
      title,
      body: `${counts.expired} expired · ${counts.urgent} within 7 days · ${counts.soon} within 30 days.`,
      href: "/employees/renewals",
    });

    if (recipients.length === 0) continue;

    const message = formatDigestMessage(branch.name, counts, top);
    for (const to of recipients) {
      const result = await sendWhatsAppMessage(to, message);
      if (!result.sent) {
        console.warn(`[expiry-sweep] WhatsApp not delivered to ${to}: ${result.reason}`);
      }
    }
  }

  // Asset maintenance falling due in the next 7 days -> that branch's admins, once a day.
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const inAWeek = new Date(today.getTime() + 7 * 86_400_000);
  for (const branch of branches) {
    const due = await prisma.assetMaintenance.findMany({
      where: { nextDueDate: { gte: today, lte: inAWeek }, asset: { branchId: branch.id, status: "ACTIVE" } },
      select: { nextDueDate: true, description: true, asset: { select: { code: true, name: true } } },
      orderBy: { nextDueDate: "asc" },
    });
    if (due.length === 0) continue;
    const title = `Asset maintenance due — ${branch.name}`;
    const [admins, already] = await Promise.all([
      prisma.user.findMany({ where: { isActive: true, OR: [{ role: "SUPER_ADMIN" }, { role: "BRANCH_ADMIN", branchId: branch.id }] }, select: { id: true } }),
      prisma.notification.findMany({ where: { kind: "ASSET_MAINTENANCE", title, createdAt: { gte: today } }, select: { userId: true } }),
    ]);
    const done = new Set(already.map((a) => a.userId));
    await notifyUsers({
      userIds: admins.map((a) => a.id).filter((id) => !done.has(id)),
      kind: "ASSET_MAINTENANCE",
      title,
      body: due.slice(0, 5).map((d) => `${d.asset.code} ${d.asset.name}: ${d.description} (${d.nextDueDate!.toISOString().slice(0, 10)})`).join("; ") + (due.length > 5 ? `; +${due.length - 5} more` : ""),
      href: "/assets",
    });
  }

  return NextResponse.json({ ranAt: new Date().toISOString(), digest });
}
