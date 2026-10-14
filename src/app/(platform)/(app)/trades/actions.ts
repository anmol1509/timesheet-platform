"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUserWithBranch, requirePermission, requireWrite } from "@/lib/auth";
import { findVisibleSkill, mayEditSkill } from "@/lib/skillScope";
import { logAudit } from "@/lib/audit";
import { assertContactsValid } from "@/lib/validators";
import { blank, cellOf, rowError, yesNo } from "@/lib/bulkImport";
import type { ImportRowResult } from "@/components/import/report";

/** Rejects the accidental one- and two-character entries ("car", "y"). */
const MIN_SKILL_NAME = 3;

export async function createSkillAction(formData: FormData) {
  await requireWrite("workforce.trades");
  assertContactsValid(formData);
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const name = String(formData.get("name") || "").trim().replace(/\s+/g, " ");
  if (name.length < MIN_SKILL_NAME) return;
  const category = String(formData.get("category") || "").trim() || null;
  const trending = formData.get("trending") === "on";

  const existing = await findVisibleSkill(name, branchId);

  // A match found case-insensitively is updated rather than duplicated — but only
  // if it is the caller's to change. A client re-adding a shared trade such as
  // "Mason" must not rewrite the shared row every other client reads.
  if (existing) {
    if (!mayEditSkill(existing, { branchId, isSuperAdmin })) return;
    await prisma.skill.update({ where: { id: existing.id }, data: { category, trending } });
    await logAudit({
      entityType: "SKILL",
      entityId: existing.id,
      action: "UPDATE",
      before: existing as unknown as Record<string, unknown>,
      after: { category, trending },
      userId: user.id,
      userName: user.name,
      branchId: existing.branchId,
    });
  } else {
    // Owned by the branch that added it (shared when a super admin has no branch selected).
    const created = await prisma.skill.create({ data: { name, category, trending, branchId } });
    await logAudit({
      entityType: "SKILL",
      entityId: created.id,
      action: "CREATE",
      after: { name, category, trending },
      userId: user.id,
      userName: user.name,
      branchId,
    });
  }

  revalidatePath("/skills");
}

export async function updateSkillAction(formData: FormData) {
  await requireWrite("workforce.trades");
  assertContactsValid(formData);
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const id = String(formData.get("skillId") || "");
  const name = String(formData.get("name") || "").trim();
  if (!id || !name) return;
  const category = String(formData.get("category") || "").trim() || null;

  const before = await prisma.skill.findUnique({ where: { id } });
  if (!before || !mayEditSkill(before, { branchId, isSuperAdmin })) return;
  // A rename must not collide with another trade the branch can see.
  const clash = await findVisibleSkill(name, before.branchId);
  if (clash && clash.id !== id) return;
  await prisma.skill.update({ where: { id }, data: { name, category } });

  await logAudit({
    entityType: "SKILL",
    entityId: id,
    action: "UPDATE",
    before: before as unknown as Record<string, unknown>,
    after: { name, category },
    userId: user.id,
    userName: user.name,
    branchId: before.branchId,
  });

  revalidatePath("/skills");
}

export async function toggleTrendingAction(formData: FormData) {
  await requireWrite("workforce.trades");
  assertContactsValid(formData);
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const id = String(formData.get("skillId") || "");
  const trending = formData.get("trending") === "true";
  if (!id) return;
  const target = await prisma.skill.findUnique({ where: { id }, select: { branchId: true } });
  if (!target || !mayEditSkill(target, { branchId, isSuperAdmin })) return;

  await prisma.skill.update({ where: { id }, data: { trending: !trending } });

  await logAudit({
    entityType: "SKILL",
    entityId: id,
    action: "UPDATE",
    before: { trending },
    after: { trending: !trending },
    userId: user.id,
    userName: user.name,
    branchId: target.branchId,
  });

  revalidatePath("/skills");
}

export async function deleteSkillAction(formData: FormData) {
  await requireWrite("workforce.trades");
  assertContactsValid(formData);
  await requirePermission("workforce.trades", "delete");
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const id = String(formData.get("skillId") || "");
  if (!id) return;

  const existing = await prisma.skill.findUnique({ where: { id } });
  // Deleting a shared trade would strip it from every client's workers.
  if (!existing || !mayEditSkill(existing, { branchId, isSuperAdmin })) return;
  // Deleting cascades to every EmployeeSkill row, stripping the skill from
  // workers who have it — recorded here so the audit trail shows the scope.
  const holders = await prisma.employeeSkill.count({ where: { skillId: id } });
  await prisma.skill.delete({ where: { id } });

  if (existing) {
    await logAudit({
      entityType: "SKILL",
      entityId: id,
      action: "DELETE",
      before: { ...(existing as unknown as Record<string, unknown>), employeesHolding: holders },
      userId: user.id,
      userName: user.name,
      branchId: existing.branchId,
    });
  }

  revalidatePath("/skills");
}

/** Bulk add/update trades from a spreadsheet. Trades already in the shared catalogue are left alone unless the caller may edit them. */
export async function bulkImportTradesAction(rows: Record<string, string>[]): Promise<ImportRowResult[]> {
  await requireWrite("workforce.trades");
  await requirePermission("workforce.trades", "create");
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const results: ImportRowResult[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const name = cellOf(r, "Trade name").replace(/\s+/g, " ");
    if (!name) { results.push(rowError(i, undefined, "Trade name is required.")); continue; }
    if (name.length < MIN_SKILL_NAME) { results.push(rowError(i, name, `A trade name needs at least ${MIN_SKILL_NAME} characters.`)); continue; }
    const key = name.toLowerCase();
    if (seen.has(key)) { results.push({ row: i + 2, name, status: "skipped", message: "Listed earlier in this file." }); continue; }
    seen.add(key);
    try {
      const category = blank(cellOf(r, "Category"));
      const codeRaw = cellOf(r, "Code").toUpperCase();
      const trending = yesNo(cellOf(r, "Trending"));
      const existing = await findVisibleSkill(name, branchId);
      if (existing) {
        if (!mayEditSkill(existing, { branchId, isSuperAdmin })) {
          results.push({ row: i + 2, name, status: "skipped", message: "Already in the shared trade list, which only a platform admin can change." });
          continue;
        }
        const changes: { category?: string; trending?: boolean; code?: string } = {};
        if (category) changes.category = category;
        if (trending !== undefined) changes.trending = trending;
        if (codeRaw) changes.code = codeRaw;
        await prisma.skill.update({ where: { id: existing.id }, data: changes });
        await logAudit({ entityType: "SKILL", entityId: existing.id, action: "UPDATE", before: existing as unknown as Record<string, unknown>, after: changes, userId: user.id, userName: user.name, branchId: existing.branchId });
        results.push({ row: i + 2, name, status: "updated" });
      } else {
        const created = await prisma.skill.create({ data: { name, category, trending: trending ?? false, code: codeRaw || null, branchId } });
        await logAudit({ entityType: "SKILL", entityId: created.id, action: "CREATE", after: { name, category, trending: created.trending }, userId: user.id, userName: user.name, branchId });
        results.push({ row: i + 2, name, status: "created" });
      }
    } catch (e) {
      const clash = e instanceof Error && /Unique constraint/i.test(e.message);
      results.push(rowError(i, name, clash ? "That code is already used by another trade." : e instanceof Error ? e.message : "Failed to import row."));
    }
  }
  revalidatePath("/trades");
  return results;
}
