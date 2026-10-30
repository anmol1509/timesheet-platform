import type { Prisma } from "@/generated/prisma/client";

/**
 * Removes every person with no company, with their documents. Only a full data reset uses this: day to day, owners and
 * sponsors are a list of their own and stay on file with no company, until someone deletes them on purpose.
 * Returns how many people went.
 */
export async function deleteOrphanParties(db: Prisma.TransactionClient, branchId?: string | null): Promise<number> {
  const orphans = await db.supplierParty.findMany({ where: { links: { none: {} }, ...(branchId ? { branchId } : {}) }, select: { id: true } });
  if (orphans.length === 0) return 0;
  const ids = orphans.map((o) => o.id);
  await db.attachment.deleteMany({ where: { entityType: "SUPPLIER_PARTY", entityId: { in: ids } } });
  const removed = await db.supplierParty.deleteMany({ where: { id: { in: ids } } });
  return removed.count;
}
