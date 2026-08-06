"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function createSiteAction(formData: FormData) {
  const user = await requireUser();
  const name = String(formData.get("name") || "").trim();
  if (!name) return;

  const existing = await prisma.site.findUnique({ where: { name } });

  const site = await prisma.site.upsert({
    where: { name },
    update: {},
    create: { name },
  });

  if (!existing) {
    await logAudit({
      entityType: "SITE",
      entityId: site.id,
      action: "CREATE",
      after: { name },
      userId: user.id,
      userName: user.name,
      branchId: null,
    });
  }

  revalidatePath("/sites");
}

export async function updateSiteAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("siteId") || "");
  const name = String(formData.get("name") || "").trim();
  if (!id || !name) return;

  const before = await prisma.site.findUnique({ where: { id } });
  await prisma.site.update({ where: { id }, data: { name } });

  await logAudit({
    entityType: "SITE",
    entityId: id,
    action: "UPDATE",
    before: before as unknown as Record<string, unknown>,
    after: { name },
    userId: user.id,
    userName: user.name,
    branchId: null,
  });

  revalidatePath("/sites");
  revalidatePath("/projects");
}

export async function bulkImportSitesAction(rows: Record<string, string>[]) {
  const user = await requireUser();
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
        const created = await prisma.site.create({ data: { name } });
        await logAudit({
          entityType: "SITE",
          entityId: created.id,
          action: "CREATE",
          after: { name },
          userId: user.id,
          userName: user.name,
          branchId: null,
        });
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
  const user = await requireUser();
  const id = String(formData.get("siteId") || "");
  if (!id) return;

  const existing = await prisma.site.findUnique({ where: { id } });
  await prisma.site.delete({ where: { id } });

  if (existing) {
    await logAudit({
      entityType: "SITE",
      entityId: id,
      action: "DELETE",
      before: { name: existing.name },
      userId: user.id,
      userName: user.name,
      branchId: null,
    });
  }

  revalidatePath("/sites");
}
