import { NextResponse } from "next/server";
import { emitWebhookEvent, hasSubscribers, processDue, purgeOldDeliveries } from "@/lib/webhooks/deliver";
import { prisma } from "@/lib/db";
import { getRenewals, summarise } from "@/lib/renewals";
import { notifyUsers } from "@/lib/notifications/notify";

/**
 * Daily sweep for documents falling due.
 *
 * Until now nothing in the app ran on a schedule: expiry was only ever
 * computed when somebody happened to open a page, so a passport lapsing while
 * the PRO was on leave went unnoticed. This runs per branch and returns a
 * digest.
 *
 * Delivery is an in-app notification plus an email to opted-in admins.
 */

export const dynamic = "force-dynamic";

const EXPIRY_EVENT_DAYS = new Set([60, 30, 14, 7, 1, 0]);

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

    // Webhook subscribers hear about each document as it crosses a threshold, once per threshold.
    if (await hasSubscribers(branch.id, "document.expiring")) {
      for (const i of items.filter((x) => EXPIRY_EVENT_DAYS.has(x.days)).slice(0, 300)) {
        await emitWebhookEvent(branch.id, "document.expiring", {
          subject_type: i.kind, subject_id: i.subjectId, subject_ref: i.subjectRef, document: i.document, expiry_date: i.expiry.slice(0, 10), days_remaining: i.days,
        });
      }
    }

    // Left in the server log so a run is traceable even before delivery is configured.
    console.info(
      `[expiry-sweep] ${branch.code}: ${counts.expired} expired, ${counts.urgent} within 7d, ${counts.soon} within 30d, ${counts.planned} within 60d, ${counts.horizon} within 90d`
    );

    // Nothing due beyond the 90-day horizon means nothing worth a message.
    if (actionable.length === 0) continue;

    // In-app + (opted-in) email digest for the admins who own this
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
  }

  // Webhook housekeeping: retry anything still waiting, drop records past the retention period.
  const retried = await processDue({ limit: 200 });
  const purged = await purgeOldDeliveries();

  return NextResponse.json({ ranAt: new Date().toISOString(), digest, webhooks: { retried, purged } });
}
