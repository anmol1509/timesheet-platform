"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requirePermission, requireUserWithBranch } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { logAudit } from "@/lib/audit";
import { approveWorkerSubmission, applyChangeRequest } from "@/lib/supplierRequestsApply";
import { notifySupplier } from "@/lib/vendor/notify";
import { assertContactsValid } from "@/lib/validators";

type State = { error: string | null; ok?: boolean };
const str = (v: FormDataEntryValue | null) => String(v ?? "").trim();

async function loadSubmission(id: string) {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const sub = await prisma.workerSubmission.findUnique({ where: { id }, include: { supplier: { select: { id: true, name: true } } } });
  if (!sub || isOutsideBranch(sub.branchId, branchId, isSuperAdmin)) return { user, sub: null };
  return { user, sub };
}

/** Approve a supplier's new worker: creates the real Employee, with an ID continuing the supplier's series. */
export async function approveWorkerAction(formData: FormData): Promise<State> {
  assertContactsValid(formData);
  await requirePermission("partners", "edit");
  const { user, sub } = await loadSubmission(str(formData.get("id")));
  if (!sub) return { error: "Submission not found." };
  const r = await approveWorkerSubmission(sub.id, user.id);
  if (!r.ok) return { error: r.error };
  await notifySupplier({ supplierId: sub.supplierId, kind: "WORKER_DECISION", title: `${r.name} was approved`, body: `Added to your workers as ${r.employeeIdNo}.`, href: "/vendor/workers" });
  await logAudit({ entityType: "EMPLOYEE", entityId: r.employeeId, action: "CREATE", after: { employeeIdNo: r.employeeIdNo, name: r.name, supplier: r.supplier, source: "supplier portal submission" }, userId: user.id, userName: user.name, branchId: r.branchId });
  revalidatePath("/suppliers/requests");
  return { error: null, ok: true };
}

export async function rejectWorkerAction(formData: FormData): Promise<State> {
  assertContactsValid(formData);
  await requirePermission("partners", "edit");
  const { user, sub } = await loadSubmission(str(formData.get("id")));
  if (!sub) return { error: "Submission not found." };
  if (sub.status !== "PENDING") return { error: `Already ${sub.status.toLowerCase()}.` };
  const note = str(formData.get("note"));
  if (!note) return { error: "Say why, so the supplier can fix it." };
  await prisma.workerSubmission.update({ where: { id: sub.id }, data: { status: "REJECTED", note, decidedAt: new Date(), decidedById: user.id } });
  await notifySupplier({ supplierId: sub.supplierId, kind: "WORKER_DECISION", title: `${sub.firstName} ${sub.lastName} was not approved`, body: note, href: "/vendor/workers" });
  await logAudit({ entityType: "WORKER_SUBMISSION", entityId: sub.id, action: "UPDATE", before: { status: "PENDING" }, after: { status: "REJECTED", note, supplier: sub.supplier.name }, userId: user.id, userName: user.name, branchId: sub.branchId });
  revalidatePath("/suppliers/requests");
  return { error: null, ok: true };
}

async function loadChange(id: string) {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const req = await prisma.supplierChangeRequest.findUnique({ where: { id }, include: { supplier: true } });
  if (!req || isOutsideBranch(req.branchId, branchId, isSuperAdmin)) return { user, req: null };
  return { user, req };
}

/** Apply an approved change to the supplier's record, writing only whitelisted fields. */
export async function approveChangeAction(formData: FormData): Promise<State> {
  assertContactsValid(formData);
  await requirePermission("partners", "edit");
  const { user, req } = await loadChange(str(formData.get("id")));
  if (!req) return { error: "Request not found." };
  const r = await applyChangeRequest(req.id, user.id);
  if (!r.ok) return { error: r.error };
  await notifySupplier({ supplierId: r.supplierId, kind: "CHANGE_DECISION", title: `Your ${r.kind === "BANK" ? "bank" : "contact"} details change was approved`, body: "It's now on your record.", href: "/vendor/profile" });
  await logAudit({ entityType: "SUPPLIER", entityId: r.supplierId, action: "UPDATE", before: r.before, after: { ...r.after, approvedFromPortalRequest: r.kind }, userId: user.id, userName: user.name, branchId: r.branchId });
  revalidatePath("/suppliers/requests");
  revalidatePath(`/suppliers/${r.supplierId}`);
  return { error: null, ok: true };
}

export async function rejectChangeAction(formData: FormData): Promise<State> {
  assertContactsValid(formData);
  await requirePermission("partners", "edit");
  const { user, req } = await loadChange(str(formData.get("id")));
  if (!req) return { error: "Request not found." };
  if (req.status !== "PENDING") return { error: `Already ${req.status.toLowerCase()}.` };
  const note = str(formData.get("note"));
  if (!note) return { error: "Say why, so the supplier can fix it." };
  await prisma.supplierChangeRequest.update({ where: { id: req.id }, data: { status: "REJECTED", note, decidedAt: new Date(), decidedById: user.id } });
  await notifySupplier({ supplierId: req.supplierId, kind: "CHANGE_DECISION", title: `Your ${req.kind === "BANK" ? "bank" : "contact"} details change was not approved`, body: note, href: "/vendor/profile" });
  await logAudit({ entityType: "SUPPLIER_CHANGE_REQUEST", entityId: req.id, action: "UPDATE", before: { status: "PENDING" }, after: { status: "REJECTED", note, supplier: req.supplier.name, kind: req.kind }, userId: user.id, userName: user.name, branchId: req.branchId });
  revalidatePath("/suppliers/requests");
  return { error: null, ok: true };
}
