"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUserWithBranch, requirePermission, requireWrite } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { logChildChange } from "@/lib/audit";
import { assertContactsValid } from "@/lib/validators";

/** The supplier, if it is in this company and is not one of the company's own (an own company's cost is its workers' pay). */
async function theirSupplier(supplierId: string, branchId: string | null, isSuperAdmin: boolean) {
  const s = await prisma.supplier.findUnique({ where: { id: supplierId }, select: { id: true, branchId: true, isOwnCompany: true } });
  if (!s || isOutsideBranch(s.branchId, branchId, isSuperAdmin) || s.isOwnCompany || !s.branchId) return null;
  return s as { id: string; branchId: string; isOwnCompany: boolean };
}

/** Sets what this supplier is paid per hour for a trade (adds it, or changes the one there). */
export async function saveSupplierTradePayAction(formData: FormData): Promise<{ error?: string }> {
  await requireWrite("partners.suppliers");
  assertContactsValid(formData);
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const supplierId = String(formData.get("supplierId") || "");
  const trade = String(formData.get("trade") || "").trim();
  const rate = Number(formData.get("rate"));
  if (!supplierId || !trade) return { error: "Enter the trade and the rate." };
  if (!Number.isFinite(rate) || rate <= 0) return { error: "Enter a rate above 0." };
  const supplier = await theirSupplier(supplierId, branchId, isSuperAdmin);
  if (!supplier) return { error: "That supplier isn't one whose rates are kept here." };

  const existing = await prisma.tradePay.findFirst({ where: { supplierId, trade: { equals: trade, mode: "insensitive" } } });
  if (existing) await prisma.tradePay.update({ where: { id: existing.id }, data: { hourlyRate: rate, payStructure: "HOURLY" } });
  else await prisma.tradePay.create({ data: { supplierId, trade, branchId: supplier.branchId, payStructure: "HOURLY", hourlyRate: rate } });
  await logChildChange({ parentType: "SUPPLIER", parentId: supplierId, field: `cost_rate_${trade}`, from: existing?.hourlyRate != null ? Number(existing.hourlyRate) : null, to: rate, user, branchId });
  revalidatePath(`/suppliers/${supplierId}`);
  return {};
}

export async function removeSupplierTradePayAction(formData: FormData) {
  await requireWrite("partners.suppliers");
  await requirePermission("partners.suppliers", "delete");
  assertContactsValid(formData);
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const supplierId = String(formData.get("supplierId") || "");
  const rateId = String(formData.get("rateId") || "");
  if (!supplierId || !rateId) return;
  if (!(await theirSupplier(supplierId, branchId, isSuperAdmin))) return;
  const old = await prisma.tradePay.findFirst({ where: { id: rateId, supplierId }, select: { trade: true, hourlyRate: true } });
  if (!old) return;
  await prisma.tradePay.delete({ where: { id: rateId } });
  await logChildChange({ parentType: "SUPPLIER", parentId: supplierId, field: `cost_rate_${old.trade}`, from: old.hourlyRate != null ? Number(old.hourlyRate) : null, to: null, user, branchId });
  revalidatePath(`/suppliers/${supplierId}`);
}
