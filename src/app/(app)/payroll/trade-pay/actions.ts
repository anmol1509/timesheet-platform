"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUserWithBranch, requirePermission } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { logAudit } from "@/lib/audit";
import { PAY_STRUCTURES, round2 } from "@/lib/payroll";

type State = { error: string | null; ok?: boolean };
const str = (v: FormDataEntryValue | null) => String(v ?? "").trim();
const money = (v: FormDataEntryValue | null) => {
  const s = str(v);
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? round2(n) : NaN;
};

/** Adds or updates what a company pays for a trade. */
export async function saveTradePayAction(_prev: State, formData: FormData): Promise<State> {
  await requirePermission("payroll", "edit");
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  if (!branchId) return { error: "Pick a branch from the switcher first." };

  const supplier = await prisma.supplier.findUnique({ where: { id: str(formData.get("supplierId")) }, select: { id: true, branchId: true, isOwnCompany: true, name: true } });
  if (!supplier || isOutsideBranch(supplier.branchId, branchId, isSuperAdmin) || !supplier.isOwnCompany) return { error: "Choose one of your own companies." };
  const trade = str(formData.get("trade"));
  if (!trade) return { error: "Choose the trade." };
  const structure = str(formData.get("payStructure"));
  if (!(PAY_STRUCTURES as readonly string[]).includes(structure)) return { error: "Choose how this trade is paid." };

  const f = (k: string) => money(formData.get(k));
  const vals = { basicSalary: f("basicSalary"), housingAllowance: f("housingAllowance"), foodAllowance: f("foodAllowance"), transportAllowance: f("transportAllowance"), otherAllowance: f("otherAllowance"), flatMonthlyRate: f("flatMonthlyRate"), hourlyRate: f("hourlyRate") };
  if (Object.values(vals).some((v) => Number.isNaN(v))) return { error: "Pay amounts must be numbers, zero or more." };
  if (structure === "ITEMISED" && !vals.basicSalary) return { error: "Enter a basic salary." };
  if (structure === "FLAT" && !vals.flatMonthlyRate) return { error: "Enter the monthly rate." };
  if (structure === "HOURLY" && !vals.hourlyRate) return { error: "Enter the hourly rate." };
  const num = (k: string, d: number) => { const n = Number(str(formData.get(k))); return Number.isFinite(n) && str(formData.get(k)) ? n : d; };
  const dailyHours = num("dailyHours", 8);
  const otMultiplier = num("otMultiplier", 1.25);
  const restOtMultiplier = num("restOtMultiplier", 1.5);
  if (dailyHours < 1 || dailyHours > 16) return { error: "Daily hours must be between 1 and 16." };
  if (otMultiplier < 1 || otMultiplier > 3 || restOtMultiplier < 1 || restOtMultiplier > 3) return { error: "Multipliers must be between 1 and 3." };

  const itemised = structure === "ITEMISED";
  const data = {
    payStructure: structure,
    basicSalary: itemised ? vals.basicSalary : null,
    housingAllowance: itemised ? vals.housingAllowance : null,
    foodAllowance: itemised ? vals.foodAllowance : null,
    transportAllowance: itemised ? vals.transportAllowance : null,
    otherAllowance: itemised ? vals.otherAllowance : null,
    flatMonthlyRate: structure === "FLAT" ? vals.flatMonthlyRate : null,
    hourlyRate: structure === "HOURLY" ? vals.hourlyRate : null,
    dailyHours, paysOvertime: formData.get("paysOvertime") === "on", otMultiplier, restOtMultiplier,
  };
  const row = await prisma.tradePay.upsert({
    where: { supplierId_trade: { supplierId: supplier.id, trade } },
    create: { ...data, trade, supplierId: supplier.id, branchId: supplier.branchId },
    update: data,
  });
  await logAudit({ entityType: "TRADE_PAY", entityId: row.id, action: "UPDATE", after: { company: supplier.name, trade, ...data } as never, userId: user.id, userName: user.name, branchId: supplier.branchId });
  revalidatePath("/payroll/trade-pay");
  return { error: null, ok: true };
}

export async function deleteTradePayAction(formData: FormData): Promise<State> {
  await requirePermission("payroll", "edit");
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const row = await prisma.tradePay.findUnique({ where: { id: str(formData.get("id")) } });
  if (!row || isOutsideBranch(row.branchId, branchId, isSuperAdmin)) return { error: "Not found." };
  await prisma.tradePay.delete({ where: { id: row.id } });
  await logAudit({ entityType: "TRADE_PAY", entityId: row.id, action: "DELETE", before: { trade: row.trade } as never, userId: user.id, userName: user.name, branchId: row.branchId });
  revalidatePath("/payroll/trade-pay");
  return { error: null, ok: true };
}
