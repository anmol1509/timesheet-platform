import { prisma } from "@/lib/db";
import { buildLetterhead, type Letterhead } from "@/lib/letterhead";
import { buildPayslip, yearToDate, type Payslip, type PayslipLine } from "@/lib/payslip";

const n = (d: { toString(): string }) => Number(d.toString());

type LineRow = {
  payStructure: string; basic: unknown; allowances: unknown; overtimePay: unknown; deductions: unknown; adjustment: unknown; adjustmentNote: string | null;
  otherEarnings: unknown; otherDeductions: unknown; manualDeduction: unknown; deductionNote: string | null; loanDeduction: unknown; advanceNote: string | null; gasCharge: unknown; shortfallHours?: unknown; shortfallDeduction?: unknown;
  absentDays: number; unpaidLeaveDays: number; otHours: unknown; restHours: unknown; normalHours: unknown; employedDays: number | null; daysInMonth: number; net: unknown; items: unknown;
};
const num = (v: unknown) => (v == null ? 0 : n(v as { toString(): string }));

export function lineToPayslipLine(l: LineRow): PayslipLine {
  const items = Array.isArray(l.items) ? (l.items as { kind: string; label: string; amount: number }[]) : null;
  return {
    payStructure: l.payStructure, basic: num(l.basic), allowances: num(l.allowances), overtimePay: num(l.overtimePay), deductions: num(l.deductions), adjustment: num(l.adjustment), adjustmentNote: l.adjustmentNote,
    otherEarnings: num(l.otherEarnings), otherDeductions: num(l.otherDeductions), manualDeduction: num(l.manualDeduction), deductionNote: l.deductionNote, loanDeduction: num(l.loanDeduction), advanceNote: l.advanceNote, gasCharge: num(l.gasCharge), shortfallHours: num(l.shortfallHours), shortfallDeduction: num(l.shortfallDeduction),
    absentDays: l.absentDays, unpaidLeaveDays: l.unpaidLeaveDays, otHours: num(l.otHours), restHours: num(l.restHours), normalHours: num(l.normalHours), employedDays: l.employedDays, daysInMonth: l.daysInMonth, net: num(l.net), items,
  };
}

export type PayslipDoc = {
  month: string;
  letterhead: Letterhead;
  slips: {
    lineId: string;
    employee: { name: string; idNo: string; role: string; department: string | null };
    paidBy: string;
    slip: Payslip;
    ytd: { gross: number; deductions: number; net: number; months: number };
  }[];
};

/** The issuing company's identity: the run's own company when it has one, else the branch (older runs). */
export async function headerFor(run: { companyId: string | null; branch: Parameters<typeof buildLetterhead>[0] }): Promise<Letterhead> {
  if (run.companyId) {
    const c = await prisma.supplier.findUnique({
      where: { id: run.companyId },
      select: { name: true, fullName: true, location: true, emirate: true, country: true, phone: true, contactPhone: true, contactEmail: true, poBox: true, trn: true },
    });
    if (c) {
      return {
        name: (c.fullName || c.name).toUpperCase(),
        addressLines: [c.location, c.emirate, c.country].filter((x): x is string => !!x && x.trim().length > 0),
        phone: c.phone || c.contactPhone, fax: null, email: c.contactEmail,
        poBox: c.poBox ? c.poBox.replace(/^\s*P\.?\s*O\.?\s*Box\s*/i, "").trim() : null,
        trn: c.trn, logo: null,
      };
    }
  }
  return buildLetterhead(run.branch);
}

/** Year to date for each employee as of this run: approved or paid lines from the same calendar year, this run included. */
async function ytdFor(employeeIds: string[], month: string, thisRunId: string) {
  const rows = await prisma.payrollLine.findMany({
    where: { employeeId: { in: employeeIds }, run: { month: { gte: `${month.slice(0, 4)}-01`, lte: month }, OR: [{ status: { in: ["APPROVED", "PAID"] } }, { id: thisRunId }] } },
    include: { run: { select: { month: true } } },
  });
  const by = new Map<string, { month: string; gross: number; deductions: number; net: number }[]>();
  for (const r of rows) {
    const s = buildPayslip(lineToPayslipLine(r));
    (by.get(r.employeeId) ?? by.set(r.employeeId, []).get(r.employeeId)!).push({ month: r.run.month, gross: s.gross, deductions: s.totalDeductions, net: s.net });
  }
  return (employeeId: string) => yearToDate(by.get(employeeId) ?? [], month);
}

/** All payslips of a run (or one line), already scoped by the caller. null when the run is not found. */
export async function loadRunPayslips(runId: string, lineIds?: string | string[]): Promise<(PayslipDoc & { branchId: string }) | null> {
  const run = await prisma.payrollRun.findUnique({
    where: { id: runId },
    include: {
      branch: true,
      lines: {
        where: lineIds === undefined ? {} : { id: { in: Array.isArray(lineIds) ? lineIds : [lineIds] } },
        include: { employee: { select: { id: true, name: true, employeeIdNo: true, trade: true, position: true, department: true, category: true } } },
        orderBy: { employee: { name: "asc" } },
      },
    },
  });
  if (!run) return null;
  const ytd = await ytdFor(run.lines.map((l) => l.employeeId), run.month, run.id);
  return {
    branchId: run.branchId,
    month: run.month,
    letterhead: await headerFor(run),
    slips: run.lines.map((l) => ({
      lineId: l.id,
      employee: { name: l.employee.name, idNo: l.employee.employeeIdNo, role: (l.employee.category === "STAFF" ? l.employee.position : l.employee.trade ?? l.employee.position) ?? "—", department: l.employee.category === "STAFF" ? l.employee.department : null },
      paidBy: /cash/i.test(l.paymentMode ?? "") ? "Cash" : l.bankName ?? "Bank transfer",
      slip: buildPayslip(lineToPayslipLine(l)),
      ytd: ytd(l.employeeId),
    })),
  };
}

/** One payslip for the signed-in employee, only from an approved or paid run. */
export async function loadEssPayslip(employeeId: string, lineId: string): Promise<PayslipDoc | null> {
  const l = await prisma.payrollLine.findFirst({
    where: { id: lineId, employeeId, run: { status: { in: ["APPROVED", "PAID"] } } },
    select: { runId: true },
  });
  if (!l) return null;
  const doc = await loadRunPayslips(l.runId, lineId);
  return doc;
}
