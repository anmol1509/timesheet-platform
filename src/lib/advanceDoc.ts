import { prisma } from "@/lib/db";
import type { Letterhead } from "@/lib/letterhead";
import { headerFor } from "@/lib/payslipData";
import { advanceRef, amountInWords, planRows, readSchedule, type ScheduleRow } from "@/lib/advances";

const n = (d: { toString(): string }) => Number(d.toString());
const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

/** Everything a printed advance request or receipt says, worked out once. */
export type AdvanceDoc = {
  ref: string;
  /** "Advance" or "Loan" */
  kind: string;
  /** The heading: a request until the money is handed over, then a receipt. */
  title: string;
  branchId: string;
  companyId: string | null;
  letterhead: Letterhead;
  employee: { name: string; idNo: string; trade: string | null };
  amount: number;
  words: string;
  reason: string | null;
  requestedOn: string;
  requestedBy: string;
  approval: { status: "PENDING" | "APPROVED" | "REJECTED"; by: string | null; on: string | null; note: string | null };
  given: { date: string; method: string | null; reference: string | null } | null;
  plan: ScheduleRow[];
  /** What happens after the last planned month, when the plan is a month-by-month one. */
  planNote: string | null;
  recovered: ScheduleRow[];
  balance: number;
};

/** One advance as a document, or null when it isn't found. Scoping to the caller's branch is the caller's job. */
export async function loadAdvanceDoc(id: string): Promise<AdvanceDoc | null> {
  const l = await prisma.employeeLoan.findUnique({
    where: { id },
    include: {
      employee: { select: { name: true, employeeIdNo: true, trade: true, supplierId: true, supplier: { select: { isOwnCompany: true } } } },
      branch: true,
      repayments: { select: { month: true, amount: true }, orderBy: { month: "asc" } },
    },
  });
  if (!l) return null;
  const people = await prisma.user.findMany({ where: { id: { in: [l.createdById, l.approvedById].filter((x): x is string => !!x) } }, select: { id: true, name: true } });
  const nameOf = new Map(people.map((u) => [u.id, u.name]));
  const companyId = l.employee.supplier?.isOwnCompany ? l.employee.supplierId : null;
  const schedule = readSchedule(l.schedule);
  const principal = n(l.principal);
  const recovered = l.repayments.map((r) => ({ month: r.month, amount: n(r.amount) }));
  const last = schedule ? [...schedule].sort((a, b) => a.month.localeCompare(b.month)).at(-1) : null;
  return {
    ref: advanceRef(l.refNo),
    kind: l.type === "LOAN" ? "Loan" : "Advance",
    title: l.givenDate ? `${l.type === "LOAN" ? "LOAN" : "ADVANCE"} RECEIPT` : `${l.type === "LOAN" ? "LOAN" : "ADVANCE"} REQUEST`,
    branchId: l.branchId,
    companyId,
    letterhead: await headerFor({ companyId, branch: l.branch }),
    employee: { name: l.employee.name, idNo: l.employee.employeeIdNo, trade: l.employee.trade },
    amount: principal,
    words: amountInWords(principal),
    reason: l.reason,
    requestedOn: day(l.createdAt)!,
    requestedBy: nameOf.get(l.createdById) ?? "—",
    approval: { status: l.approvalStatus === "REJECTED" ? "REJECTED" : l.approvalStatus === "PENDING" ? "PENDING" : "APPROVED", by: l.approvedById ? nameOf.get(l.approvedById) ?? null : null, on: day(l.approvedAt), note: l.decisionNote },
    given: l.givenDate ? { date: day(l.givenDate)!, method: l.method, reference: l.reference } : null,
    plan: planRows({ principal, instalment: n(l.instalment), startMonth: l.startMonth, schedule }),
    planNote: last ? `If anything is still owing after ${last.month}, it keeps being deducted at AED ${last.amount.toFixed(2)} a month until cleared.` : null,
    recovered,
    balance: Math.max(0, Math.round((principal - n(l.repaid)) * 100) / 100),
  };
}
