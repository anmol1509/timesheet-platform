import { prisma } from "@/lib/db";
import { notifyUsers } from "@/lib/notifications/notify";
import { sendEmail } from "@/lib/notifications/email";
import { resolveSuperAdminBranchId } from "@/lib/auth";
import { topUpPriceLabel, creditStatus, creditsFor, monthKey, monthRange, OUT_OF_CREDITS, warningDue, type CreditStatus } from "@/lib/aiCredits";

/** The branch an AI call is charged to: the user's own, or for a super admin the one they are working in. */
export async function aiBranchOf(user: { role: string; branchId: string | null }): Promise<string | null> {
  return user.role === "SUPER_ADMIN" ? await resolveSuperAdminBranchId().catch(() => null) : user.branchId;
}

/** Where a branch stands this month: the allowance, what was granted on top, what has been used. */
export async function loadCreditStatus(branchId: string, now: Date = new Date()): Promise<CreditStatus> {
  const { start, end } = monthRange(monthKey(now));
  const [branch, grants, used] = await Promise.all([
    prisma.branch.findUnique({ where: { id: branchId }, select: { aiMonthlyCredits: true } }),
    prisma.aiCreditGrant.aggregate({ where: { branchId, grantedAt: { gte: start, lt: end } }, _sum: { credits: true } }),
    prisma.aiUsage.aggregate({ where: { branchId, createdAt: { gte: start, lt: end } }, _sum: { credits: true } }),
  ]);
  return creditStatus({ allowance: branch?.aiMonthlyCredits ?? 0, granted: grants._sum.credits ?? 0, used: used._sum.credits ?? 0, now });
}

/**
 * Asked before an AI call: null when there are credits left, otherwise the message to show. A call with no branch to charge
 * (a super admin who hasn't picked one) is let through and isn't counted.
 */
export async function aiGate(branchId: string | null | undefined): Promise<string | null> {
  if (!branchId) return null;
  try {
    const s = await loadCreditStatus(branchId);
    return s.level === "out" ? OUT_OF_CREDITS : null;
  } catch (e) {
    // Never stop the work because the meter failed.
    console.error("[ai-credits] gate failed:", e instanceof Error ? e.message : e);
    return null;
  }
}

/** What the API reports for a call. Cached input is priced differently, so it is folded into an equivalent amount of ordinary input. */
type Usage = { input_tokens?: number | null; output_tokens?: number | null; cache_creation_input_tokens?: number | null; cache_read_input_tokens?: number | null } | null | undefined;

/** Written after an AI call: what it used, then, the first time the month crosses 80% or 100%, a message to the admins. Never throws. */
export async function recordAiUsage(input: { branchId: string | null | undefined; userId?: string | null; feature: string; model: string; usage: Usage }): Promise<void> {
  if (!input.branchId) return;
  try {
    const inputTokens = Math.round((input.usage?.input_tokens ?? 0) + 1.25 * (input.usage?.cache_creation_input_tokens ?? 0) + 0.1 * (input.usage?.cache_read_input_tokens ?? 0));
    const outputTokens = input.usage?.output_tokens ?? 0;
    const credits = creditsFor(input.model, inputTokens, outputTokens);
    await prisma.aiUsage.create({ data: { branchId: input.branchId, userId: input.userId ?? null, feature: input.feature, model: input.model, inputTokens, outputTokens, credits } });
    const status = await loadCreditStatus(input.branchId);
    const branch = await prisma.branch.findUnique({ where: { id: input.branchId }, select: { name: true, aiWarnedMonth: true, aiWarnedLevel: true } });
    if (!branch) return;
    const due = warningDue(status, { month: branch.aiWarnedMonth, level: branch.aiWarnedLevel });
    if (!due) return;
    await prisma.branch.update({ where: { id: input.branchId }, data: { aiWarnedMonth: status.month, aiWarnedLevel: due } });
    const admins = await prisma.user.findMany({ where: { isActive: true, role: "BRANCH_ADMIN", branchId: input.branchId }, select: { id: true } });
    await notifyUsers({
      userIds: admins.map((a) => a.id),
      kind: "AI_CREDITS",
      title: due === 100 ? `${branch.name}: AI credits are used up` : `${branch.name}: 80% of this month's AI credits are used`,
      body: due === 100 ? "AI features are paused until the credits reset or more are added. Everything can still be done by hand." : `${Math.round(status.remaining)} credits are left this month.`,
      href: "/settings/ai",
    });
  } catch (e) {
    console.error("[ai-credits] record failed:", e instanceof Error ? e.message : e);
  }
}

/** After the total changes, the warnings start again from where the branch now stands, so a later 80% is announced again. */
async function resetWarning(branchId: string) {
  const s = await loadCreditStatus(branchId);
  await prisma.branch.update({ where: { id: branchId }, data: { aiWarnedMonth: s.month, aiWarnedLevel: s.level === "out" ? 100 : s.level === "warn" ? 80 : 0 } });
}

/** A branch's monthly allowance, in credits. */
export async function setBranchAllowance(branchId: string, credits: number): Promise<void> {
  await prisma.branch.update({ where: { id: branchId }, data: { aiMonthlyCredits: credits } });
  await resetWarning(branchId);
}

/** Extra credits for the current month, on top of the allowance. */
export async function grantBranchCredits(branchId: string, credits: number, note: string | null, grantedById: string | null): Promise<void> {
  await prisma.aiCreditGrant.create({ data: { branchId, credits, note, grantedById } });
  await resetWarning(branchId);
}

/** Where a request for more credits is sent. */
const REQUEST_INBOX = process.env.AI_REQUEST_EMAIL || "sales@manpowersync.com";

export const MAX_REQUEST_CREDITS = 1_000_000;

/** A company admin asks for extra credits this month. Saved here, and the owner is told by email. */
export async function createCreditRequest(input: { branchId: string; userId: string; userName: string; credits: number; reason: string | null }): Promise<{ id: string }> {
  const branch = await prisma.branch.findUnique({ where: { id: input.branchId }, select: { name: true, code: true } });
  const row = await prisma.aiCreditRequest.create({ data: { branchId: input.branchId, requestedById: input.userId, requestedByName: input.userName, credits: input.credits, reason: input.reason } });
  const company = branch ? `${branch.name} (${branch.code})` : "A company";
  const n = input.credits.toLocaleString("en-US");
  await sendEmail(
    REQUEST_INBOX,
    `AI credits request: ${company} wants ${n} more`,
    `${input.userName} at ${company} asked for ${n} extra AI credits this month (${topUpPriceLabel(input.credits)}).${input.reason ? `\n\nReason: ${input.reason}` : ""}\n\nApprove or decline it from the customer's page in the owner dashboard.`,
  ).catch(() => undefined);
  return { id: row.id };
}

/** Waiting requests for the given companies (all companies here when none are given), oldest first. */
export async function pendingCreditRequests(branchIds?: string[]) {
  const rows = await prisma.aiCreditRequest.findMany({ where: { status: "PENDING", ...(branchIds ? { branchId: { in: branchIds } } : {}) }, orderBy: { createdAt: "asc" }, take: 50 });
  return rows.map((r) => ({ id: r.id, credits: r.credits, reason: r.reason, by: r.requestedByName, at: r.createdAt.toISOString() }));
}

/** The owner's answer. Approving adds the credits for this month; either way the company's admins are told. */
export async function decideCreditRequest(requestId: string, decision: "APPROVED" | "DECLINED", note: string | null, decidedById: string | null): Promise<{ ok: true } | { error: string }> {
  const req = await prisma.aiCreditRequest.findUnique({ where: { id: requestId } });
  if (!req) return { error: "That request wasn't found." };
  if (req.status !== "PENDING") return { error: `That request was already ${req.status.toLowerCase()}.` };
  // Claimed first, so a double click can't add the credits twice.
  const claimed = await prisma.aiCreditRequest.updateMany({ where: { id: requestId, status: "PENDING" }, data: { status: decision, decidedAt: new Date(), decidedNote: note } });
  if (claimed.count === 0) return { error: "That request was just answered." };
  if (decision === "APPROVED") await grantBranchCredits(req.branchId, req.credits, req.reason ? `Requested: ${req.reason}`.slice(0, 200) : "Requested", decidedById);
  const admins = await prisma.user.findMany({ where: { isActive: true, role: "BRANCH_ADMIN", branchId: req.branchId }, select: { id: true } });
  const n = req.credits.toLocaleString("en-US");
  await notifyUsers({
    userIds: admins.map((a) => a.id),
    kind: "AI_CREDITS",
    title: decision === "APPROVED" ? `${n} extra AI credits were added` : `Your request for ${n} AI credits was declined`,
    body: decision === "APPROVED" ? "They are available now and count for this month only." : note || "You can send a new request from the AI credits page.",
    href: "/settings/ai?tab=requests",
  });
  return { ok: true };
}
