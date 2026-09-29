"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from "@/lib/constants";

/**
 * The record types a generic attachment may be filed against, each with a lookup
 * for the branch that record really belongs to. An unlisted type is refused
 * rather than trusted.
 */
const ATTACHABLE: Record<string, (id: string) => Promise<{ branchId: string | null } | null>> = {
  SUPPLIER: (id) => prisma.supplier.findUnique({ where: { id }, select: { branchId: true } }),
  SUPPLIER_BILL: (id) => prisma.supplierBill.findUnique({ where: { id }, select: { branchId: true } }),
  EXPENSE: (id) => prisma.expense.findUnique({ where: { id }, select: { branchId: true } }),
  CANDIDATE_ONBOARDING: (id) => prisma.candidateOnboarding.findUnique({ where: { id }, select: { branchId: true } }),
};

// One shared upload path for entity types that don't have a dedicated
// *Document model (Supplier docs today; Payslips/Visa docs in later
// phases), instead of copy-pasting the Document/ClientDocument/
// ProjectDocument upload pattern a fourth time. Takes FormData, matching
// every other document-upload action in the app (e.g.
// addClientDocumentAction), so <AttachmentUploader> is a plain <form>.
//
// The branch a file is stored under is looked up here from the record it is
// attached to. The form still carries an "entityBranchId" hidden field, but it
// is ignored: a hidden field is client-controlled, and trusting it let a user
// name another tenant's record and their own branch, and the check passed.
export async function uploadAttachmentAction(
  formData: FormData
): Promise<{ error?: string } | void> {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();

  const entityType = String(formData.get("entityType") || "");
  const entityId = String(formData.get("entityId") || "");
  const docType = String(formData.get("docType") || "OTHER");
  const expiryRaw = String(formData.get("expiryDate") || "").trim();
  const expiryDate = expiryRaw ? new Date(expiryRaw) : null;
  const revalidate = String(formData.get("revalidate") || "");
  const file = formData.get("file");

  // Every rejection used to be a bare `return`, so an oversize file looked
  // exactly like a broken button. Say what went wrong instead.
  if (!entityType || !entityId) return { error: "Nothing to attach this file to." };
  const lookup = ATTACHABLE[entityType];
  if (!lookup) return { error: "Files can't be attached to that kind of record." };
  const entity = await lookup(entityId);
  if (!entity || isOutsideBranch(entity.branchId, branchId, isSuperAdmin)) {
    return { error: "That record belongs to another branch." };
  }
  const entityBranchId = entity.branchId;
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a file to upload." };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return {
      error: `That file is ${(file.size / 1024 / 1024).toFixed(1)}MB — the limit is ${MAX_UPLOAD_LABEL}.`,
    };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  await prisma.attachment.create({
    data: {
      entityType,
      entityId,
      docType,
      filename: file.name,
      fileData: buffer,
      mimeType: file.type || "application/octet-stream",
      expiryDate,
      branchId: entityBranchId,
      uploadedById: user.id,
    },
  });

  if (revalidate) revalidatePath(revalidate);
}

export async function deleteAttachmentAction(formData: FormData) {
  const { branchId, isSuperAdmin } = await requireUserWithBranch();
  const id = String(formData.get("attachmentId") || "");
  const revalidate = String(formData.get("revalidate") || "");
  if (!id) return;

  const attachment = await prisma.attachment.findUnique({ where: { id }, select: { branchId: true } });
  if (!attachment || isOutsideBranch(attachment.branchId, branchId, isSuperAdmin)) return;

  await prisma.attachment.delete({ where: { id } });
  if (revalidate) revalidatePath(revalidate);
}
