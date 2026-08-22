"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from "@/lib/constants";

// One shared upload path for entity types that don't have a dedicated
// *Document model (Supplier docs today; Payslips/Visa docs in later
// phases), instead of copy-pasting the Document/ClientDocument/
// ProjectDocument upload pattern a fourth time. Takes FormData, matching
// every other document-upload action in the app (e.g.
// addClientDocumentAction), so <AttachmentUploader> is a plain <form>.
//
// The form must include a hidden "entityBranchId" field set server-side by
// the page that renders the uploader (never trust a client-submitted
// branchId) — see AttachmentUploader's `entityBranchId` prop.
export async function uploadAttachmentAction(
  formData: FormData
): Promise<{ error?: string } | void> {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();

  const entityType = String(formData.get("entityType") || "");
  const entityId = String(formData.get("entityId") || "");
  const entityBranchId = String(formData.get("entityBranchId") || "") || null;
  const docType = String(formData.get("docType") || "OTHER");
  const expiryRaw = String(formData.get("expiryDate") || "").trim();
  const expiryDate = expiryRaw ? new Date(expiryRaw) : null;
  const revalidate = String(formData.get("revalidate") || "");
  const file = formData.get("file");

  // Every rejection used to be a bare `return`, so an oversize file looked
  // exactly like a broken button. Say what went wrong instead.
  if (!entityType || !entityId) return { error: "Nothing to attach this file to." };
  if (isOutsideBranch(entityBranchId, branchId, isSuperAdmin)) {
    return { error: "That record belongs to another branch." };
  }
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
