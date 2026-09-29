import { prisma } from "@/lib/db";
import { branchWhere } from "@/lib/branch";
import { billTotals } from "@/lib/payables";
import { APPROVAL_KINDS, countByKind, loadApprovals, type ApprovalKind, type ApprovalScope } from "@/lib/approvals";

// Extra dashboard sections. Each one reads only what the person may see, and
// returns null when they may not — the widget then renders nothing.

const num = (d: { toString(): string } | null | undefined) => (d == null ? 0 : Number(d.toString()));
const DAY = 86_400_000;

/** Today's calendar date in Dubai, as the UTC-midnight timestamp attendance rows are stored under. */
export function dubaiToday(now = new Date()): Date {
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  return new Date(`${ymd}T00:00:00.000Z`);
}

// ---------------------------------------------------------------- money

export type MoneySnapshot = {
  /** Which halves this person may see: client invoices (Billing) and supplier bills (Finance). */
  scope: { invoices: boolean; bills: boolean };
  invoicedThisMonth: number;
  invoicedCount: number;
  outstanding: number;
  outstandingCount: number;
  overdue: number;
  overdueCount: number;
  billsDueSoon: { count: number; amount: number };
  billsOverdue: { count: number; amount: number };
  owedToSuppliers: number;
};

export async function getMoneySnapshot(branchId: string | null, scope: { invoices: boolean; bills: boolean }): Promise<MoneySnapshot> {
  const bw = branchWhere(branchId);
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const none = { _sum: { totalAmount: null as number | null }, _count: { _all: 0 } };
  const [issued, open, overdue, bills] = await Promise.all([
    scope.invoices ? prisma.clientInvoice.aggregate({ where: { ...bw, status: { not: "DRAFT" }, issueDate: { gte: monthStart } }, _sum: { totalAmount: true }, _count: { _all: true } }) : none,
    scope.invoices ? prisma.clientInvoice.aggregate({ where: { ...bw, status: { in: ["SENT", "OVERDUE"] } }, _sum: { totalAmount: true }, _count: { _all: true } }) : none,
    scope.invoices ? prisma.clientInvoice.aggregate({ where: { ...bw, status: "OVERDUE" }, _sum: { totalAmount: true }, _count: { _all: true } }) : none,
    scope.bills
      ? prisma.supplierBill.findMany({
          where: { ...bw, approvalStatus: "APPROVED" },
          select: { amount: true, vatAmount: true, dueDate: true, payments: { select: { amount: true } } },
        })
      : [],
  ]);

  const dueSoon = { count: 0, amount: 0 };
  const late = { count: 0, amount: 0 };
  let owed = 0;
  for (const b of bills) {
    const t = billTotals({ amount: num(b.amount), vatAmount: num(b.vatAmount) }, b.payments.map((p) => ({ amount: num(p.amount) })));
    if (t.balance <= 0) continue;
    owed += t.balance;
    const days = (b.dueDate.getTime() - now.getTime()) / DAY;
    if (days < 0) { late.count++; late.amount += t.balance; }
    else if (days <= 7) { dueSoon.count++; dueSoon.amount += t.balance; }
  }
  return {
    scope,
    invoicedThisMonth: issued._sum.totalAmount ?? 0,
    invoicedCount: issued._count._all,
    outstanding: open._sum.totalAmount ?? 0,
    outstandingCount: open._count._all,
    overdue: overdue._sum.totalAmount ?? 0,
    overdueCount: overdue._count._all,
    billsDueSoon: dueSoon,
    billsOverdue: late,
    owedToSuppliers: owed,
  };
}

// --------------------------------------------------------------- demand

export type DemandFill = {
  openRequests: number;
  needed: number;
  filled: number;
  shortRequests: number;
  /** Trades still short, biggest gap first, with how many people are on the bench for each. */
  gaps: { trade: string; short: number; bench: number }[];
};

export async function getDemandFill(branchId: string | null): Promise<DemandFill> {
  const bw = branchWhere(branchId);
  const [requests, benchRows] = await Promise.all([
    prisma.demandRequest.findMany({
      where: { ...bw, status: { in: ["Open", "Approved"] } },
      select: { trades: { select: { trade: true, quantity: true, approvedQuantity: true, _count: { select: { allocations: true } } } } },
    }),
    prisma.employee.groupBy({
      by: ["trade"],
      where: { ...bw, active: true, projectId: null, status: { notIn: ["TERMINATED", "ON_VACATION"] }, trade: { not: null } },
      _count: { _all: true },
    }),
  ]);
  const key = (t: string | null) => (t ?? "").trim().toLowerCase();
  const bench = new Map(benchRows.map((r) => [key(r.trade), r._count._all]));
  const shortBy = new Map<string, { trade: string; short: number }>();
  let needed = 0, filled = 0, shortRequests = 0;
  for (const r of requests) {
    let requestShort = false;
    for (const t of r.trades) {
      const want = t.approvedQuantity ?? t.quantity;
      const have = Math.min(want, t._count.allocations);
      needed += want;
      filled += have;
      if (want > have) {
        requestShort = true;
        const cur = shortBy.get(key(t.trade)) ?? { trade: t.trade, short: 0 };
        cur.short += want - have;
        shortBy.set(key(t.trade), cur);
      }
    }
    if (requestShort) shortRequests++;
  }
  const gaps = [...shortBy.entries()]
    .map(([k, v]) => ({ trade: v.trade, short: v.short, bench: bench.get(k) ?? 0 }))
    .sort((a, b) => b.short - a.short)
    .slice(0, 5);
  return { openRequests: requests.length, needed, filled, shortRequests, gaps };
}

// ----------------------------------------------------------- attendance

export type AttendanceToday = {
  expected: number;
  present: number;
  absent: number;
  offOrLeave: number;
  unmarked: number;
  /** Projects with people not yet marked, most first. */
  byProject: { projectId: string; name: string; unmarked: number; expected: number }[];
};

export async function getAttendanceToday(branchId: string | null): Promise<AttendanceToday> {
  const bw = branchWhere(branchId);
  const today = dubaiToday();
  const [workers, marks] = await Promise.all([
    prisma.employee.findMany({
      where: { ...bw, active: true, projectId: { not: null }, status: { notIn: ["TERMINATED", "ON_VACATION"] } },
      select: { id: true, projectId: true, project: { select: { name: true } } },
    }),
    prisma.attendance.findMany({ where: { ...bw, date: today }, select: { employeeId: true, status: true } }),
  ]);
  const markOf = new Map(marks.map((m) => [m.employeeId, m.status]));
  const out: AttendanceToday = { expected: workers.length, present: 0, absent: 0, offOrLeave: 0, unmarked: 0, byProject: [] };
  const per = new Map<string, { projectId: string; name: string; unmarked: number; expected: number }>();
  for (const w of workers) {
    const s = markOf.get(w.id);
    const p = per.get(w.projectId!) ?? { projectId: w.projectId!, name: w.project?.name ?? "Project", unmarked: 0, expected: 0 };
    p.expected++;
    if (!s) { out.unmarked++; p.unmarked++; }
    else if (s === "PRESENT") out.present++;
    else if (s === "ABSENT") out.absent++;
    else out.offOrLeave++;
    per.set(w.projectId!, p);
  }
  out.byProject = [...per.values()].filter((p) => p.unmarked > 0).sort((a, b) => b.unmarked - a.unmarked).slice(0, 5);
  return out;
}

// -------------------------------------------------------------- payroll

export type PayrollStatus = {
  month: string;
  status: string;
  submitted: boolean;
  workers: number;
  netTotal: number;
  runId: string;
  /** Whether a run exists for the current calendar month. */
  hasCurrentMonth: boolean;
} | null;

export async function getPayrollStatus(branchId: string | null): Promise<PayrollStatus> {
  const bw = branchWhere(branchId);
  const run = await prisma.payrollRun.findFirst({
    where: bw,
    orderBy: { month: "desc" },
    select: { id: true, month: true, status: true, submittedAt: true, _count: { select: { lines: true } } },
  });
  if (!run) return null;
  const sum = await prisma.payrollLine.aggregate({ where: { runId: run.id }, _sum: { net: true } });
  const now = new Date();
  const current = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  return { month: run.month, status: run.status, submitted: !!run.submittedAt, workers: run._count.lines, netTotal: num(sum._sum.net), runId: run.id, hasCurrentMonth: run.month === current };
}

// ------------------------------------------------------------ approvals

export type ApprovalsSummary = {
  total: number;
  oldestDays: number;
  byKind: { kind: ApprovalKind; label: string; count: number }[];
};

export async function getApprovalsSummary(scope: ApprovalScope): Promise<ApprovalsSummary> {
  const items = await loadApprovals(scope);
  const counts = countByKind(items);
  const oldest = items.reduce((min, i) => Math.min(min, i.at.getTime()), Date.now());
  return {
    total: items.length,
    oldestDays: items.length ? Math.floor((Date.now() - oldest) / DAY) : 0,
    byKind: APPROVAL_KINDS.map((k) => ({ kind: k.kind, label: k.label, count: counts[k.kind] })).filter((k) => k.count > 0).sort((a, b) => b.count - a.count),
  };
}
