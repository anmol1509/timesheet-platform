"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { isUsableBank } from "@/lib/bankStatus";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { deleteImage, storeImage } from "@/lib/storedImage";

type State = { error: string | null; ok?: boolean };

/** A branch admin may only touch their own branch; a super admin any. */
async function loadEditableBranch(branchId: string) {
  const admin = await requireAdmin();
  if (admin.role !== "SUPER_ADMIN" && admin.branchId !== branchId) return { admin, branch: null };
  const branch = await prisma.branch.findUnique({ where: { id: branchId } });
  return { admin, branch };
}

const FIELDS = ["name", "emirate", "address", "country", "currency", "phone", "email", "fax", "poBox", "trn"] as const;

export async function updateCompanyAction(_prev: State, formData: FormData): Promise<State> {
  const branchId = String(formData.get("branchId") || "");
  const { admin, branch } = await loadEditableBranch(branchId);
  if (!branch) return { error: "You can't edit that company." };

  const value = (k: string) => String(formData.get(k) || "").trim();
  const name = value("name");
  if (!name) return { error: "Company name can't be empty." };
  const data = {
    name,
    emirate: value("emirate") || null,
    address: value("address") || null,
    country: value("country") || null,
    currency: value("currency") || null,
    phone: value("phone") || null,
    email: value("email") || null,
    fax: value("fax") || null,
    poBox: value("poBox") || null,
    trn: value("trn") || null,
  };

  await prisma.branch.update({ where: { id: branch.id }, data });
  await logAudit({
    entityType: "BRANCH",
    entityId: branch.id,
    action: "UPDATE",
    before: Object.fromEntries(FIELDS.map((f) => [f, branch[f]])),
    after: data,
    userId: admin.id,
    userName: admin.name,
    branchId: branch.id,
  });
  revalidatePath("/", "layout");
  return { error: null, ok: true };
}

export async function uploadLogoAction(formData: FormData) {
  const { admin, branch } = await loadEditableBranch(String(formData.get("branchId") || ""));
  if (!branch) return { error: "You can't edit that company." };
  const saved = await storeImage(formData.get("image"));
  if ("error" in saved) return { error: saved.error };
  await prisma.branch.update({ where: { id: branch.id }, data: { logoId: saved.id } });
  await deleteImage(branch.logoId);
  await logAudit({
    entityType: "BRANCH",
    entityId: branch.id,
    action: "UPDATE",
    before: { logo: branch.logoId ? "(set)" : null },
    after: { logo: "(replaced)" },
    userId: admin.id,
    userName: admin.name,
    branchId: branch.id,
  });
  revalidatePath("/", "layout");
  return { error: null };
}

export async function removeLogoAction(formData: FormData) {
  const { admin, branch } = await loadEditableBranch(String(formData.get("branchId") || ""));
  if (!branch) return { error: "You can't edit that company." };
  await prisma.branch.update({ where: { id: branch.id }, data: { logoId: null } });
  await deleteImage(branch.logoId);
  await logAudit({
    entityType: "BRANCH",
    entityId: branch.id,
    action: "UPDATE",
    before: { logo: "(set)" },
    after: { logo: null },
    userId: admin.id,
    userName: admin.name,
    branchId: branch.id,
  });
  revalidatePath("/", "layout");
  return { error: null };
}

export async function updateWpsAction(_prev: State, formData: FormData): Promise<State> {
  const { admin, branch } = await loadEditableBranch(String(formData.get("branchId") || ""));
  if (!branch) return { error: "You can't edit that company." };

  const establishmentId = String(formData.get("wpsEstablishmentId") || "").trim() || null;
  if (establishmentId && !/^\d{8,15}$/.test(establishmentId)) {
    return { error: "The MOHRE establishment ID should be digits only (usually 13)." };
  }
  const bankId = String(formData.get("wpsPayerBankId") || "") || null;
  if (bankId) {
    const bank = await prisma.bank.findUnique({ where: { id: bankId } });
    if (!bank || bank.branchId !== branch.id) return { error: "Choose one of this company's bank accounts." };
    if (!isUsableBank(bank)) return { error: "That bank account isn't active yet. Add its account number and IBAN under Banks first." };
  }

  await prisma.branch.update({ where: { id: branch.id }, data: { wpsEstablishmentId: establishmentId, wpsPayerBankId: bankId } });
  await logAudit({
    entityType: "BRANCH",
    entityId: branch.id,
    action: "UPDATE",
    before: { wpsEstablishmentId: branch.wpsEstablishmentId, wpsPayerBankId: branch.wpsPayerBankId },
    after: { wpsEstablishmentId: establishmentId, wpsPayerBankId: bankId },
    userId: admin.id,
    userName: admin.name,
    branchId: branch.id,
  });
  revalidatePath("/settings/company");
  revalidatePath("/payroll");
  return { error: null, ok: true };
}

// ---- Letters: signatory, signature, stamp, letterhead ---------------------------------
const LETTER_IMAGES = {
  signature: { column: "signatureId", label: "signature" },
  stamp: { column: "stampId", label: "stamp" },
  letterhead: { column: "letterheadImageId", label: "letterhead" },
} as const;
type LetterImageKind = keyof typeof LETTER_IMAGES;
const asKind = (v: FormDataEntryValue | null): LetterImageKind | null => (typeof v === "string" && v in LETTER_IMAGES ? (v as LetterImageKind) : null);

export async function updateLetterDefaultsAction(_prev: State, formData: FormData): Promise<State> {
  const { admin, branch } = await loadEditableBranch(String(formData.get("branchId") || ""));
  if (!branch) return { error: "You can't edit that company." };
  const signatoryName = String(formData.get("signatoryName") || "").trim().slice(0, 80) || null;
  const signatoryTitle = String(formData.get("signatoryTitle") || "").trim().slice(0, 80) || null;
  await prisma.branch.update({ where: { id: branch.id }, data: { signatoryName, signatoryTitle } });
  await logAudit({ entityType: "BRANCH", entityId: branch.id, action: "UPDATE", before: { signatoryName: branch.signatoryName, signatoryTitle: branch.signatoryTitle }, after: { signatoryName, signatoryTitle }, userId: admin.id, userName: admin.name, branchId: branch.id });
  revalidatePath("/settings/company");
  revalidatePath("/letters");
  return { error: null, ok: true };
}

export async function uploadLetterImageAction(formData: FormData) {
  const kind = asKind(formData.get("kind"));
  const { admin, branch } = await loadEditableBranch(String(formData.get("branchId") || ""));
  if (!branch || !kind) return { error: "You can't edit that company." };
  const saved = await storeImage(formData.get("image"));
  if ("error" in saved) return { error: saved.error };
  const { column, label } = LETTER_IMAGES[kind];
  const previous = branch[column];
  await prisma.branch.update({ where: { id: branch.id }, data: { [column]: saved.id } });
  await deleteImage(previous);
  await logAudit({ entityType: "BRANCH", entityId: branch.id, action: "UPDATE", before: { [label]: previous ? "(set)" : null }, after: { [label]: "(replaced)" }, userId: admin.id, userName: admin.name, branchId: branch.id });
  revalidatePath("/settings/company");
  revalidatePath("/letters");
  return { error: null };
}

export async function removeLetterImageAction(formData: FormData) {
  const kind = asKind(formData.get("kind"));
  const { admin, branch } = await loadEditableBranch(String(formData.get("branchId") || ""));
  if (!branch || !kind) return { error: "You can't edit that company." };
  const { column, label } = LETTER_IMAGES[kind];
  const previous = branch[column];
  await prisma.branch.update({ where: { id: branch.id }, data: { [column]: null } });
  await deleteImage(previous);
  await logAudit({ entityType: "BRANCH", entityId: branch.id, action: "UPDATE", before: { [label]: "(set)" }, after: { [label]: null }, userId: admin.id, userName: admin.name, branchId: branch.id });
  revalidatePath("/settings/company");
  revalidatePath("/letters");
  return { error: null };
}
