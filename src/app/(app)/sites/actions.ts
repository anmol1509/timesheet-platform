"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUserWithBranch, requirePermission, requireView, requireWrite } from "@/lib/auth";
import { branchWhere, isOutsideBranch } from "@/lib/branch";
import { logAudit } from "@/lib/audit";
import { assertContactsValid } from "@/lib/validators";
import { blank, cellOf, rowError } from "@/lib/bulkImport";
import { nameKey } from "@/lib/partyCode";
import type { ImportRowResult } from "@/components/import/report";

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
  await requireWrite("projects.sites");
  assertContactsValid(formData);
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
  await requireWrite("projects.sites");
  assertContactsValid(formData);
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
  await requireWrite("projects.sites");
  assertContactsValid(formData);
  await requirePermission("projects.sites", "delete");
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
  await requireView("projects.sites");
  const { branchId } = await requireUserWithBranch();
  if (!projectId) return [];
  return prisma.site.findMany({
    where: { projectId, project: branchWhere(branchId) },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

/**
 * Bulk add/update sites. The project is named by its code or its name; a site
 * is matched within that project by name (ignoring case). An empty address
 * leaves the saved one alone.
 */
export async function bulkImportSitesAction(rows: Record<string, string>[]): Promise<ImportRowResult[]> {
  await requireWrite("projects.sites");
  await requirePermission("projects.sites", "create");
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const projects = await prisma.project.findMany({
    where: branchWhere(branchId),
    select: { id: true, code: true, name: true, branchId: true, sites: { select: { id: true, name: true, address: true } } },
  });
  const byCode = new Map(projects.map((p) => [p.code.toLowerCase(), p]));
  const byName = new Map<string, typeof projects>();
  for (const p of projects) byName.set(nameKey(p.name), [...(byName.get(nameKey(p.name)) ?? []), p]);
  const results: ImportRowResult[] = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const siteName = cellOf(r, "Site name").replace(/\s+/g, " ");
    const projectRef = cellOf(r, "Project");
    if (!siteName) { results.push(rowError(i, undefined, "Site name is required.")); continue; }
    if (!projectRef) { results.push(rowError(i, siteName, "Project is required — its code or its name.")); continue; }
    const project = byCode.get(projectRef.toLowerCase()) ?? (byName.get(nameKey(projectRef)) ?? [])[0];
    const ambiguous = !byCode.has(projectRef.toLowerCase()) && (byName.get(nameKey(projectRef))?.length ?? 0) > 1;
    if (!project) { results.push(rowError(i, siteName, `Project "${projectRef}" wasn't found. Use its code or exact name.`)); continue; }
    if (ambiguous) { results.push(rowError(i, siteName, `More than one project is called "${projectRef}". Use the project code instead.`)); continue; }
    if (isOutsideBranch(project.branchId, branchId, isSuperAdmin)) { results.push(rowError(i, siteName, `Project "${projectRef}" wasn't found.`)); continue; }
    try {
      const address = blank(cellOf(r, "Address"));
      const existing = project.sites.find((s) => s.name.trim().toLowerCase() === siteName.toLowerCase());
      if (existing) {
        if (address && address !== existing.address) {
          await prisma.site.update({ where: { id: existing.id }, data: { address } });
          await logAudit({ entityType: "SITE", entityId: existing.id, action: "UPDATE", before: { address: existing.address }, after: { address }, userId: user.id, userName: user.name, branchId });
          existing.address = address;
        }
        results.push({ row: i + 2, name: `${siteName} · ${project.code}`, status: "updated" });
      } else {
        const site = await prisma.site.create({ data: { name: siteName, projectId: project.id, address } });
        await logAudit({ entityType: "SITE", entityId: site.id, action: "CREATE", after: { name: siteName, projectId: project.id }, userId: user.id, userName: user.name, branchId });
        project.sites.push({ id: site.id, name: siteName, address });
        results.push({ row: i + 2, name: `${siteName} · ${project.code}`, status: "created" });
      }
    } catch (e) {
      results.push(rowError(i, siteName, e instanceof Error ? e.message : "Failed to import row."));
    }
  }
  revalidatePath("/sites");
  return results;
}
