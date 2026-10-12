"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUserWithBranch, requirePermission, subjectOf, requireView, requireWrite } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { can } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { refLabel, renderEmployeeLetter } from "@/lib/employeeLetter";
import { substituteInHtml } from "@/lib/letterHtml";
import { loadIssuerOptions, resolveIssuerSupplier, type IssuerKey, type IssuerOption } from "@/lib/employeeLetterIssuer";

type Inputs = Record<string, string>;
export type LayoutInput = { issuer: IssuerKey; onLetterhead: boolean; signatoryName: string; signatoryTitle: string; showSignature: boolean; showStamp: boolean };
const clean = (inputs: Inputs) => Object.fromEntries(Object.entries(inputs ?? {}).map(([k, v]) => [String(k).slice(0, 120), String(v ?? "").slice(0, 400)]));

/** Live preview: the letter with the employee's real details filled in. Stores nothing. */
export async function previewLetterAction(employeeId: string, templateId: string, inputs: Inputs, issuer: IssuerKey = "PROFILE"): Promise<{ html?: string; title?: string; missing?: string[]; empty?: string[]; error?: string }> {
  await requireView("workforce.letters");
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const emp = await prisma.employee.findUnique({ where: { id: employeeId }, select: { branchId: true, supplier: { select: { isOwnCompany: true } } } });
  if (!emp || isOutsideBranch(emp.branchId, branchId, isSuperAdmin)) return { error: "Employee not found." };
  if (!emp.supplier?.isOwnCompany) return { error: "Letters are only made for employees of your own company." };
  const who = await resolveIssuerSupplier(employeeId, issuer);
  if ("error" in who) return { error: who.error };
  const r = await renderEmployeeLetter({ employeeId, templateId, inputs: clean(inputs), canSeePay: can(subjectOf(user), "payroll", "view"), issuerSupplierId: who.supplierId });
  return r.ok ? { html: r.html, title: r.title, missing: r.missing, empty: r.empty } : { error: r.error };
}

/** Issues the letter: numbers it, stores the exact wording, and records who issued it. */
export async function issueLetterAction(employeeId: string, templateId: string, inputs: Inputs, layoutIn: LayoutInput, allowEmpty = false): Promise<{ id?: string; error?: string }> {
  await requireWrite("workforce.letters");
  await requirePermission("workforce.letters", "create");
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const emp = await prisma.employee.findUnique({ where: { id: employeeId }, select: { branchId: true, supplier: { select: { isOwnCompany: true } } } });
  if (!emp || isOutsideBranch(emp.branchId, branchId, isSuperAdmin)) return { error: "Employee not found." };
  if (!emp.supplier?.isOwnCompany) return { error: "Letters are only made for employees of your own company." };

  // Whose letterhead, signature and stamp: the visa company, the supplier company, or the company profile.
  const issuerKey: IssuerKey = layoutIn.issuer === "SPONSOR" || layoutIn.issuer === "SUPPLIER" ? layoutIn.issuer : "PROFILE";
  const who = await resolveIssuerSupplier(employeeId, issuerKey);
  if ("error" in who) return { error: who.error };
  const issuerOpt = (await loadIssuerOptions(employeeId))?.options.find((o) => o.key === issuerKey);
  if (!issuerOpt) return { error: "Employee not found." };

  // Signature and stamp are opt-in and only possible if that company has uploaded them.
  if (layoutIn.showSignature && !issuerOpt.signatureUrl) return { error: `No signature image is uploaded for ${issuerOpt.name} (${issuerOpt.where}).` };
  if (layoutIn.showStamp && !issuerOpt.stampUrl) return { error: `No stamp is uploaded for ${issuerOpt.name} (${issuerOpt.where}).` };
  const layout = {
    issuerKey,
    issuerSupplierId: who.supplierId,
    onLetterhead: !!layoutIn.onLetterhead,
    signatoryName: String(layoutIn.signatoryName ?? "").trim().slice(0, 80) || null,
    signatoryTitle: String(layoutIn.signatoryTitle ?? "").trim().slice(0, 80) || null,
    showSignature: !!layoutIn.showSignature,
    showStamp: !!layoutIn.showStamp,
  };

  const values = clean(inputs);
  const canSeePay = can(subjectOf(user), "payroll", "view");
  const first = await renderEmployeeLetter({ employeeId, templateId, inputs: values, canSeePay, issuerSupplierId: who.supplierId });
  if (!first.ok) return { error: first.error };
  if (first.missing.length > 0) return { error: `Fill in: ${first.missing.join(", ")}.` };
  if (first.empty.length > 0 && !allowEmpty) return { error: `${first.employeeName} has no ${first.empty.join(", ").toLowerCase()} on file, so the letter would have a gap. Add it on their record, or tick “Issue anyway”.` };

  // The reference number comes from the database, so create the row first, then write it into the wording.
  const created = await prisma.issuedLetter.create({
    data: { employeeId, templateId, title: first.title, bodyHtml: first.html, inputs: values, layout, issuedById: user.id, branchId: first.branchId },
  });
  const ref = refLabel(created.refNo);
  const final = await renderEmployeeLetter({ employeeId, templateId, inputs: values, canSeePay, refNo: ref, issuerSupplierId: who.supplierId });
  const bodyHtml = final.ok ? final.html : substituteInHtml(first.html, { "LTR-••••••": ref });
  await prisma.issuedLetter.update({ where: { id: created.id }, data: { bodyHtml } });
  await logAudit({ entityType: "ISSUED_LETTER", entityId: created.id, action: "CREATE", after: { ref, title: first.title, employee: first.employeeName, template: first.templateName, ...layout }, userId: user.id, userName: user.name, branchId: first.branchId });
  revalidatePath("/letters");
  return { id: created.id };
}

/** The letterhead choices for one employee (visa company, supplier company, company profile) with what each has on file. */
export async function letterIssuersAction(employeeId: string): Promise<{ options?: IssuerOption[]; error?: string }> {
  await requireView("workforce.letters");
  const { branchId, isSuperAdmin } = await requireUserWithBranch();
  const r = await loadIssuerOptions(employeeId);
  if (!r || isOutsideBranch(r.branchId, branchId, isSuperAdmin)) return { error: "Employee not found." };
  return { options: r.options };
}
