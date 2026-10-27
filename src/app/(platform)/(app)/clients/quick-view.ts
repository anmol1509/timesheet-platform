"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUserWithBranch, subjectOf } from "@/lib/auth";
import { canWrite } from "@/lib/permissions";
import { isOutsideBranch } from "@/lib/branch";
import { logAudit } from "@/lib/audit";
import { assertContactsValid } from "@/lib/validators";
import { checkPartner } from "@/lib/dataChecks";
import { partnerDuplicates } from "@/lib/duplicateCheck";
import { formatMasked } from "@/lib/idFormats";
import { planCompanyScan } from "@/lib/companyScan";
import type { ExtractedCompanyFields } from "@/app/api/documents/extract-company/route";

/**
 * The client quick view: contact, payment terms, trade licence and TRN, with a save that changes one field at a
 * time through the same checks the client form applies. Rates, contract dates, trade rates and contacts beyond the
 * main one stay on the full client page.
 */
const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
const SCOPE = "partners.clients";

export type ClientQuickView = {
  id: string;
  name: string;
  code: string | null;
  status: string;
  emirate: string | null;
  contactPerson: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  paymentTerms: string | null;
  billingAddress: string | null;
  trn: string | null;
  tradeLicenseNumber: string | null;
  tradeLicenseExpiry: string | null;
  documents: { id: string; docType: string; filename: string; expiryDate: string | null }[];
  canEdit: boolean;
};

export async function loadClientQuickViewAction(id: string): Promise<ClientQuickView | null> {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const c = await prisma.client.findUnique({ where: { id } });
  if (!c || isOutsideBranch(c.branchId, branchId, isSuperAdmin)) return null;
  const docs = await prisma.clientDocument.findMany({ where: { clientId: id }, select: { id: true, type: true, filename: true, expiryDate: true }, orderBy: { uploadedAt: "desc" } });
  return {
    id: c.id,
    name: c.name,
    code: c.code,
    status: c.status,
    emirate: c.emirate,
    contactPerson: c.contactPerson,
    contactPhone: c.contactPhone,
    contactEmail: c.contactEmail,
    paymentTerms: c.paymentTerms,
    billingAddress: c.billingAddress,
    trn: c.trn,
    tradeLicenseNumber: c.tradeLicenseNumber,
    tradeLicenseExpiry: iso(c.tradeLicenseExpiry),
    documents: docs.map((d) => ({ id: d.id, docType: d.type, filename: d.filename, expiryDate: iso(d.expiryDate) })),
    canEdit: canWrite(subjectOf(user), SCOPE),
  };
}

const TEXT = new Set(["contactPerson", "contactPhone", "contactEmail", "paymentTerms", "billingAddress", "trn", "tradeLicenseNumber", "emirate"]);
const DATES = new Set(["tradeLicenseExpiry"]);

export type ClientSaveResult = { ok: true; value: string | null; previous: string | null } | { ok?: false; error?: string; warnings?: string[] };

/** Saves one allow-listed field. `confirm` skips the "check this" warnings once the person has seen them. */
export async function saveClientFieldAction(input: { id: string; field: string; value: string | null; confirm?: boolean }): Promise<ClientSaveResult> {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  if (!canWrite(subjectOf(user), SCOPE)) return { error: "You don't have permission to edit clients." };
  const { id, field } = input;
  if (!TEXT.has(field) && !DATES.has(field)) return { error: "That field can't be edited here." };
  const before = await prisma.client.findUnique({ where: { id } });
  if (!before || isOutsideBranch(before.branchId, branchId, isSuperAdmin)) return { error: "That client isn't in this company." };

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
    const dups = field === "tradeLicenseExpiry" ? [] : await partnerDuplicates("client", { [field]: value as string | null, excludeId: id, branchId: before.branchId });
    const warnings = [...checkPartner(next, was), ...dups];
    if (warnings.length > 0) return { warnings };
  }

  await prisma.client.update({ where: { id }, data: { [field]: value } });
  const prev = (before as Record<string, unknown>)[field];
  await logAudit({ entityType: "CLIENT", entityId: id, action: "UPDATE", before: { [field]: prev }, after: { [field]: value }, userId: user.id, userName: user.name, branchId });
  revalidatePath(`/clients/${id}`);
  revalidatePath("/clients");
  const out = (v: unknown) => (v instanceof Date ? iso(v) : ((v as string | null) ?? null));
  return { ok: true, value: out(value), previous: out(prev) };
}

export async function applyClientScanAction(input: { id: string; fields: ExtractedCompanyFields }) {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  if (!canWrite(subjectOf(user), SCOPE)) return { error: "You don't have permission to edit clients." };
  const before = await prisma.client.findUnique({ where: { id: input.id } });
  if (!before || isOutsideBranch(before.branchId, branchId, isSuperAdmin)) return { error: "That client isn't in this company." };

  // A client has no MOHRE permit.
  const { result, data, was } = planCompanyScan(before as Record<string, unknown>, input.fields, ["mohrePermitNumber"]);
  if (result.applied.length === 0) return result;

  await prisma.client.update({ where: { id: input.id }, data });
  await logAudit({ entityType: "CLIENT", entityId: input.id, action: "UPDATE", before: was, after: data, userId: user.id, userName: user.name, branchId });
  revalidatePath(`/clients/${input.id}`);
  revalidatePath("/clients");
  return result;
}
