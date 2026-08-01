"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function createSiteAction(formData: FormData) {
  await requireUser();
  const name = String(formData.get("name") || "").trim();
  if (!name) return;

  await prisma.site.upsert({
    where: { name },
    update: {},
    create: { name },
  });

  revalidatePath("/sites");
}

export async function updateSiteAction(formData: FormData) {
  await requireUser();
  const id = String(formData.get("siteId") || "");
  const name = String(formData.get("name") || "").trim();
  if (!id || !name) return;
  await prisma.site.update({ where: { id }, data: { name } });
  revalidatePath("/sites");
  revalidatePath("/projects");
}

export async function bulkImportSitesAction(rows: Record<string, string>[]) {
  await requireUser();
  const results: { row: number; status: "created" | "updated" | "error"; message?: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const name = (rows[i]["Site name"] || "").trim();
    if (!name) {
      results.push({ row: i + 2, status: "error", message: "Site name is required." });
      continue;
    }
    try {
      const existing = await prisma.site.findUnique({ where: { name } });
      if (existing) {
        results.push({ row: i + 2, status: "updated" });
      } else {
        await prisma.site.create({ data: { name } });
        results.push({ row: i + 2, status: "created" });
      }
    } catch (e) {
      results.push({
        row: i + 2,
        status: "error",
        message: e instanceof Error ? e.message : "Failed to import row.",
      });
    }
  }

  revalidatePath("/sites");
  return results;
}

export async function deleteSiteAction(formData: FormData) {
  await requireUser();
  const id = String(formData.get("siteId") || "");
  if (!id) return;
  await prisma.site.delete({ where: { id } });
  revalidatePath("/sites");
}
