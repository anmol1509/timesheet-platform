import { prisma } from "@/lib/db";
import type { Letterhead } from "@/lib/letterhead";
import { headerFor } from "@/lib/payslipData";
import { advanceRef, amountInWords, planRows, readSchedule, type ScheduleRow } from "@/lib/advances";
import { advanceLetterValues } from "@/lib/advanceLetter";
import { employeeLetterValues } from "@/lib/employeeLetter";
import { ASK_PREFIX, askLabels, substituteInHtml, templateHtml } from "@/lib/letterHtml";
import { presetByKey, presetHtml } from "@/lib/letterPresets";
import { sanitizeLetterHtml } from "@/lib/letterSanitize";

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
  /** The letter's wording with every field filled in, from the company's own template or the built-in one. */
  bodyHtml: string;
  /** Which template it came from: the company's own copy, or the built-in wording. */
  templateName: string;
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
  const ref = advanceRef(l.refNo);
  const letterhead = await headerFor({ companyId, branch: l.branch });
  const approval = { status: (l.approvalStatus === "REJECTED" ? "REJECTED" : l.approvalStatus === "PENDING" ? "PENDING" : "APPROVED") as "PENDING" | "APPROVED" | "REJECTED", by: l.approvedById ? nameOf.get(l.approvedById) ?? null : null, on: day(l.approvedAt), note: l.decisionNote };
  const given = l.givenDate ? { date: day(l.givenDate)!, method: l.method, reference: l.reference } : null;
  const plan = planRows({ principal, instalment: n(l.instalment), startMonth: l.startMonth, schedule });
  const balance = Math.max(0, Math.round((principal - n(l.repaid)) * 100) / 100);
  const kind = l.type === "LOAN" ? "Loan" : "Advance";

  // The wording: the company's own copy of the template if it has made one in Letters, else the built-in one.
  const presetKey = given ? "advance-receipt" : "advance-request";
  const preset = presetByKey(presetKey)!;
  const own = await prisma.letterTemplate.findFirst({ where: { branchId: l.branchId, audience: "EMPLOYEE", presetKey }, orderBy: { createdAt: "desc" } });
  const html = own ? templateHtml(own) : presetHtml(preset);
  const base = await employeeLetterValues(l.employeeId, { canSeePay: false, companyName: letterhead.name });
  const values: Record<string, string> = { ...(base?.values ?? {}), REFNO: ref, ...advanceLetterValues({ ref, kind, amount: principal, reason: l.reason, requestedOn: day(l.createdAt)!, requestedBy: nameOf.get(l.createdById) ?? "—", approval, given, plan, balance }) };
  // "Ask when issuing" blanks have no one to ask here: leave them visibly open to fill in by hand.
  for (const label of askLabels(html)) values[`${ASK_PREFIX}${label}`] = `[${label}]`;

  return {
    ref,
    kind,
    title: (own?.title || own?.category || preset.title).toUpperCase(),
    branchId: l.branchId,
    companyId,
    letterhead,
    employee: { name: l.employee.name, idNo: l.employee.employeeIdNo, trade: l.employee.trade },
    amount: principal,
    words: amountInWords(principal),
    reason: l.reason,
    requestedOn: day(l.createdAt)!,
    requestedBy: nameOf.get(l.createdById) ?? "—",
    approval,
    given,
    plan,
    planNote: last ? `If anything is still owing after ${last.month}, it keeps being deducted at AED ${last.amount.toFixed(2)} a month until cleared.` : null,
    recovered,
    balance,
    bodyHtml: sanitizeLetterHtml(substituteInHtml(html, values)),
    templateName: own ? own.name : `${preset.name} (built in)`,
  };
}
