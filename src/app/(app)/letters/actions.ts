"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUserWithBranch, requirePermission, subjectOf } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { can } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { refLabel, renderEmployeeLetter } from "@/lib/employeeLetter";
import { substituteInHtml } from "@/lib/letterHtml";

type Inputs = Record<string, string>;
export type LayoutInput = { onLetterhead: boolean; signatoryName: string; signatoryTitle: string; showSignature: boolean; showStamp: boolean };
const clean = (inputs: Inputs) => Object.fromEntries(Object.entries(inputs ?? {}).map(([k, v]) => [String(k).slice(0, 120), String(v ?? "").slice(0, 400)]));

/** Live preview: the letter with the employee's real details filled in. Stores nothing. */
export async function previewLetterAction(employeeId: string, templateId: string, inputs: Inputs): Promise<{ html?: string; title?: string; missing?: string[]; empty?: string[]; error?: string }> {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const emp = await prisma.employee.findUnique({ where: { id: employeeId }, select: { branchId: true } });
  if (!emp || isOutsideBranch(emp.branchId, branchId, isSuperAdmin)) return { error: "Employee not found." };
  const r = await renderEmployeeLetter({ employeeId, templateId, inputs: clean(inputs), canSeePay: can(subjectOf(user), "payroll", "view") });
  return r.ok ? { html: r.html, title: r.title, missing: r.missing, empty: r.empty } : { error: r.error };
}

/** Issues the letter: numbers it, stores the exact wording, and records who issued it. */
export async function issueLetterAction(employeeId: string, templateId: string, inputs: Inputs, layoutIn: LayoutInput, allowEmpty = false): Promise<{ id?: string; error?: string }> {
  await requirePermission("workforce", "create");
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const emp = await prisma.employee.findUnique({ where: { id: employeeId }, select: { branchId: true, branch: { select: { signatureId: true, stampId: true } } } });
  if (!emp || isOutsideBranch(emp.branchId, branchId, isSuperAdmin)) return { error: "Employee not found." };

  // Signature and stamp are opt-in and only possible if the company has uploaded them.
  if (layoutIn.showSignature && !emp.branch.signatureId) return { error: "No signature image is uploaded (Settings → Company profile → Letters)." };
  if (layoutIn.showStamp && !emp.branch.stampId) return { error: "No company stamp is uploaded (Settings → Company profile → Letters)." };
  const layout = {
    onLetterhead: !!layoutIn.onLetterhead,
    signatoryName: String(layoutIn.signatoryName ?? "").trim().slice(0, 80) || null,
    signatoryTitle: String(layoutIn.signatoryTitle ?? "").trim().slice(0, 80) || null,
    showSignature: !!layoutIn.showSignature,
    showStamp: !!layoutIn.showStamp,
  };

  const values = clean(inputs);
  const canSeePay = can(subjectOf(user), "payroll", "view");
  const first = await renderEmployeeLetter({ employeeId, templateId, inputs: values, canSeePay });
  if (!first.ok) return { error: first.error };
  if (first.missing.length > 0) return { error: `Fill in: ${first.missing.join(", ")}.` };
  if (first.empty.length > 0 && !allowEmpty) return { error: `${first.employeeName} has no ${first.empty.join(", ").toLowerCase()} on file, so the letter would have a gap. Add it on their record, or tick “Issue anyway”.` };

  // The reference number comes from the database, so create the row first, then write it into the wording.
  const created = await prisma.issuedLetter.create({
    data: { employeeId, templateId, title: first.title, bodyHtml: first.html, inputs: values, layout, issuedById: user.id, branchId: first.branchId },
  });
  const ref = refLabel(created.refNo);
  const final = await renderEmployeeLetter({ employeeId, templateId, inputs: values, canSeePay, refNo: ref });
  const bodyHtml = final.ok ? final.html : substituteInHtml(first.html, { "LTR-••••••": ref });
  await prisma.issuedLetter.update({ where: { id: created.id }, data: { bodyHtml } });
  await logAudit({ entityType: "ISSUED_LETTER", entityId: created.id, action: "CREATE", after: { ref, title: first.title, employee: first.employeeName, template: first.templateName, ...layout }, userId: user.id, userName: user.name, branchId: first.branchId });
  revalidatePath("/letters");
  return { id: created.id };
}
