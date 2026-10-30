"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requirePermission, requireUserWithBranch } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { logAudit } from "@/lib/audit";
import { trashDocuments } from "@/lib/trash";
import { rereadExpiry } from "@/lib/importer/rereadExpiry";
import { EXPIRY_FIELD } from "@/lib/importer/documentRead";

/** Deletes the chosen documents (the ones in this branch), with an audit entry for each. */
export async function deleteDocumentsAction(ids: string[]): Promise<{ deleted: number; error?: string }> {
  await requirePermission("workforce", "delete");
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const wanted = [...new Set(ids.filter((id) => typeof id === "string" && id))].slice(0, 200);
  if (wanted.length === 0) return { deleted: 0, error: "Choose at least one document." };

  const docs = await prisma.document.findMany({
    where: { id: { in: wanted } },
    select: { id: true, type: true, filename: true, expiryDate: true, employeeId: true, employee: { select: { branchId: true } } },
  });
  const mine = docs.filter((d) => !isOutsideBranch(d.employee.branchId, branchId, isSuperAdmin));
  if (mine.length === 0) return { deleted: 0, error: "Those documents weren't found." };

  // Restorable copies first: if they can't be kept, nothing is deleted.
  const kept = await trashDocuments(mine.map((d) => d.id), { id: user.id, name: user.name, branchId });
  if (!kept.ok) return { deleted: 0, error: kept.error };

  await prisma.document.deleteMany({ where: { id: { in: mine.map((d) => d.id) } } });
  for (const d of mine) {
    await logAudit({
      entityType: "DOCUMENT",
      entityId: d.id,
      action: "DELETE",
      before: { employeeId: d.employeeId, type: d.type, filename: d.filename, expiryDate: d.expiryDate },
      userId: user.id,
      userName: user.name,
      branchId,
    });
    revalidatePath(`/employees/${d.employeeId}`);
  }
  revalidatePath("/documents");
  return { deleted: mine.length };
}

export type Recheck = { id: string; employee: string; type: string; mime: string; stored: string | null; read: string | null; issue: string | null; confidence: "high" | "medium" | "low"; error?: string };

const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

/** Reads one stored scan again and says what expiry it shows next to what is filed. Nothing is changed. */
export async function recheckDocumentAction(id: string): Promise<Recheck | { error: string }> {
  await requirePermission("workforce", "edit");
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const d = await prisma.document.findUnique({ where: { id }, select: { id: true, type: true, mimeType: true, fileData: true, expiryDate: true, employee: { select: { name: true, employeeIdNo: true, branchId: true } } } });
  if (!d || isOutsideBranch(d.employee.branchId, branchId, isSuperAdmin)) return { error: "That document wasn't found." };
  const r = await rereadExpiry({ bytes: d.fileData, mime: d.mimeType, type: d.type }, { branchId: d.employee.branchId ?? branchId, userId: user.id });
  const base = { id: d.id, employee: `${d.employee.name} · ${d.employee.employeeIdNo}`, type: d.type, mime: d.mimeType, stored: day(d.expiryDate) };
  if ("error" in r) return { ...base, read: null, issue: null, confidence: "low", error: r.error };
  return { ...base, read: r.expiry, issue: r.issue, confidence: r.confidence };
}

/** Files the expiry dates the person approved, on the document and on the employee record it feeds. */
export async function applyExpiriesAction(items: { id: string; expiry: string | null }[]): Promise<{ updated: number; error?: string }> {
  await requirePermission("workforce", "edit");
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const wanted = items.filter((i) => i && typeof i.id === "string" && (i.expiry === null || /^\d{4}-\d{2}-\d{2}$/.test(i.expiry))).slice(0, 100);
  if (wanted.length === 0) return { updated: 0, error: "Choose at least one date." };
  let updated = 0;
  for (const it of wanted) {
    const d = await prisma.document.findUnique({ where: { id: it.id }, select: { id: true, type: true, expiryDate: true, employeeId: true, employee: { select: { branchId: true } } } });
    if (!d || isOutsideBranch(d.employee.branchId, branchId, isSuperAdmin)) continue;
    const next = it.expiry ? new Date(`${it.expiry}T00:00:00.000Z`) : null;
    await prisma.document.update({ where: { id: d.id }, data: { expiryDate: next } });
    // The record keeps the same date as the document it was read from, so it follows when it still held the old one.
    const field = EXPIRY_FIELD.EMPLOYEE[d.type];
    if (field && d.expiryDate) await prisma.employee.updateMany({ where: { id: d.employeeId, [field]: d.expiryDate }, data: { [field]: next } });
    await logAudit({ entityType: "DOCUMENT", entityId: d.id, action: "UPDATE", before: { expiryDate: d.expiryDate }, after: { expiryDate: next, source: "re-read from the scan" }, userId: user.id, userName: user.name, branchId });
    updated++;
  }
  // The documents page itself refreshes when the person closes the review, so the result stays on screen.
  return { updated };
}
