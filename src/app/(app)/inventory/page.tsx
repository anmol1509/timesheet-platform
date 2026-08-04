import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { NewItemForm } from "./new-item-form";
import { InventoryList } from "./inventory-list";

export default async function InventoryPage() {
  const { branchId } = await requireUserWithBranch();
  const items = await prisma.inventoryItem.findMany({
    where: branchWhere(branchId),
    select: {
      id: true,
      name: true,
      category: true,
      notes: true,
      assignments: { where: { returnDate: null }, select: { id: true, quantity: true } },
    },
    orderBy: { name: "asc" },
  });

  const rows = items.map((i) => ({
    id: i.id,
    name: i.name,
    category: i.category,
    notes: i.notes,
    activeAssignments: i.assignments.length,
    assignedQuantity: i.assignments.reduce((sum, a) => sum + a.quantity, 0),
  }));

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Inventory</h1>
        <p className="mt-1 text-sm text-slate-500">
          Tools and equipment issued to project sites.
        </p>
      </div>

      <NewItemForm />

      {rows.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center text-sm text-slate-500">
          No inventory items yet. Add one above.
        </p>
      ) : (
        <InventoryList items={rows} />
      )}
    </div>
  );
}
