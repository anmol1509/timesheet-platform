import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { approverIds, notifyUsers } from "@/lib/notifications/notify";
import { heldSuppliers } from "@/lib/supplierHold";

export const dynamic = "force-dynamic";

const WAITING_DAYS = 2;
const REMIND_EVERY_DAYS = 3;
const DAY = 86_400_000;

/**
 * Daily reminder for suppliers whose approval is still outstanding while their workers sit idle. Workers from an
 * unapproved supplier can't be mobilised and nothing on the Mobilise or Employees screens says why until someone
 * goes looking, so the people who can approve are told once the wait passes two days, and again every three days
 * until it is decided.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Not authorised." }, { status: 401 });
  }

  const now = Date.now();
  const held = (await heldSuppliers(null)).filter((h) => now - h.oldestWorkerAt.getTime() >= WAITING_DAYS * DAY);
  let notified = 0;
  for (const h of held) {
    const recipients = await approverIds("partners", h.branchId);
    if (recipients.length === 0) continue;
    const title = `${h.name}: ${h.workers} worker${h.workers === 1 ? "" : "s"} waiting for supplier approval`;
    const recent = await prisma.notification.findMany({
      where: { kind: "SUPPLIER_HOLD", title, createdAt: { gte: new Date(now - REMIND_EVERY_DAYS * DAY) }, userId: { in: recipients } },
      select: { userId: true },
    });
    const done = new Set(recent.map((r) => r.userId));
    const toNotify = recipients.filter((id) => !done.has(id));
    if (toNotify.length === 0) continue;
    const need = h.needs[0];
    await notifyUsers({
      userIds: toNotify,
      kind: "SUPPLIER_HOLD",
      title,
      body: `They can't be mobilised until ${h.name} is approved${need ? `, and Request #${need.requestNo} still needs ${need.remaining} ${need.trade}` : ""}.`,
      href: "/approvals?type=SUPPLIER",
    });
    notified += toNotify.length;
  }
  return NextResponse.json({ ranAt: new Date().toISOString(), heldSuppliers: held.length, notified });
}
