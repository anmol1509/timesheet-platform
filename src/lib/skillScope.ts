import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

/**
 * The trade catalogue is two layers in one table.
 *
 *  - branchId = null : the shared catalogue. Every branch reads it; only a super
 *    admin may change it.
 *  - branchId = <id> : a trade that branch added itself. Only that branch sees
 *    it, and it is fully theirs to edit or delete.
 *
 * Before this, the catalogue was a single global list: any tenant's admin could
 * rename or delete a trade every other tenant used, and every tenant's demand
 * requests silently added their own trade names to it.
 */
type Db = Pick<Prisma.TransactionClient, "skill">;
type Scope = { branchId: string | null; isSuperAdmin: boolean };

/** Skills this branch may see: the shared ones plus its own. No branch (a super admin viewing all) sees everything. */
export function visibleSkillWhere(branchId: string | null): Prisma.SkillWhereInput {
  return branchId ? { OR: [{ branchId: null }, { branchId }] } : {};
}

/**
 * A visible skill by name, ignoring case and spacing ("Carpentry" = "carpentry").
 * The shared one wins if both exist, so a tenant's own copy never shadows the
 * standard trade.
 */
export function findVisibleSkill(name: string, branchId: string | null, db: Db = prisma) {
  return db.skill.findFirst({
    where: { AND: [visibleSkillWhere(branchId), { name: { equals: name.trim(), mode: "insensitive" } }] },
    orderBy: { branchId: { sort: "asc", nulls: "first" } },
  });
}

/**
 * The skill for a trade name: an existing visible one, else a new one owned by
 * the branch (or shared, when a super admin has no branch selected). Never
 * touches another branch's skills.
 */
export async function getOrCreateSkill(name: string, branchId: string | null, db: Db = prisma) {
  const clean = name.trim();
  return (await findVisibleSkill(clean, branchId, db)) ?? db.skill.create({ data: { name: clean, branchId } });
}

/** Whether the caller may change or delete this skill: a super admin any; a branch admin only their own branch's. */
export function mayEditSkill(skill: { branchId: string | null }, s: Scope): boolean {
  if (s.isSuperAdmin) return true;
  return skill.branchId !== null && skill.branchId === s.branchId;
}
