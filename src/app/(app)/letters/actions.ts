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
const clean = (inputs: Inputs) => Object.fromEntries(Object.entries(inputs ?? {}).map(([k, v]) => [String(k).slice(0, 120), String(v ?? "").slice(0, 400)]));

/** Live preview: the letter with the employee's real details filled in. Stores nothing. */
export async function previewLetterAction(employeeId: string, templateId: string, inputs: Inputs): Promise<{ html?: string; title?: string; missing?: string[]; error?: string }> {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const emp = await prisma.employee.findUnique({ where: { id: employeeId }, select: { branchId: true } });
  if (!emp || isOutsideBranch(emp.branchId, branchId, isSuperAdmin)) return { error: "Employee not found." };
  const r = await renderEmployeeLetter({ employeeId, templateId, inputs: clean(inputs), canSeePay: can(subjectOf(user), "payroll", "view") });
  return r.ok ? { html: r.html, title: r.title, missing: r.missing } : { error: r.error };
}

/** Issues the letter: numbers it, stores the exact wording, and records who issued it. */
export async function issueLetterAction(employeeId: string, templateId: string, inputs: Inputs): Promise<{ id?: string; error?: string }> {
  await requirePermission("workforce", "create");
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const emp = await prisma.employee.findUnique({ where: { id: employeeId }, select: { branchId: true } });
  if (!emp || isOutsideBranch(emp.branchId, branchId, isSuperAdmin)) return { error: "Employee not found." };

  const values = clean(inputs);
  const canSeePay = can(subjectOf(user), "payroll", "view");
  const first = await renderEmployeeLetter({ employeeId, templateId, inputs: values, canSeePay });
  if (!first.ok) return { error: first.error };
  if (first.missing.length > 0) return { error: `Fill in: ${first.missing.join(", ")}.` };

  // The reference number comes from the database, so create the row first, then write it into the wording.
  const created = await prisma.issuedLetter.create({
    data: { employeeId, templateId, title: first.title, bodyHtml: first.html, inputs: values, issuedById: user.id, branchId: first.branchId },
  });
  const ref = refLabel(created.refNo);
  const final = await renderEmployeeLetter({ employeeId, templateId, inputs: values, canSeePay, refNo: ref });
  const bodyHtml = final.ok ? final.html : substituteInHtml(first.html, { "LTR-••••••": ref });
  await prisma.issuedLetter.update({ where: { id: created.id }, data: { bodyHtml } });
  await logAudit({ entityType: "ISSUED_LETTER", entityId: created.id, action: "CREATE", after: { ref, title: first.title, employee: first.employeeName, template: first.templateName }, userId: user.id, userName: user.name, branchId: first.branchId });
  revalidatePath("/letters");
  return { id: created.id };
}
