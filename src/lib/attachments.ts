"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUserWithBranch, requireWrite, subjectOf } from "@/lib/auth";
import { canMyCompanies, canViewSensitive } from "@/lib/permissions";
import { ownDocIsConfidential } from "@/lib/ownCompany";
import { isOutsideBranch } from "@/lib/branch";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from "@/lib/constants";
import { resolveDocTypes, VEHICLE_EXPIRY_FIELD } from "@/lib/documentTypes";
import { otherDocFilename } from "@/lib/otherDoc";

/**
 * The record types a generic attachment may be filed against, each with a lookup
 * for the branch that record really belongs to. An unlisted type is refused
 * rather than trusted.
 */
const ATTACHABLE: Record<string, (id: string) => Promise<{ branchId: string | null } | null>> = {
  SUPPLIER: (id) => prisma.supplier.findUnique({ where: { id }, select: { branchId: true } }),
  VEHICLE: (id) => prisma.vehicle.findUnique({ where: { id }, select: { branchId: true } }),
  SUPPLIER_PARTY: (id) => prisma.supplierParty.findUnique({ where: { id }, select: { branchId: true } }),
  SUPPLIER_BILL: (id) => prisma.supplierBill.findUnique({ where: { id }, select: { branchId: true } }),
  EXPENSE: (id) => prisma.expense.findUnique({ where: { id }, select: { branchId: true } }),
  QUOTATION: (id) => prisma.quotation.findUnique({ where: { id }, select: { branchId: true } }),
  ENQUIRY: (id) => prisma.enquiry.findUnique({ where: { id }, select: { branchId: true } }),
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
  if (entityType === "VEHICLE") await requireWrite("facilities.transport");
  if (entityType === "SUPPLIER_PARTY" && !canViewSensitive(subjectOf(user))) return { error: "You don't have permission to add owner and sponsor documents." };
  const lookup = ATTACHABLE[entityType];
  if (!lookup) return { error: "Files can't be attached to that kind of record." };
  const entity = await lookup(entityId);
  if (!entity || isOutsideBranch(entity.branchId, branchId, isSuperAdmin)) {
    return { error: "That record belongs to another branch." };
  }
  const entityBranchId = entity.branchId;
  if (entityType === "SUPPLIER" && ownDocIsConfidential(docType) && !canMyCompanies(subjectOf(user), "edit")) {
    const owner = await prisma.supplier.findUnique({ where: { id: entityId }, select: { isOwnCompany: true } });
    if (owner?.isOwnCompany) return { error: "Adding your own companies' documents needs My Companies access." };
  }
  // Company and owner/sponsor files must be one of the branch's document types (built-in or its own).
  if (entityType === "SUPPLIER" || entityType === "SUPPLIER_PARTY" || entityType === "VEHICLE") {
    const rows = entityBranchId ? await prisma.documentType.findMany({ where: { branchId: entityBranchId } }) : [];
    const known = resolveDocTypes(rows, entityType).find((t) => t.key === docType);
    // Older files used types the registry doesn't list (e.g. WORKMEN_COMPENSATION_INSURANCE), so SUPPLIER keeps those.
    if (entityType !== "SUPPLIER" && !known) return { error: "Choose one of the listed document types." };
    if (known && !known.isActive) return { error: `"${known.label}" is switched off for this branch.` };
  }
  // A candidate's file is a listed candidate document or a stage's own paper (offer, entry permit...); only a switched-off type is refused.
  if (entityType === "CANDIDATE_ONBOARDING") {
    const rows = entityBranchId ? await prisma.documentType.findMany({ where: { branchId: entityBranchId } }) : [];
    const known = resolveDocTypes(rows, "CANDIDATE").find((t) => t.key === docType);
    if (known && !known.isActive) return { error: `"${known.label}" is switched off for this branch.` };
  }
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a file to upload." };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return {
      error: `That file is ${(file.size / 1024 / 1024).toFixed(1)}MB: the limit is ${MAX_UPLOAD_LABEL}.`,
    };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  await prisma.attachment.create({
    data: {
      entityType,
      entityId,
      docType,
      // "Other" files are named by the person (or read from the file); the extension is kept so the file still opens.
      filename: docType === "OTHER" ? otherDocFilename(String(formData.get("name") || ""), file.name) : file.name,
      fileData: buffer,
      mimeType: file.type || "application/octet-stream",
      expiryDate,
      branchId: entityBranchId,
      uploadedById: user.id,
    },
  });

  if (entityType === "VEHICLE") await syncVehicleExpiries(entityId);
  if (revalidate) revalidatePath(revalidate);
}

export async function deleteAttachmentAction(formData: FormData) {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const id = String(formData.get("attachmentId") || "");
  const revalidate = String(formData.get("revalidate") || "");
  if (!id) return;

  const attachment = await prisma.attachment.findUnique({ where: { id }, select: { branchId: true, entityType: true, entityId: true, docType: true } });
  if (!attachment || isOutsideBranch(attachment.branchId, branchId, isSuperAdmin)) return;

  if (attachment.entityType === "VEHICLE") await requireWrite("facilities.transport");
  if (attachment.entityType === "SUPPLIER_PARTY" && !canViewSensitive(subjectOf(user))) return;
  if (attachment.entityType === "SUPPLIER" && ownDocIsConfidential(attachment.docType) && !canMyCompanies(subjectOf(user), "edit")) {
    const owner = await prisma.supplier.findUnique({ where: { id: attachment.entityId }, select: { isOwnCompany: true } });
    if (owner?.isOwnCompany) return;
  }
  await prisma.attachment.delete({ where: { id } });
  if (attachment.entityType === "VEHICLE") await syncVehicleExpiries(attachment.entityId);
  if (revalidate) revalidatePath(revalidate);
}

/**
 * A vehicle's Mulkiya and insurance dates feed the dashboards and the renewal queue, which read them off the vehicle.
 * Once a file with an expiry is filed for one, the vehicle's date follows the latest file. A vehicle with no such file
 * keeps whatever was typed in by hand.
 */
async function syncVehicleExpiries(vehicleId: string) {
  const data: Record<string, Date> = {};
  for (const [docType, field] of Object.entries(VEHICLE_EXPIRY_FIELD)) {
    const latest = await prisma.attachment.findFirst({
      where: { entityType: "VEHICLE", entityId: vehicleId, docType, expiryDate: { not: null } },
      orderBy: { expiryDate: "desc" },
      select: { expiryDate: true },
    });
    if (latest?.expiryDate) data[field] = latest.expiryDate;
  }
  if (Object.keys(data).length) await prisma.vehicle.update({ where: { id: vehicleId }, data });
}
