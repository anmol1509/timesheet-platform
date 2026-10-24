import type { Prisma } from "@/generated/prisma/client";

/**
 * People are shared between companies, so deleting a company only removes its links. A person left with no company at
 * all would be unreachable on screen yet still hold their passport scans, so they and their documents are removed too.
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
