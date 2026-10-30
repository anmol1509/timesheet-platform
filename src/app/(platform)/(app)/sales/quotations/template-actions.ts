"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requirePermission, requireUserWithBranch, requireWrite } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { COVER_FIELDS } from "@/lib/quotationCover";

/** Saves a cover text (opening and closing paragraph) for quotations in this branch. */
export async function createQuotationTemplateAction(name: string, intro: string, closing: string): Promise<{ id?: string; error?: string }> {
  await requireWrite("sales.quotations");
  const { branchId } = await requireUserWithBranch();
  if (!branchId) return { error: "Pick a company first." };
  const n = name.trim();
  const i = intro.trim();
  if (!n) return { error: "Give the template a name." };
  if (!i) return { error: "Write the opening paragraph." };
  const known = new Set<string>(COVER_FIELDS.map((f) => f.key));
  const unknown = [...new Set([...(i + " " + closing).matchAll(/\{([A-Za-z_]+)\}/g)].map((m) => m[1].toUpperCase()))].filter((k) => !known.has(k));
  if (unknown.length) return { error: `Unknown field${unknown.length > 1 ? "s" : ""}: ${unknown.map((k) => `{${k}}`).join(", ")}.` };
  const created = await prisma.quotationTemplate.create({ data: { branchId, name: n, intro: i, closing: closing.trim() || null } });
  revalidatePath("/sales/quotations");
  return { id: created.id };
}

export async function deleteQuotationTemplateAction(id: string): Promise<{ error?: string }> {
  await requireWrite("sales.quotations");
  await requirePermission("sales.quotations", "delete");
  const { branchId, isSuperAdmin } = await requireUserWithBranch();
  const t = await prisma.quotationTemplate.findUnique({ where: { id }, select: { branchId: true } });
  if (!t || isOutsideBranch(t.branchId, branchId, isSuperAdmin)) return { error: "Template not found." };
  await prisma.quotationTemplate.delete({ where: { id } });
  revalidatePath("/sales/quotations");
  return {};
}
