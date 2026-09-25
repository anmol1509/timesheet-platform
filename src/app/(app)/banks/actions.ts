"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUserWithBranch, requirePermission } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { logAudit } from "@/lib/audit";
import { validateBankFields } from "@/lib/bankStatus";
import { assertContactsValid } from "@/lib/validators";

type State = { error: string | null; ok?: boolean; id?: string };
const s = (v: FormDataEntryValue | null) => String(v ?? "").trim();
const orNull = (v: FormDataEntryValue | null) => s(v) || null;
const ACCOUNT_TYPES = ["CURRENT", "SAVINGS", "CREDIT", "OTHER"];

async function readFields(formData: FormData, branchId: string) {
  const accountName = s(formData.get("accountName"));
  const bankName = s(formData.get("bankName"));
  if (!accountName || !bankName) return { ok: false as const, error: "Enter the account name and the bank name." };

  const ibanRaw = orNull(formData.get("ibanNo"));
  const data = {
    accountName, bankName,
    abbreviation: orNull(formData.get("abbreviation")),
    accountType: ACCOUNT_TYPES.includes(s(formData.get("accountType"))) ? s(formData.get("accountType")) : null,
    currency: (s(formData.get("currency")) || "AED").toUpperCase().slice(0, 3),
    accountNo: orNull(formData.get("accountNo")),
    ibanNo: ibanRaw ? ibanRaw.replace(/\s+/g, "").toUpperCase() : null,
    routingCode: orNull(formData.get("routingCode")),
    swiftCode: orNull(formData.get("swiftCode"))?.toUpperCase() ?? null,
    bankBranch: orNull(formData.get("bankBranch")),
    address: orNull(formData.get("address")),
    contactPerson: orNull(formData.get("contactPerson")),
    contactPhone: orNull(formData.get("contactPhone")),
    contactEmail: orNull(formData.get("contactEmail")),
    remarks: orNull(formData.get("remarks")),
  };
  const bad = validateBankFields(data);
  if (bad) return { ok: false as const, error: bad };

  // Which own company holds it: must be one of this branch's own companies.
  const companyId = orNull(formData.get("companyId"));
  if (companyId) {
    const c = await prisma.supplier.findFirst({ where: { id: companyId, isOwnCompany: true, branchId }, select: { id: true } });
    if (!c) return { ok: false as const, error: "Choose one of your own companies." };
  }
  return { ok: true as const, data: { ...data, companyId } };
}

async function inBranch(bankId: string, branchId: string | null, isSuperAdmin: boolean) {
  const bank = await prisma.bank.findUnique({ where: { id: bankId }, select: { branchId: true } });
  return !!bank && !isOutsideBranch(bank.branchId, branchId, isSuperAdmin);
}

export async function createBankAction(_prev: State, formData: FormData): Promise<State> {
  assertContactsValid(formData);
  await requirePermission("partners", "create");
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  if (!branchId) return { error: isSuperAdmin ? "Pick a branch from the switcher before adding a bank." : "Your account has no branch assigned — contact an admin." };
  const r = await readFields(formData, branchId);
  if (!r.ok) return { error: r.error };
  const created = await prisma.bank.create({ data: { ...r.data, branchId } });
  await logAudit({ entityType: "BANK", entityId: created.id, action: "CREATE", after: { accountName: r.data.accountName, bankName: r.data.bankName }, userId: user.id, userName: user.name, branchId });
  revalidatePath("/banks");
  return { error: null, ok: true, id: created.id };
}

export async function updateBankAction(_prev: State, formData: FormData): Promise<State> {
  assertContactsValid(formData);
  await requirePermission("partners", "edit");
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const id = s(formData.get("bankId"));
  if (!id || !(await inBranch(id, branchId, isSuperAdmin))) return { error: "Bank not found." };
  const before = await prisma.bank.findUnique({ where: { id } });
  if (!before) return { error: "Bank not found." };
  const r = await readFields(formData, before.branchId);
  if (!r.ok) return { error: r.error };
  const status = s(formData.get("enabled")) === "0" ? "INACTIVE" : "ACTIVE";
  await prisma.bank.update({ where: { id }, data: { ...r.data, status } });
  await logAudit({ entityType: "BANK", entityId: id, action: "UPDATE", before: before as unknown as Record<string, unknown>, after: { ...r.data, status }, userId: user.id, userName: user.name, branchId: before.branchId });
  revalidatePath(`/banks/${id}`);
  revalidatePath("/banks");
  return { error: null, ok: true };
}

export async function deleteBankAction(formData: FormData) {
  assertContactsValid(formData);
  await requirePermission("partners", "delete");
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const id = s(formData.get("bankId"));
  if (!id || !(await inBranch(id, branchId, isSuperAdmin))) return;
  const existing = await prisma.bank.findUnique({ where: { id } });
  await prisma.bank.delete({ where: { id } });
  if (existing) await logAudit({ entityType: "BANK", entityId: id, action: "DELETE", before: { accountName: existing.accountName, bankName: existing.bankName }, userId: user.id, userName: user.name, branchId });
  revalidatePath("/banks");
}
