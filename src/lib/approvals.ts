import { prisma } from "@/lib/db";
import { branchWhere } from "@/lib/branch";
import { can, type PermissionSubject } from "@/lib/permissions";
import { billVariance, exceedsApprovalLimit } from "@/lib/financeRules";

/**
 * Everything waiting for a decision, in one shape. The approvals inbox is built
 * on this: each kind knows how to find its pending items and which permission
 * lets someone decide them, and the page never needs to know how any of the
 * underlying modules work.
 */
export type ApprovalKind = "EXPENSE" | "BILL" | "PAYROLL" | "WORKER" | "CHANGE" | "SUPPLIER" | "DEMAND" | "TIMESHEET" | "CORRECTION";

export const APPROVAL_KINDS: { kind: ApprovalKind; label: string; module: string; action: "approve" | "edit" }[] = [
  { kind: "EXPENSE", label: "Expenses", module: "finance", action: "approve" },
  { kind: "BILL", label: "Supplier bills", module: "finance", action: "approve" },
  { kind: "PAYROLL", label: "Payroll runs", module: "payroll", action: "approve" },
  { kind: "WORKER", label: "New workers", module: "partners", action: "edit" },
  { kind: "CHANGE", label: "Supplier detail changes", module: "partners", action: "edit" },
  { kind: "SUPPLIER", label: "Supplier approvals", module: "partners", action: "approve" },
  { kind: "DEMAND", label: "Demand quantities", module: "demand", action: "approve" },
  { kind: "TIMESHEET", label: "Timesheets", module: "timesheets", action: "approve" },
  { kind: "CORRECTION", label: "Attendance corrections", module: "timesheets", action: "approve" },
];

export const kindLabel = (k: ApprovalKind) => APPROVAL_KINDS.find((x) => x.kind === k)!.label;

/** The kinds this person may decide. Super admins and branch admins may decide everything in scope. */
export function allowedKinds(subject: PermissionSubject): ApprovalKind[] {
  return APPROVAL_KINDS.filter((k) => can(subject, k.module, k.action)).map((k) => k.kind);
}

export type Chip = { text: string; tone: "warning" | "danger" | "success" | "info" | "neutral" };

export type ApprovalItem = {
  key: string;
  kind: ApprovalKind;
  id: string; // the record the decision is applied to (for TIMESHEET/DEMAND: see `ids`)
  ids?: string[]; // grouped kinds decide several rows together
  field?: string; // SUPPLIER: which approval flag
  title: string;
  subtitle: string;
  requester: string | null;
  at: Date;
  amount: number | null;
  branch: string | null;
  href: string; // where to look at the thing in full
  chips: Chip[];
  /** How the inbox decides it: inline buttons, or only a link to review it. */
  inline: boolean;
  /** Rejecting needs a reason the requester can see. */
  rejectNeedsReason: boolean;
  /** Approving deserves a confirmation (money moves, or it is hard to undo). */
  confirmApprove: boolean;
};

export type ApprovalScope = { branchId: string | null; isSuperAdmin: boolean; subject: PermissionSubject; role: string };

const num = (d: { toString(): string } | null | undefined) => (d == null ? 0 : Number(d.toString()));
const LIMIT = 200;
const SUPPLIER_FLAGS = [
  ["approvalStatus", "Supplier"],
  ["labourApprovalStatus", "Labour"],
  ["invoiceApprovalStatus", "Invoicing"],
] as const;

/** Every pending item across the modules this person can decide, oldest first. */
export async function loadApprovals(scope: ApprovalScope, only?: ApprovalKind[]): Promise<ApprovalItem[]> {
  const allowed = allowedKinds(scope.subject).filter((k) => !only || only.includes(k));
  const has = (k: ApprovalKind) => allowed.includes(k);
  const bw = branchWhere(scope.branchId);
  const multiBranch = scope.isSuperAdmin && !scope.branchId;
  const branchTag = (code: string | null | undefined) => (multiBranch ? code ?? null : null);
  const out: ApprovalItem[] = [];

  if (has("EXPENSE")) {
    const [rows, rule] = await Promise.all([
      prisma.expense.findMany({ where: { ...bw, status: "PENDING" }, orderBy: { createdAt: "asc" }, take: LIMIT, include: { submittedBy: { select: { name: true } }, project: { select: { name: true } }, branch: { select: { code: true } } } }),
      scope.branchId ? prisma.branch.findUnique({ where: { id: scope.branchId }, select: { expenseApprovalLimit: true } }) : null,
    ]);
    const limit = rule?.expenseApprovalLimit ? num(rule.expenseApprovalLimit) : null;
    for (const e of rows) {
      const total = num(e.amount) + num(e.vatAmount);
      const chips: Chip[] = [];
      if (e.outOfPocket) chips.push({ text: "Out of pocket", tone: "info" });
      if (exceedsApprovalLimit(total, limit, scope.role)) chips.push({ text: "Over your approval limit", tone: "danger" });
      out.push({
        key: `EXPENSE:${e.id}`, kind: "EXPENSE", id: e.id, title: `${e.category} — ${e.description}`, subtitle: [e.paidTo && `to ${e.paidTo}`, e.project?.name, e.paymentMethod?.toLowerCase()].filter(Boolean).join(" · ") || "No details",
        requester: e.submittedBy.name, at: e.createdAt, amount: total, branch: branchTag(e.branch.code), href: "/finance/expenses?status=PENDING", chips, inline: true, rejectNeedsReason: false, confirmApprove: false,
      });
    }
  }

  if (has("BILL")) {
    const rows = await prisma.supplierBill.findMany({ where: { ...bw, approvalStatus: "PENDING" }, orderBy: { createdAt: "asc" }, take: LIMIT, include: { supplier: { select: { name: true } }, branch: { select: { code: true } } } });
    for (const b of rows) {
      const chips: Chip[] = [];
      if (b.submittedBySupplier) chips.push({ text: "Sent by supplier", tone: "info" });
      if (b.timesheetAmount !== null) {
        const v = billVariance(num(b.amount), num(b.timesheetAmount));
        chips.push(v.state === "MATCH" ? { text: "Matches timesheet", tone: "success" } : { text: `${v.diff > 0 ? "+" : "−"}AED ${Math.abs(v.diff).toLocaleString("en-AE", { maximumFractionDigits: 0 })} vs timesheet (${Math.abs(v.pct ?? 0)}%)`, tone: "warning" });
      } else if (b.periodMonth) chips.push({ text: `No timesheet for ${b.periodMonth}`, tone: "neutral" });
      out.push({
        key: `BILL:${b.id}`, kind: "BILL", id: b.id, title: `${b.supplier.name} — bill #${b.billNo}`, subtitle: `${b.periodMonth ? `${b.periodMonth} · ` : ""}due ${b.dueDate.toISOString().slice(0, 10)}${b.description ? ` · ${b.description}` : ""}`,
        requester: b.submittedBySupplier ? b.supplier.name : null, at: b.createdAt, amount: num(b.amount) + num(b.vatAmount), branch: branchTag(b.branch.code), href: "/finance/bills?view=REVIEW", chips, inline: true, rejectNeedsReason: true, confirmApprove: false,
      });
    }
  }

  if (has("PAYROLL")) {
    const rows = await prisma.payrollRun.findMany({ where: { ...bw, status: "DRAFT", submittedAt: { not: null } }, orderBy: { submittedAt: "asc" }, take: LIMIT, include: { company: { select: { name: true } }, lines: { select: { net: true } }, branch: { select: { code: true } } } });
    const users = rows.length ? await prisma.user.findMany({ where: { id: { in: rows.map((r) => r.submittedById).filter((x): x is string => !!x) } }, select: { id: true, name: true } }) : [];
    const nameOf = new Map(users.map((u) => [u.id, u.name]));
    for (const r of rows) {
      out.push({
        key: `PAYROLL:${r.id}`, kind: "PAYROLL", id: r.id, title: `Payroll — ${r.company?.name ?? "Own companies"} · ${r.month}`, subtitle: `${r.lines.length} employee${r.lines.length === 1 ? "" : "s"} · ${r.payType === "HOURLY" ? "hourly, from timesheet" : "basic, from attendance"}`,
        requester: r.submittedById ? nameOf.get(r.submittedById) ?? null : null, at: r.submittedAt!, amount: r.lines.reduce((s, l) => s + num(l.net), 0), branch: branchTag(r.branch.code), href: `/payroll/${r.id}`,
        chips: [], inline: true, rejectNeedsReason: true, confirmApprove: true,
      });
    }
  }

  if (has("WORKER")) {
    const rows = await prisma.workerSubmission.findMany({ where: { ...bw, status: "PENDING" }, orderBy: { submittedAt: "asc" }, take: LIMIT, include: { supplier: { select: { name: true } } } });
    for (const w of rows) {
      out.push({
        key: `WORKER:${w.id}`, kind: "WORKER", id: w.id, title: `${[w.firstName, w.lastName].join(" ")} — new worker`, subtitle: `${w.trade} · ${w.supplier.name}${w.nationality ? ` · ${w.nationality}` : ""}`,
        requester: w.supplier.name, at: w.submittedAt, amount: null, branch: null, href: "/approvals?type=WORKER", chips: [{ text: "Adds an employee", tone: "info" }], inline: true, rejectNeedsReason: true, confirmApprove: false,
      });
    }
  }

  if (has("CHANGE")) {
    const rows = await prisma.supplierChangeRequest.findMany({ where: { ...bw, status: "PENDING" }, orderBy: { requestedAt: "asc" }, take: LIMIT, include: { supplier: { select: { name: true } } } });
    for (const c of rows) {
      const fields = Object.keys((c.payload ?? {}) as Record<string, unknown>).length;
      out.push({
        key: `CHANGE:${c.id}`, kind: "CHANGE", id: c.id, title: `${c.supplier.name} — ${c.kind === "BANK" ? "bank details" : "contact details"}`, subtitle: `${fields} field${fields === 1 ? "" : "s"} to change`,
        requester: c.supplier.name, at: c.requestedAt, amount: null, branch: null, href: "/approvals?type=CHANGE",
        chips: c.kind === "BANK" ? [{ text: "Decides where payments go — confirm by phone", tone: "danger" }] : [], inline: true, rejectNeedsReason: true, confirmApprove: c.kind === "BANK",
      });
    }
  }

  if (has("SUPPLIER")) {
    const rows = await prisma.supplier.findMany({
      where: { ...bw, isOwnCompany: false, OR: SUPPLIER_FLAGS.map(([f]) => ({ [f]: "Pending" })) },
      orderBy: { createdAt: "asc" }, take: LIMIT, select: { id: true, name: true, createdAt: true, approvalStatus: true, labourApprovalStatus: true, invoiceApprovalStatus: true },
    });
    for (const s of rows) {
      for (const [field, label] of SUPPLIER_FLAGS) {
        if ((s as Record<string, unknown>)[field] !== "Pending") continue;
        out.push({
          key: `SUPPLIER:${s.id}:${field}`, kind: "SUPPLIER", id: s.id, field, title: `${s.name} — ${label} approval`,
          subtitle: field === "approvalStatus" ? "Lets its labour be attached to a project" : field === "labourApprovalStatus" ? "Lets its workers be allocated to a demand" : "Lets a payout sheet be generated for it",
          requester: null, at: s.createdAt, amount: null, branch: null, href: `/suppliers/${s.id}`, chips: [], inline: true, rejectNeedsReason: false, confirmApprove: false,
        });
      }
    }
  }

  if (has("DEMAND")) {
    const rows = await prisma.demandRequest.findMany({
      where: { ...bw, status: { notIn: ["Closed", "Rejected"] }, trades: { some: { approvedQuantity: null } } },
      orderBy: { createdAt: "asc" }, take: LIMIT,
      include: { client: { select: { name: true } }, trades: { select: { id: true, trade: true, quantity: true, approvedQuantity: true } }, branch: { select: { code: true } } },
    });
    for (const r of rows) {
      const open = r.trades.filter((t) => t.approvedQuantity === null);
      out.push({
        key: `DEMAND:${r.id}`, kind: "DEMAND", id: r.id, ids: open.map((t) => t.id), title: `Request #${r.requestNo} — ${r.client.name}`,
        subtitle: open.map((t) => `${t.quantity} ${t.trade}`).join(" · "), requester: null, at: r.createdAt, amount: null, branch: branchTag(r.branch.code), href: `/demand/${r.id}`,
        chips: [{ text: `${open.length} line${open.length === 1 ? "" : "s"} to approve`, tone: "info" }, ...(r.priority === "High" ? [{ text: "High priority", tone: "warning" as const }] : [])], inline: true, rejectNeedsReason: false, confirmApprove: false,
      });
    }
  }

  if (has("TIMESHEET")) {
    const rows = await prisma.timesheetEntry.findMany({
      where: { ...bw, status: { in: ["SUBMITTED", "UNDER_REVIEW"] } }, orderBy: { updatedAt: "asc" }, take: 2000,
      select: { id: true, month: true, updatedAt: true, invoiceValue: true, supplier: { select: { name: true } }, client: { select: { name: true } } },
    });
    const groups = new Map<string, { ids: string[]; supplier: string; client: string | null; month: string; at: Date; value: number }>();
    for (const e of rows) {
      const key = `${e.supplier.name}|${e.client?.name ?? ""}|${e.month}`;
      const g = groups.get(key) ?? { ids: [], supplier: e.supplier.name, client: e.client?.name ?? null, month: e.month, at: e.updatedAt, value: 0 };
      g.ids.push(e.id); g.value += e.invoiceValue; if (e.updatedAt < g.at) g.at = e.updatedAt;
      groups.set(key, g);
    }
    for (const [key, g] of groups) {
      out.push({
        key: `TIMESHEET:${key}`, kind: "TIMESHEET", id: g.ids[0], ids: g.ids, title: `${g.supplier} — timesheet ${g.month}`, subtitle: `${g.ids.length} row${g.ids.length === 1 ? "" : "s"}${g.client ? ` · ${g.client}` : ""}`,
        requester: null, at: g.at, amount: g.value, branch: null, href: "/invoices/client-timesheet", chips: [], inline: true, rejectNeedsReason: false, confirmApprove: true,
      });
    }
  }

  if (has("CORRECTION")) {
    const rows = await prisma.attendanceCorrectionRequest.findMany({
      where: { status: "PENDING", attendance: bw }, orderBy: { createdAt: "asc" }, take: LIMIT,
      include: { attendance: { select: { date: true, status: true, employee: { select: { name: true, employeeIdNo: true } } } } },
    });
    const users = rows.length ? await prisma.user.findMany({ where: { id: { in: rows.map((r) => r.requestedById) } }, select: { id: true, name: true } }) : [];
    const nameOf = new Map(users.map((u) => [u.id, u.name]));
    for (const c of rows) {
      out.push({
        key: `CORRECTION:${c.id}`, kind: "CORRECTION", id: c.id, title: `${c.attendance.employee.name} — attendance ${c.attendance.date.toISOString().slice(0, 10)}`,
        subtitle: `${c.attendance.status}${c.requestedStatus ? ` → ${c.requestedStatus}` : ""}${c.reason ? ` · ${c.reason}` : ""}`, requester: nameOf.get(c.requestedById) ?? null, at: c.createdAt, amount: null, branch: null,
        href: "/attendance", chips: [], inline: true, rejectNeedsReason: false, confirmApprove: false,
      });
    }
  }

  return out.sort((a, b) => a.at.getTime() - b.at.getTime());
}

/**
 * How many items are waiting for this person, using counts only, so the sidebar
 * can show it on every page without loading the items. Mirrors loadApprovals
 * kind by kind (grouped kinds count groups, not rows).
 */
export async function countPendingApprovals(scope: ApprovalScope): Promise<number> {
  const allowed = allowedKinds(scope.subject);
  const has = (k: ApprovalKind) => allowed.includes(k);
  const bw = branchWhere(scope.branchId);
  const n = await Promise.all([
    has("EXPENSE") ? prisma.expense.count({ where: { ...bw, status: "PENDING" } }) : 0,
    has("BILL") ? prisma.supplierBill.count({ where: { ...bw, approvalStatus: "PENDING" } }) : 0,
    has("PAYROLL") ? prisma.payrollRun.count({ where: { ...bw, status: "DRAFT", submittedAt: { not: null } } }) : 0,
    has("WORKER") ? prisma.workerSubmission.count({ where: { ...bw, status: "PENDING" } }) : 0,
    has("CHANGE") ? prisma.supplierChangeRequest.count({ where: { ...bw, status: "PENDING" } }) : 0,
    ...(has("SUPPLIER") ? SUPPLIER_FLAGS.map(([f]) => prisma.supplier.count({ where: { ...bw, isOwnCompany: false, [f]: "Pending" } })) : [0]),
    has("DEMAND") ? prisma.demandRequest.count({ where: { ...bw, status: { notIn: ["Closed", "Rejected"] }, trades: { some: { approvedQuantity: null } } } }) : 0,
    has("TIMESHEET") ? prisma.timesheetEntry.groupBy({ by: ["supplierId", "clientId", "month"], where: { ...bw, status: { in: ["SUBMITTED", "UNDER_REVIEW"] } } }).then((g) => g.length) : 0,
    has("CORRECTION") ? prisma.attendanceCorrectionRequest.count({ where: { status: "PENDING", attendance: bw } }) : 0,
  ]);
  return n.reduce((a, b) => a + b, 0);
}

/** Counts per kind, ignoring filters, for the tab badges and the sidebar. */
export function countByKind(items: ApprovalItem[]): Record<ApprovalKind, number> {
  const c = Object.fromEntries(APPROVAL_KINDS.map((k) => [k.kind, 0])) as Record<ApprovalKind, number>;
  for (const i of items) c[i.kind]++;
  return c;
}

export type ApprovalFilters = { type?: string; q?: string; olderThanDays?: number; minAmount?: number; requester?: string };

/** Pure filtering, so the page and the tests share it. */
export function filterApprovals(items: ApprovalItem[], f: ApprovalFilters, now: Date): ApprovalItem[] {
  const q = f.q?.trim().toLowerCase();
  return items.filter((i) => {
    if (f.type && i.kind !== f.type) return false;
    if (q && !`${i.title} ${i.subtitle} ${i.requester ?? ""}`.toLowerCase().includes(q)) return false;
    if (f.olderThanDays && (now.getTime() - i.at.getTime()) / 86_400_000 < f.olderThanDays) return false;
    if (f.minAmount && (i.amount ?? 0) < f.minAmount) return false;
    if (f.requester && (i.requester ?? "") !== f.requester) return false;
    return true;
  });
}
