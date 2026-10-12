import { prisma } from "@/lib/db";

/**
 * Total units of an item available to issue right now: stock summed across
 * all its variants, minus whatever is currently held (unreturned) by an
 * employee or a project. An item with no variants at all has no stock
 * recorded anywhere, so it always reads as 0 available — consistent with
 * how the inventory list already computes "in stock" for such items.
 */
export async function availableItemStock(itemId: string): Promise<number> {
  const [variants, heldByEmployees, heldByProjects] = await Promise.all([
    prisma.inventoryVariant.aggregate({ where: { itemId }, _sum: { stock: true } }),
    prisma.employeeInventoryAssignment.aggregate({ where: { itemId, returnDate: null }, _sum: { quantity: true } }),
    prisma.projectInventoryAssignment.aggregate({ where: { itemId, returnDate: null }, _sum: { quantity: true } }),
  ]);
  const stock = variants._sum.stock ?? 0;
  const held = (heldByEmployees._sum.quantity ?? 0) + (heldByProjects._sum.quantity ?? 0);
  return stock - held;
}
