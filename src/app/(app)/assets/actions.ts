"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUserWithBranch, requirePermission } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { logAudit } from "@/lib/audit";
import { parseDay } from "@/lib/leave";
import { round2 } from "@/lib/payroll";

type State = { error: string | null; ok?: boolean };
const str = (v: FormDataEntryValue | null) => String(v ?? "").trim();
const money = (v: FormDataEntryValue | null) => { const n = Number(str(v) || 0); return Number.isFinite(n) ? round2(n) : NaN; };

async function loadAsset(id: string) {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const asset = await prisma.asset.findUnique({ where: { id } });
  return { user, branchId, asset: asset && !isOutsideBranch(asset.branchId, branchId, isSuperAdmin) ? asset : null };
}

export async function saveAssetAction(_prev: State, formData: FormData): Promise<State> {
  const id = str(formData.get("id"));
  await requirePermission("assets", id ? "edit" : "create");
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  if (!branchId) return { error: "Pick a branch from the switcher first." };

  const code = str(formData.get("code")).toUpperCase();
  const name = str(formData.get("name"));
  const category = str(formData.get("category"));
  const purchaseDate = parseDay(str(formData.get("purchaseDate")));
  const cost = money(formData.get("cost"));
  const salvageValue = money(formData.get("salvageValue"));
  const usefulLifeMonths = Math.floor(Number(str(formData.get("usefulLifeYears")) || 0) * 12);
  if (!code || !name || !category) return { error: "Enter a code, name and category." };
  if (!purchaseDate) return { error: "Enter the purchase date." };
  if (!(cost > 0) || Number.isNaN(salvageValue) || salvageValue < 0) return { error: "Enter a valid cost and salvage value." };
  if (salvageValue > cost) return { error: "Salvage value can't exceed the cost." };
  if (!(usefulLifeMonths >= 1 && usefulLifeMonths <= 600)) return { error: "Useful life must be between 1 month and 50 years." };
  const data = { code, name, category, purchaseDate, cost, salvageValue, usefulLifeMonths, serialNo: str(formData.get("serialNo")) || null, location: str(formData.get("location")) || null, notes: str(formData.get("notes")) || null };

  try {
    if (id) {
      const existing = await prisma.asset.findUnique({ where: { id } });
      if (!existing || isOutsideBranch(existing.branchId, branchId, isSuperAdmin)) return { error: "Asset not found." };
      await prisma.asset.update({ where: { id }, data });
      await logAudit({ entityType: "ASSET", entityId: id, action: "UPDATE", before: { code: existing.code, name: existing.name, cost: Number(existing.cost), salvageValue: Number(existing.salvageValue), usefulLifeMonths: existing.usefulLifeMonths }, after: { code, name, cost, salvageValue, usefulLifeMonths }, userId: user.id, userName: user.name, branchId: existing.branchId });
    } else {
      const created = await prisma.asset.create({ data: { ...data, branchId } });
      await logAudit({ entityType: "ASSET", entityId: created.id, action: "CREATE", after: { code, name, category, cost }, userId: user.id, userName: user.name, branchId });
    }
  } catch {
    return { error: `An asset with code ${code} already exists.` };
  }
  revalidatePath("/assets");
  if (id) revalidatePath(`/assets/${id}`);
  return { error: null, ok: true };
}

export async function disposeAssetAction(_prev: State, formData: FormData): Promise<State> {
  await requirePermission("assets", "edit");
  const { user, asset } = await loadAsset(str(formData.get("id")));
  if (!asset) return { error: "Asset not found." };
  if (asset.status === "DISPOSED") return { error: "Already disposed." };
  const disposedOn = parseDay(str(formData.get("disposedOn")));
  const proceeds = money(formData.get("disposalValue"));
  if (!disposedOn) return { error: "Enter the disposal date." };
  if (disposedOn < asset.purchaseDate) return { error: "Disposal can't be before the purchase date." };
  if (Number.isNaN(proceeds) || proceeds < 0) return { error: "Enter the sale proceeds (0 if scrapped)." };
  await prisma.asset.update({ where: { id: asset.id }, data: { status: "DISPOSED", disposedOn, disposalValue: proceeds } });
  await logAudit({ entityType: "ASSET", entityId: asset.id, action: "UPDATE", before: { status: "ACTIVE" }, after: { status: "DISPOSED", disposedOn: disposedOn.toISOString().slice(0, 10), proceeds }, userId: user.id, userName: user.name, branchId: asset.branchId });
  revalidatePath("/assets");
  revalidatePath(`/assets/${asset.id}`);
  return { error: null, ok: true };
}

export async function addMaintenanceAction(_prev: State, formData: FormData): Promise<State> {
  await requirePermission("assets", "edit");
  const { user, asset } = await loadAsset(str(formData.get("assetId")));
  if (!asset) return { error: "Asset not found." };
  const date = parseDay(str(formData.get("date")));
  const description = str(formData.get("description"));
  const cost = money(formData.get("cost"));
  const nextRaw = str(formData.get("nextDueDate"));
  const nextDueDate = nextRaw ? parseDay(nextRaw) : null;
  if (!date || !description) return { error: "Enter the date and what was done." };
  if (Number.isNaN(cost) || cost < 0) return { error: "Enter a valid cost." };
  if (nextRaw && !nextDueDate) return { error: "The next-due date isn't valid." };
  const created = await prisma.assetMaintenance.create({ data: { assetId: asset.id, date, description, cost, doneBy: str(formData.get("doneBy")) || null, nextDueDate } });
  await logAudit({ entityType: "ASSET_MAINTENANCE", entityId: created.id, action: "CREATE", after: { asset: asset.code, description, cost }, userId: user.id, userName: user.name, branchId: asset.branchId });
  revalidatePath(`/assets/${asset.id}`);
  return { error: null, ok: true };
}

export async function deleteMaintenanceAction(formData: FormData): Promise<State> {
  await requirePermission("assets", "delete");
  const m = await prisma.assetMaintenance.findUnique({ where: { id: str(formData.get("id")) }, select: { id: true, assetId: true } });
  if (!m) return { error: "Not found." };
  const { asset } = await loadAsset(m.assetId);
  if (!asset) return { error: "Not found." };
  await prisma.assetMaintenance.delete({ where: { id: m.id } });
  revalidatePath(`/assets/${asset.id}`);
  return { error: null, ok: true };
}

export async function deleteAssetAction(formData: FormData) {
  await requirePermission("assets", "delete");
  const { user, asset } = await loadAsset(str(formData.get("id")));
  if (!asset) return;
  await prisma.asset.delete({ where: { id: asset.id } });
  await logAudit({ entityType: "ASSET", entityId: asset.id, action: "DELETE", before: { code: asset.code, name: asset.name, cost: Number(asset.cost) }, userId: user.id, userName: user.name, branchId: asset.branchId });
  revalidatePath("/assets");
  redirect("/assets");
}
