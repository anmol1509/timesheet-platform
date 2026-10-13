"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUserWithBranch, requireWrite } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { logAudit } from "@/lib/audit";
import { PAPERS, PAPER_BY_KEY, seedPapers, type PaperKey } from "@/lib/papers";
import { refreshPapersPending } from "@/lib/papersDb";

const text = (v: FormDataEntryValue | null) => String(v ?? "").trim() || null;
const date = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
};

async function loadEmployee(employeeId: string, branchId: string | null, isSuperAdmin: boolean) {
  const e = await prisma.employee.findUnique({ where: { id: employeeId }, select: { id: true, name: true, branchId: true } });
  return e && !isOutsideBranch(e.branchId, branchId, isSuperAdmin) ? e : null;
}

/** Starts the papers checklist for a worker, carrying over what their onboarding recorded when they came from a candidate. */
export async function startPapersAction(formData: FormData): Promise<{ error: string | null }> {
  await requireWrite("workforce.employees");
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const employeeId = String(formData.get("employeeId") || "");
  const emp = await loadEmployee(employeeId, branchId, isSuperAdmin);
  if (!emp) return { error: "Employee not found." };
  if ((await prisma.employeePaper.count({ where: { employeeId } })) > 0) return { error: null };

  const candidate = await prisma.candidateOnboarding.findFirst({ where: { employeeId }, include: { history: true } });
  const rows = seedPapers((candidate ?? {}) as unknown as Record<string, string>, candidate?.history ?? []);
  await prisma.employeePaper.createMany({ data: rows.map((r) => ({ employeeId, item: r.item, status: r.status, statusDate: r.statusDate, referenceNo: r.referenceNo, expiryDate: r.expiryDate, updatedById: user.id })), skipDuplicates: true });
  await refreshPapersPending(employeeId);
  await logAudit({ entityType: "EMPLOYEE", entityId: employeeId, action: "UPDATE", before: { arrivalPapers: "not tracked" }, after: { arrivalPapers: candidate ? "started from onboarding" : "started" }, userId: user.id, userName: user.name, branchId: emp.branchId });
  revalidatePath(`/employees/${employeeId}`);
  return { error: null };
}

/** Records a status, date, reference and expiry for one paper. An expiry also updates the worker's own expiry field, so alerts see it. */
export async function updatePaperAction(formData: FormData): Promise<{ error: string | null; pending?: boolean }> {
  await requireWrite("workforce.employees");
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const employeeId = String(formData.get("employeeId") || "");
  const item = String(formData.get("item") || "") as PaperKey;
  const paper = PAPER_BY_KEY[item];
  if (!paper) return { error: "Unknown paper." };
  const emp = await loadEmployee(employeeId, branchId, isSuperAdmin);
  if (!emp) return { error: "Employee not found." };

  const status = String(formData.get("status") || "").trim();
  if (!paper.statuses.some((s) => s.value === status)) return { error: "Choose a valid status." };
  const statusDate = date(formData.get("statusDate")) ?? (status === "Pending" ? null : new Date());
  const referenceNo = text(formData.get("referenceNo"));
  const expiryDate = date(formData.get("expiryDate"));
  const remarks = text(formData.get("remarks"));

  const before = await prisma.employeePaper.findUnique({ where: { employeeId_item: { employeeId, item } } });
  await prisma.employeePaper.upsert({
    where: { employeeId_item: { employeeId, item } },
    create: { employeeId, item, status, statusDate, referenceNo, expiryDate, remarks, updatedById: user.id },
    update: { status, statusDate, referenceNo, expiryDate, remarks, updatedById: user.id },
  });
  if (expiryDate && paper.expiryField) await prisma.employee.update({ where: { id: employeeId }, data: { [paper.expiryField]: expiryDate } });
  // Make sure every paper has a row so the checklist is complete, then work out whether papers are still pending.
  await prisma.employeePaper.createMany({ data: PAPERS.filter((p) => p.key !== item).map((p) => ({ employeeId, item: p.key, updatedById: user.id })), skipDuplicates: true });
  const pending = await refreshPapersPending(employeeId);

  await logAudit({
    entityType: "EMPLOYEE", entityId: employeeId, action: "UPDATE",
    before: { [paper.label]: before?.status ?? "Pending" }, after: { [paper.label]: status },
    userId: user.id, userName: user.name, branchId: emp.branchId,
  });
  revalidatePath(`/employees/${employeeId}`);
  revalidatePath("/employees");
  return { error: null, pending };
}
