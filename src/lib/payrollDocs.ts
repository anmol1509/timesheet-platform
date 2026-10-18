import { prisma } from "@/lib/db";
import { employeeLetterValues } from "@/lib/employeeLetter";
import { headerFor } from "@/lib/payslipData";
import { renderPresetDoc } from "@/lib/docTemplate";
import { deductionValues, revisionValues, settlementValues } from "@/lib/payrollDocValues";
import type { DocPdfInput } from "@/lib/generateDocPdf";

/** The letters that come from payroll records, other than advances. */
export const PAYROLL_DOC_KINDS = ["salary-revision", "settlement", "deduction-notice"] as const;
export type PayrollDocKind = (typeof PAYROLL_DOC_KINDS)[number];
export const isPayrollDocKind = (v: string): v is PayrollDocKind => (PAYROLL_DOC_KINDS as readonly string[]).includes(v);

export type PayrollDoc = DocPdfInput & { branchId: string; companyId: string | null; fileName: string; templateName: string };

const n = (d: { toString(): string }) => Number(d.toString());
const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");
const today = () => new Date().toISOString().slice(0, 10).split("-").reverse().join("-");
const shortId = (id: string) => id.slice(-6).toUpperCase();

/** One document as a ready-to-print letter, or null when it isn't found (or has nothing to say). Scoping to the caller's branch is the caller's job. */
export async function loadPayrollDoc(kind: PayrollDocKind, id: string): Promise<PayrollDoc | null> {
  if (kind === "salary-revision") {
    const r = await prisma.salaryRevision.findUnique({ where: { id }, include: { branch: true, employee: { select: { id: true, supplierId: true, supplier: { select: { isOwnCompany: true } } } } } });
    if (!r) return null;
    const companyId = r.employee.supplier?.isOwnCompany ? r.employee.supplierId : null;
    const letterhead = await headerFor({ companyId, branch: r.branch });
    const ev = await employeeLetterValues(r.employeeId, { canSeePay: true, companyName: letterhead.name });
    const ref = `REV-${shortId(r.id)}`;
    const doc = await renderPresetDoc({ branchId: r.branchId, presetKey: "salary-revision", subjectId: r.id, values: { ...(ev?.values ?? {}), REFNO: ref, ...revisionValues({ effectiveFrom: day(r.effectiveFrom), fixedBefore: n(r.fixedBefore), fixedAfter: n(r.fixedAfter), reason: r.reason }) } });
    return { title: doc.title, ref, date: today(), letterhead, bodyHtml: doc.html, employeeName: ev?.employee.name ?? null, approvedBy: null, footer: "Salary revision", branchId: r.branchId, companyId, fileName: ref, templateName: doc.templateName };
  }

  if (kind === "settlement") {
    const s = await prisma.finalSettlement.findUnique({ where: { id }, include: { branch: true, employee: { select: { supplierId: true, supplier: { select: { isOwnCompany: true } } } } } });
    if (!s) return null;
    const companyId = s.employee.supplier?.isOwnCompany ? s.employee.supplierId : null;
    const letterhead = await headerFor({ companyId, branch: s.branch });
    const [ev, approver] = await Promise.all([
      employeeLetterValues(s.employeeId, { canSeePay: true, companyName: letterhead.name }),
      s.approvedById ? prisma.user.findUnique({ where: { id: s.approvedById }, select: { name: true } }) : null,
    ]);
    const ref = `FS-${shortId(s.id)}`;
    const doc = await renderPresetDoc({
      branchId: s.branchId, presetKey: "final-settlement", subjectId: s.id,
      values: { ...(ev?.values ?? {}), REFNO: ref, ...settlementValues({ exitDate: day(s.exitDate), reason: s.reason, serviceYears: s.serviceYears, gratuity: n(s.gratuity), unpaidSalary: n(s.unpaidSalary), leavePay: n(s.leavePay), noticePay: n(s.noticePay), otherEarnings: n(s.otherEarnings), loanBalance: n(s.loanBalance), otherDeductions: n(s.otherDeductions), net: n(s.net) }) },
    });
    const state = s.status === "PAID" ? "Paid" : s.status === "APPROVED" ? "Approved" : "Draft";
    return { title: doc.title, ref, date: today(), letterhead, bodyHtml: doc.html, employeeName: ev?.employee.name ?? null, approvedBy: approver?.name ?? null, footer: `Final settlement (${state})`, branchId: s.branchId, companyId, fileName: ref, templateName: doc.templateName };
  }

  // A salary deduction notice, from the deduction typed against a payroll line.
  const l = await prisma.payrollLine.findUnique({ where: { id }, include: { run: { include: { branch: true } } } });
  if (!l || n(l.manualDeduction) <= 0) return null;
  const letterhead = await headerFor({ companyId: l.run.companyId, branch: l.run.branch });
  const ev = await employeeLetterValues(l.employeeId, { canSeePay: true, companyName: letterhead.name });
  const ref = `DN-${shortId(l.id)}`;
  const doc = await renderPresetDoc({ branchId: l.run.branchId, presetKey: "deduction-notice", subjectId: l.id, values: { ...(ev?.values ?? {}), REFNO: ref, ...deductionValues({ amount: n(l.manualDeduction), reason: l.deductionNote, month: l.run.month }) } });
  return { title: doc.title, ref, date: today(), letterhead, bodyHtml: doc.html, employeeName: ev?.employee.name ?? null, approvedBy: null, footer: "Deduction notice", branchId: l.run.branchId, companyId: l.run.companyId, fileName: ref, templateName: doc.templateName };
}
