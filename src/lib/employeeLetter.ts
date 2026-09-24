import { prisma } from "@/lib/db";
import { formatLetterDate } from "@/lib/letterLayout";

const money = (n: number) => n.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = (d: { toString(): string } | null | undefined) => (d == null ? 0 : Number(d.toString()));

export const refLabel = (refNo: number) => `LTR-${String(refNo).padStart(6, "0")}`;

/** Fields whose values come from pay data — only filled for people allowed to see payroll. */
export const SALARY_KEYS = ["BASICSALARY", "TOTALSALARY"];

export type EmployeeValues = { values: Record<string, string>; salaryAvailable: boolean };

/** Loads an employee and turns them into merge-field values for a letter. */
export async function employeeLetterValues(employeeId: string, opts: { canSeePay: boolean }): Promise<(EmployeeValues & { employee: { id: string; branchId: string; name: string } }) | null> {
  const e = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: {
      id: true, branchId: true, name: true, employeeIdNo: true, trade: true, position: true, nationality: true, passportNumber: true, emiratesId: true, joinDate: true,
      payStructure: true, basicSalary: true, housingAllowance: true, foodAllowance: true, transportAllowance: true, otherAllowance: true, flatMonthlyRate: true,
      project: { select: { name: true } },
      branch: { select: { name: true } },
    },
  });
  if (!e) return null;

  let basic = "";
  let total = "";
  if (opts.canSeePay) {
    if (e.payStructure === "ITEMISED") {
      const b = num(e.basicSalary);
      basic = money(b);
      total = money(b + num(e.housingAllowance) + num(e.foodAllowance) + num(e.transportAllowance) + num(e.otherAllowance));
    } else if (e.payStructure === "FLAT") {
      basic = total = money(num(e.flatMonthlyRate));
    }
  }
  return {
    employee: { id: e.id, branchId: e.branchId, name: e.name },
    salaryAvailable: !!basic,
    values: {
      EMPLOYEENAME: e.name.toUpperCase(),
      EMPLOYEEID: e.employeeIdNo,
      DESIGNATION: e.trade ?? e.position ?? "",
      NATIONALITY: e.nationality ?? "",
      PASSPORTNO: e.passportNumber ?? "",
      EMIRATESID: e.emiratesId ?? "",
      JOINDATE: e.joinDate ? formatLetterDate(e.joinDate) : "",
      PROJECTNAME: e.project?.name ?? "",
      BASICSALARY: basic,
      TOTALSALARY: total,
      COMPANYNAME: e.branch.name.toUpperCase(),
      BRANCHNAME: e.branch.name,
      DATE: formatLetterDate(new Date()),
    },
  };
}

import { askLabels, substituteInHtml, templateHtml, tokensIn, ASK_PREFIX } from "@/lib/letterHtml";
import { sanitizeLetterHtml } from "@/lib/letterSanitize";

export type RenderedLetter =
  | { ok: true; html: string; title: string; employeeName: string; branchId: string; templateName: string; missing: string[]; asks: string[] }
  | { ok: false; error: string };

/**
 * Fills a template for one employee. `missing` lists the "ask when issuing"
 * blanks not yet answered (fine for a preview, a hard stop when issuing).
 */
export async function renderEmployeeLetter(opts: {
  employeeId: string;
  templateId: string;
  inputs: Record<string, string>;
  canSeePay: boolean;
  refNo?: string;
}): Promise<RenderedLetter> {
  const [template, ev] = await Promise.all([
    prisma.letterTemplate.findUnique({ where: { id: opts.templateId } }),
    employeeLetterValues(opts.employeeId, { canSeePay: opts.canSeePay }),
  ]);
  if (!ev) return { ok: false, error: "Employee not found." };
  if (!template || template.audience !== "EMPLOYEE") return { ok: false, error: "Choose an employee letter template." };
  if (template.branchId !== ev.employee.branchId) return { ok: false, error: "That template belongs to a different branch." };

  const html = templateHtml(template);
  const tokens = new Set(tokensIn(html));
  if (SALARY_KEYS.some((k) => tokens.has(k))) {
    if (!opts.canSeePay) return { ok: false, error: "This letter includes salary, which needs payroll access." };
    if (!ev.salaryAvailable) return { ok: false, error: `${ev.employee.name} has no monthly salary set (a pay structure of Itemised or Flat is needed on their Payroll & WPS tab).` };
  }

  const asks = askLabels(html);
  const values: Record<string, string> = { ...ev.values, REFNO: opts.refNo ?? "LTR-••••••" };
  const missing: string[] = [];
  for (const label of asks) {
    const v = (opts.inputs[label] ?? "").trim();
    values[`${ASK_PREFIX}${label}`] = v || `[${label}]`;
    if (!v) missing.push(label);
  }
  return {
    ok: true,
    html: sanitizeLetterHtml(substituteInHtml(html, values)),
    title: template.title || template.category || "Letter",
    employeeName: ev.employee.name,
    branchId: ev.employee.branchId,
    templateName: template.name,
    missing,
    asks,
  };
}
