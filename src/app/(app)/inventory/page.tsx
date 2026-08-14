import { prisma } from "@/lib/db";
import { Package } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
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
    <div className="space-y-5">
      <div>
        <h1 className="text-xl tracking-tight text-primary font-semibold">Inventory</h1>
        <p className="mt-1 text-sm text-muted">
          Tools and equipment issued to project sites.
        </p>
      </div>

      <NewItemForm />

      {rows.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No inventory items yet"
          description="Track tools, PPE and equipment here. Add an item above to record stock levels and assign units to employees."
        />
      ) : (
        <InventoryList items={rows} />
      )}
    </div>
  );
}
