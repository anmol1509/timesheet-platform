"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
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
    const bank = await prisma.bank.findUnique({ where: { id: bankId }, select: { branchId: true } });
    if (!bank || bank.branchId !== branch.id) return { error: "Choose one of this company's bank accounts." };
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
