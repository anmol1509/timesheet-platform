"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUserWithBranch, subjectOf } from "@/lib/auth";
import { canWrite, can } from "@/lib/permissions";
import { isOutsideBranch } from "@/lib/branch";
import { logAudit } from "@/lib/audit";
import { assertContactsValid } from "@/lib/validators";
import { checkPartner } from "@/lib/dataChecks";
import { partnerDuplicates } from "@/lib/duplicateCheck";
import { formatMasked } from "@/lib/idFormats";
import { planCompanyScan } from "@/lib/companyScan";
import type { ExtractedCompanyFields } from "@/app/api/documents/extract-company/route";

/**
 * The supplier quick view: the details people fix most (contact, licence, TRN) and a save that changes one field
 * at a time through the same checks the supplier form applies. Bank details, status (blacklisting) and the pay
 * rules stay on the full supplier page, where they ask for the care they need.
 */
const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
const SCOPE = "partners.suppliers";

export type SupplierQuickView = {
  id: string;
  name: string;
  code: string | null;
  category: string | null;
  status: string;
  isOwnCompany: boolean;
  parentName: string | null;
  contactPerson: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  paymentTerms: string | null;
  trn: string | null;
  tradeLicenseNumber: string | null;
  tradeLicenseExpiry: string | null;
  mohrePermitNumber: string | null;
  approvals: { project: string; labour: string; invoicing: string };
  attachments: { id: string; docType: string; filename: string; expiryDate: string | null }[];
  canEdit: boolean;
  canApprove: boolean;
};

export async function loadSupplierQuickViewAction(id: string): Promise<SupplierQuickView | null> {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const s = await prisma.supplier.findUnique({ where: { id }, include: { parent: { select: { name: true } } } });
  if (!s || isOutsideBranch(s.branchId, branchId, isSuperAdmin)) return null;
  const attachments = await prisma.attachment.findMany({
    where: { entityType: "SUPPLIER", entityId: id },
    select: { id: true, docType: true, filename: true, expiryDate: true },
    orderBy: { uploadedAt: "desc" },
  });
  const subject = subjectOf(user);
  return {
    id: s.id,
    name: s.name,
    code: s.code,
    category: s.category,
    status: s.status,
    isOwnCompany: s.isOwnCompany,
    parentName: s.parent?.name ?? null,
    contactPerson: s.contactPerson,
    contactPhone: s.contactPhone,
    contactEmail: s.contactEmail,
    paymentTerms: s.paymentTerms,
    trn: s.trn,
    tradeLicenseNumber: s.tradeLicenseNumber,
    tradeLicenseExpiry: iso(s.tradeLicenseExpiry),
    mohrePermitNumber: s.mohrePermitNumber,
    approvals: { project: s.approvalStatus, labour: s.labourApprovalStatus, invoicing: s.invoiceApprovalStatus },
    attachments: attachments.map((a) => ({ id: a.id, docType: a.docType, filename: a.filename, expiryDate: iso(a.expiryDate) })),
    canEdit: canWrite(subject, SCOPE),
    canApprove: can(subject, SCOPE, "approve"),
  };
}

const TEXT = new Set(["contactPerson", "contactPhone", "contactEmail", "category", "paymentTerms", "trn", "tradeLicenseNumber", "mohrePermitNumber", "emirate"]);
const DATES = new Set(["tradeLicenseExpiry"]);

export type SupplierSaveResult = { ok: true; value: string | null; previous: string | null } | { ok?: false; error?: string; warnings?: string[] };

/** Saves one allow-listed field. `confirm` skips the "check this" warnings once the person has seen them. */
export async function saveSupplierFieldAction(input: { id: string; field: string; value: string | null; confirm?: boolean }): Promise<SupplierSaveResult> {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  if (!canWrite(subjectOf(user), SCOPE)) return { error: "You don't have permission to edit suppliers." };
  const { id, field } = input;
  if (!TEXT.has(field) && !DATES.has(field)) return { error: "That field can't be edited here." };
  const before = await prisma.supplier.findUnique({ where: { id } });
  if (!before || isOutsideBranch(before.branchId, branchId, isSuperAdmin)) return { error: "That supplier isn't in this branch." };

  const raw = (input.value ?? "").trim();
  let value: string | Date | null = raw || null;
  if (DATES.has(field) && value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value as string) || Number.isNaN(new Date(value as string).getTime())) return { error: "Enter a valid date." };
    value = new Date(value as string);
  }
  if (field === "trn" && typeof value === "string") value = formatMasked("trn", value) || null;

  try {
    const f = new FormData();
    if (typeof value === "string") f.set(field, value);
    assertContactsValid(f);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "That value isn't valid." };
  }

  if (!input.confirm && (field === "trn" || field === "tradeLicenseNumber" || field === "tradeLicenseExpiry")) {
    const next = { trn: before.trn, tradeLicenseNumber: before.tradeLicenseNumber, tradeLicenseExpiry: before.tradeLicenseExpiry };
    const was = { ...next };
    (next as Record<string, unknown>)[field] = value;
    const dups = field === "tradeLicenseExpiry" ? [] : await partnerDuplicates("supplier", { [field]: value as string | null, excludeId: id, branchId: before.branchId });
    const warnings = [...checkPartner(next, was), ...dups];
    if (warnings.length > 0) return { warnings };
  }

  await prisma.supplier.update({ where: { id }, data: { [field]: value } });
  const prev = (before as Record<string, unknown>)[field];
  await logAudit({ entityType: "SUPPLIER", entityId: id, action: "UPDATE", before: { [field]: prev }, after: { [field]: value }, userId: user.id, userName: user.name, branchId });
  revalidatePath(`/suppliers/${id}`);
  revalidatePath("/suppliers");
  const out = (v: unknown) => (v instanceof Date ? iso(v) : ((v as string | null) ?? null));
  return { ok: true, value: out(value), previous: out(prev) };
}

export type SupplierScanResult = {
  applied: { key: string; label: string; value: string }[];
  conflicts: { key: string; label: string; current: string; scan: string }[];
};

/**
 * Puts what a scanned company document says onto the supplier. Empty fields are filled, a later licence expiry
 * replaces an older one, and anything else that disagrees with the record comes back as a conflict to choose
 * from. A trade licence's own expiry only counts when the document is a trade licence.
 */
export async function applySupplierScanAction(input: { id: string; fields: ExtractedCompanyFields }): Promise<SupplierScanResult | { error: string }> {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  if (!canWrite(subjectOf(user), SCOPE)) return { error: "You don't have permission to edit suppliers." };
  const before = await prisma.supplier.findUnique({ where: { id: input.id } });
  if (!before || isOutsideBranch(before.branchId, branchId, isSuperAdmin)) return { error: "That supplier isn't in this branch." };

  const { result, data, was } = planCompanyScan(before as Record<string, unknown>, input.fields, []);
  if (result.applied.length === 0) return result;

  await prisma.supplier.update({ where: { id: input.id }, data });
  await logAudit({ entityType: "SUPPLIER", entityId: input.id, action: "UPDATE", before: was, after: data, userId: user.id, userName: user.name, branchId });
  revalidatePath(`/suppliers/${input.id}`);
  revalidatePath("/suppliers");
  return result;
}
