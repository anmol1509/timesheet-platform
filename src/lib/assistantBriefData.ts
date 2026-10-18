import { prisma } from "@/lib/db";
import { branchWhere } from "@/lib/branch";
import { can } from "@/lib/permissions";
import { getRenewals } from "@/lib/renewals";
import { approvalBlockers, wpsGaps } from "@/lib/assistantDiagnose";
import type { ToolContext } from "@/lib/assistantTools";
import type { BriefFacts } from "@/lib/assistantBrief";

/** Gathers the figures behind the brief. Each block runs only if the person may view that part of the app. */
export async function loadBriefFacts(ctx: ToolContext): Promise<BriefFacts> {
  const where = branchWhere(ctx.branchId);
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const facts: BriefFacts = {};

  const jobs: Promise<void>[] = [];
  if (can(ctx.subject, "workforce", "view")) {
    jobs.push(getRenewals(ctx.branchId, 30).then((items) => {
      facts.renewals = { expired: items.filter((i) => i.days < 0).length, within7: items.filter((i) => i.days >= 0 && i.days <= 7).length, within30: items.filter((i) => i.days >= 0).length };
    }));
  }
  if (can(ctx.subject, "workforce", "view")) {
    jobs.push(prisma.employee.count({ where: { ...where, active: true, photoMimeType: null } }).then((n) => { facts.noPhoto = n; }));
  }
  if (can(ctx.subject, "payroll", "view")) {
    jobs.push(prisma.payrollRun.findMany({
      where: { ...where, status: "DRAFT" },
      include: { company: { select: { name: true } }, branch: { select: { payrollApprovalThreshold: true } }, lines: { select: { net: true, paymentMode: true, personCode: true, routingCode: true, account: true, employee: { select: { name: true } } } } },
      orderBy: { createdAt: "desc" },
      take: 3,
    }).then((runs) => {
      facts.payrollRuns = runs.map((r) => {
        const bankGaps = r.lines.map((l) => ({ name: l.employee.name, gaps: wpsGaps({ paymentMode: l.paymentMode, personCode: l.personCode, routingCode: l.routingCode, account: l.account }) })).filter((x) => x.gaps.length > 0);
        const total = r.lines.reduce((sum, l) => sum + Number(l.net), 0);
        const threshold = r.branch.payrollApprovalThreshold ? Number(r.branch.payrollApprovalThreshold) : null;
        return { id: r.id, name: `${r.company?.name ?? "Payroll"} ${r.month}`, blockers: approvalBlockers({ status: r.status, submitted: !!r.submittedAt, lineCount: r.lines.length, total, threshold, bankGaps }) };
      });
    }));
  }
  if (can(ctx.subject, "billing", "view")) {
    jobs.push(prisma.clientInvoice.aggregate({
      where: { ...where, OR: [{ status: "OVERDUE" }, { status: "SENT", dueDate: { lt: today } }] },
      _count: { _all: true }, _sum: { totalAmount: true },
    }).then((a) => { facts.overdue = { count: a._count._all, total: a._sum.totalAmount ?? 0 }; }));
    jobs.push(prisma.timesheetEntry.groupBy({ by: ["clientId", "month"], where: { ...where, status: "CLIENT_APPROVED" }, _sum: { invoiceValue: true } })
      .then((g) => { facts.notInvoiced = { total: g.reduce((a, x) => a + (x._sum.invoiceValue ?? 0), 0), groups: g.length }; }));
  }
  if (can(ctx.subject, "timesheets", "view")) {
    jobs.push(prisma.attendance.count({ where: { ...where, date: today, status: "ABSENT" } }).then((n) => { facts.absentToday = n; }));
  }
  await Promise.all(jobs);
  return facts;
}
