"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { branchWhere, isOutsideBranch } from "@/lib/branch";
import { logAudit } from "@/lib/audit";

function stringOrNull(value: FormDataEntryValue | null) {
  const s = String(value || "").trim();
  return s || null;
}

/**
 * A site belongs to a project, and through it to a client.
 *
 * The client is deliberately not stored on the site: a project already knows
 * whose it is, and duplicating it is how the two drift apart when a project
 * changes hands.
 */
export async function createSiteAction(formData: FormData) {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const name = String(formData.get("name") || "").trim();
  const projectId = String(formData.get("projectId") || "").trim();
  if (!name || !projectId) return;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { branchId: true },
  });
  if (!project || isOutsideBranch(project.branchId, branchId, isSuperAdmin)) return;

  const site = await prisma.site.create({
    data: { name, projectId, address: stringOrNull(formData.get("address")) },
  });

  await logAudit({
    entityType: "SITE",
    entityId: site.id,
    action: "CREATE",
    after: { name, projectId },
    userId: user.id,
    userName: user.name,
    branchId,
  });

  revalidatePath("/sites");
}

export async function updateSiteAction(formData: FormData) {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const id = String(formData.get("siteId") || "");
  const name = String(formData.get("name") || "").trim();
  if (!id || !name) return;

  const existing = await prisma.site.findUnique({
    where: { id },
    include: { project: { select: { branchId: true } } },
  });
  if (!existing || isOutsideBranch(existing.project.branchId, branchId, isSuperAdmin)) return;

  await prisma.site.update({
    where: { id },
    data: { name, address: stringOrNull(formData.get("address")) },
  });

  await logAudit({
    entityType: "SITE",
    entityId: id,
    action: "UPDATE",
    before: { name: existing.name, address: existing.address },
    after: { name },
    userId: user.id,
    userName: user.name,
    branchId,
  });

  revalidatePath("/sites");
}

export async function deleteSiteAction(formData: FormData) {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const id = String(formData.get("siteId") || "");
  if (!id) return;

  const existing = await prisma.site.findUnique({
    where: { id },
    include: {
      project: { select: { branchId: true } },
      _count: { select: { employees: true, timesheetEntries: true } },
    },
  });
  if (!existing || isOutsideBranch(existing.project.branchId, branchId, isSuperAdmin)) return;

  // Deleting would orphan the workers standing on it and the hours booked
  // against it, so it's refused rather than cascaded.
  if (existing._count.employees > 0 || existing._count.timesheetEntries > 0) {
    return;
  }

  await prisma.site.delete({ where: { id } });

  await logAudit({
    entityType: "SITE",
    entityId: id,
    action: "DELETE",
    before: existing as unknown as Record<string, unknown>,
    userId: user.id,
    userName: user.name,
    branchId,
  });

  revalidatePath("/sites");
}

/** Sites for a project, for the pickers that narrow by project first. */
export async function getSitesForProjectAction(projectId: string) {
  const { branchId } = await requireUserWithBranch();
  if (!projectId) return [];
  return prisma.site.findMany({
    where: { projectId, project: branchWhere(branchId) },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}
