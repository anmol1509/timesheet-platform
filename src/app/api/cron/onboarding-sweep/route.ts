import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { notifyUsers } from "@/lib/notifications/notify";
import { currentStage, isOverdue } from "@/lib/onboarding";

export const dynamic = "force-dynamic";

/**
 * Daily sweep for candidates stuck past their current stage's typical
 * turnaround (see STAGES[].slaDays) — the automated-reminder half of the
 * "action required today" list that /onboarding already shows, so a
 * candidate isn't only noticed when someone happens to open the dashboard.
 *
 * Notified, in order of preference: the stage's assigned owner
 * (CandidateOnboardingStageTask), else the candidate's assignedHr, else
 * every admin for the branch — mirrors expiry-sweep's dedup-per-day pattern
 * via the Notification table so a retried cron run doesn't double-page.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Not authorised." }, { status: 401 });
  }

  const candidates = await prisma.candidateOnboarding.findMany({
    where: { joined: false },
    include: {
      agency: { select: { name: true } },
      stageTasks: { select: { stage: true, ownerId: true } },
    },
  });

  const overdue = candidates.filter((c) => isOverdue(c, c.updatedAt));
  if (overdue.length === 0) {
    return NextResponse.json({ ranAt: new Date().toISOString(), overdueCount: 0 });
  }

  const branchIds = [...new Set(overdue.map((c) => c.branchId))];
  const admins = await prisma.user.findMany({
    where: { isActive: true, OR: branchIds.map((branchId) => ({ role: "BRANCH_ADMIN" as const, branchId })) },
    select: { id: true, branchId: true },
  });
  const superAdmins = await prisma.user.findMany({ where: { isActive: true, role: "SUPER_ADMIN" }, select: { id: true } });
  const adminsByBranch = new Map<string, string[]>();
  for (const branchId of branchIds) {
    adminsByBranch.set(branchId, [...admins.filter((a) => a.branchId === branchId).map((a) => a.id), ...superAdmins.map((a) => a.id)]);
  }

  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);

  let notified = 0;
  for (const c of overdue) {
    const stage = currentStage(c);
    if (!stage) continue;
    const task = c.stageTasks.find((t) => t.stage === stage.key);
    const recipients = task?.ownerId ? [task.ownerId] : c.assignedHrId ? [c.assignedHrId] : (adminsByBranch.get(c.branchId) ?? []);
    if (recipients.length === 0) continue;

    const title = `Onboarding overdue — ${c.candidateName}`;
    const already = await prisma.notification.findMany({
      where: { kind: "ONBOARDING_OVERDUE", title, createdAt: { gte: startOfDay }, userId: { in: recipients } },
      select: { userId: true },
    });
    const done = new Set(already.map((a) => a.userId));
    const toNotify = recipients.filter((id) => !done.has(id));
    if (toNotify.length === 0) continue;

    await notifyUsers({
      userIds: toNotify,
      kind: "ONBOARDING_OVERDUE",
      title,
      body: `Stuck at ${stage.label} (agency: ${c.agency?.name ?? "none"}) past its typical ${stage.slaDays}-day turnaround.`,
      href: `/onboarding/${c.id}`,
    });
    notified++;
  }

  console.info(`[onboarding-sweep] ${overdue.length} overdue, ${notified} notified`);
  return NextResponse.json({ ranAt: new Date().toISOString(), overdueCount: overdue.length, notified });
}
