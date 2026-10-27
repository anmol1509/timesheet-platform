"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin, requireUserWithBranch } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { parseQuoteSettings, type QuoteSettings } from "@/lib/quotationMath";

/** Saves the company's quotation defaults: working days and hours, usual costs, own price units, profit target. */
export async function saveQuoteSettingsAction(input: QuoteSettings): Promise<{ error?: string }> {
  await requireAdmin();
  const { user, branchId } = await requireUserWithBranch();
  if (!branchId) return { error: "Pick a company first." };
  const clean = parseQuoteSettings(input);
  if (clean.daysPerMonth < 1 || clean.daysPerMonth > 31) return { error: "Working days a month must be between 1 and 31." };
  if (clean.hoursPerDay <= 0 || clean.hoursPerDay > 24) return { error: "Hours a day must be between 1 and 24." };
  const labels = new Set<string>();
  for (const u of clean.units) {
    const k = u.label.trim().toLowerCase();
    if (!k) return { error: "Every unit needs a name." };
    if (labels.has(k)) return { error: `“${u.label}” is listed twice.` };
    labels.add(k);
  }
  const value = { ...clean, units: clean.units.map((u) => ({ key: u.label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-"), label: u.label.trim(), perMonth: u.perMonth })) };
  await prisma.branch.update({ where: { id: branchId }, data: { quoteSettings: value } });
  await logAudit({ entityType: "BRANCH", entityId: branchId, action: "UPDATE", after: { quoteSettings: value }, userId: user.id, userName: user.name, branchId });
  revalidatePath("/sales");
  return {};
}
