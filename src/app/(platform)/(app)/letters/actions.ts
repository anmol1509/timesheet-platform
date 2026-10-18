"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUserWithBranch, requirePermission, subjectOf, requireView, requireWrite } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { can } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { refLabel, renderEmployeeLetter } from "@/lib/employeeLetter";
import { htmlToText, substituteInHtml } from "@/lib/letterHtml";
import { sanitizeLetterHtml } from "@/lib/letterSanitize";
import { GAP_FIELDS } from "@/lib/letterGaps";
import { formatMasked } from "@/lib/idFormats";
import { storeImage } from "@/lib/storedImage";
import { MARGIN_BRANCH_SELECT, marginsOfBranch } from "@/lib/paperMargins";
import { loadIssuerOptions, resolveIssuerSupplier, type IssuerKey, type IssuerOption } from "@/lib/employeeLetterIssuer";

type Inputs = Record<string, string>;
export type LayoutInput = { issuer: IssuerKey; onLetterhead: boolean; signatoryName: string; signatoryTitle: string; showSignature: boolean; showStamp: boolean; /** A signature or stamp uploaded for this letter only. Wins over the company's own. */ signatureImageId?: string | null; stampImageId?: string | null };
const clean = (inputs: Inputs) => Object.fromEntries(Object.entries(inputs ?? {}).map(([k, v]) => [String(k).slice(0, 120), String(v ?? "").slice(0, 400)]));

/** Live preview: the letter with the employee's real details filled in. Stores nothing. */
export async function previewLetterAction(employeeId: string, templateId: string, inputs: Inputs, issuer: IssuerKey = "PROFILE"): Promise<{ html?: string; title?: string; missing?: string[]; empty?: string[]; gaps?: { key: string; label: string }[]; error?: string }> {
  await requireView("workforce.letters");
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const emp = await prisma.employee.findUnique({ where: { id: employeeId }, select: { branchId: true, supplier: { select: { isOwnCompany: true } } } });
  if (!emp || isOutsideBranch(emp.branchId, branchId, isSuperAdmin)) return { error: "Employee not found." };
  if (!emp.supplier?.isOwnCompany) return { error: "Letters are only made for employees of your own company." };
  const who = await resolveIssuerSupplier(employeeId, issuer);
  if ("error" in who) return { error: who.error };
  const r = await renderEmployeeLetter({ employeeId, templateId, inputs: clean(inputs), canSeePay: can(subjectOf(user), "payroll", "view"), issuerSupplierId: who.supplierId });
  return r.ok ? { html: r.html, title: r.title, missing: r.missing, empty: r.empty, gaps: r.gaps } : { error: r.error };
}

/** Issues the letter: numbers it, stores the exact wording, and records who issued it. */
export async function issueLetterAction(employeeId: string, templateId: string, inputs: Inputs, layoutIn: LayoutInput, allowEmpty = false, editedHtml: string | null = null): Promise<{ id?: string; error?: string }> {
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
  // A one-off image uploaded for this letter must be a stored image; it stands in for the company's own.
  const oneOff = async (id: string | null | undefined) => (id && (await prisma.storedImage.findUnique({ where: { id }, select: { id: true } })) ? id : null);
  const signatureImageId = layoutIn.showSignature ? await oneOff(layoutIn.signatureImageId) : null;
  const stampImageId = layoutIn.showStamp ? await oneOff(layoutIn.stampImageId) : null;
  if (layoutIn.showSignature && !signatureImageId && !issuerOpt.signatureUrl) return { error: `No signature image is uploaded for ${issuerOpt.name} (${issuerOpt.where}).` };
  if (layoutIn.showStamp && !stampImageId && !issuerOpt.stampUrl) return { error: `No stamp is uploaded for ${issuerOpt.name} (${issuerOpt.where}).` };
  // The margins in force now are saved with the letter, so a later change to them never moves an issued letter.
  const marginRow = await prisma.branch.findUnique({ where: { id: emp.branchId }, select: MARGIN_BRANCH_SELECT });
  const m = marginsOfBranch(marginRow);
  const margins = layoutIn.onLetterhead
    ? { top: issuerOpt.topMm, bottom: issuerOpt.bottomMm, left: m.letterheadSides.left, right: m.letterheadSides.right }
    : m.plain;
  // Wording changed for this one letter: cleaned the same way as a template, and it must still say something.
  const edited = typeof editedHtml === "string" && editedHtml.trim() ? sanitizeLetterHtml(editedHtml.slice(0, 40_000)) : null;
  if (edited !== null && htmlToText(edited).length === 0) return { error: "The edited letter is empty." };
  const layout = {
    ...(edited !== null ? { edited: true } : {}),
    modern: true,
    margins,
    issuerKey,
    issuerSupplierId: who.supplierId,
    onLetterhead: !!layoutIn.onLetterhead,
    signatoryName: String(layoutIn.signatoryName ?? "").trim().slice(0, 80) || null,
    signatoryTitle: String(layoutIn.signatoryTitle ?? "").trim().slice(0, 80) || null,
    showSignature: !!layoutIn.showSignature,
    showStamp: !!layoutIn.showStamp,
    signatureImageId,
    stampImageId,
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
  const bodyHtml = edited !== null ? edited.split("LTR-••••••").join(ref) : final.ok ? final.html : substituteInHtml(first.html, { "LTR-••••••": ref });
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


/** Signature or stamp for one letter only: stored, but not made the company's default. */
export async function uploadLetterOneOffImageAction(formData: FormData): Promise<{ error?: string; id?: string; url?: string }> {
  await requireWrite("workforce.letters");
  await requirePermission("workforce.letters", "create");
  const saved = await storeImage(formData.get("image"));
  if ("error" in saved) return { error: saved.error };
  return { id: saved.id, url: `/api/images/${saved.id}` };
}

/** Saves details the letter was missing to the employee's own record, so the next letter has them too. */
export async function fixLetterGapsAction(employeeId: string, values: Record<string, string>): Promise<{ error?: string }> {
  await requireWrite("workforce.employees");
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const emp = await prisma.employee.findUnique({ where: { id: employeeId }, select: { id: true, branchId: true, trade: true, nationality: true, passportNumber: true, emiratesId: true, joinDate: true, wpsBankName: true, wpsIban: true } });
  if (!emp || isOutsideBranch(emp.branchId, branchId, isSuperAdmin)) return { error: "Employee not found." };
  const mayPay = can(subjectOf(user), "payroll", "edit");
  const data: Record<string, string | Date> = {};
  const before: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(values ?? {})) {
    const f = GAP_FIELDS[key];
    const v = String(raw ?? "").trim();
    if (!f || !v) continue;
    if (f.pay && !mayPay) return { error: "Bank details need payroll access. Add them on the employee's Payroll & WPS tab." };
    if (f.column === "joinDate") {
      const d = new Date(`${v}T00:00:00Z`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(d.getTime())) return { error: "Enter the joining date as a full date." };
      data.joinDate = d;
    } else if (f.column === "passportNumber") data.passportNumber = formatMasked("passport", v);
    else if (f.column === "emiratesId") data.emiratesId = formatMasked("eid", v);
    else if (f.column === "wpsIban") data.wpsIban = formatMasked("iban", v);
    else data[f.column] = v.slice(0, 120);
    before[f.column] = emp[f.column];
  }
  if (Object.keys(data).length === 0) return { error: "Fill in at least one detail." };
  await prisma.employee.update({ where: { id: emp.id }, data });
  await logAudit({ entityType: "EMPLOYEE", entityId: emp.id, action: "UPDATE", before, after: data, userId: user.id, userName: user.name, branchId: emp.branchId });
  revalidatePath(`/employees/${emp.id}`);
  return {};
}
