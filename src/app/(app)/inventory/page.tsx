import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@/lib/db";
import { Package } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { requireUserWithBranch } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { NewItemForm } from "./new-item-form";
import { InventoryList } from "./inventory-list";
import { BarList, type BarListTone } from "@/components/BarList";
import { Panel } from "@/components/DashboardPanel";

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
      variants: { select: { id: true, name: true, sku: true, stock: true }, orderBy: { name: "asc" } },
      employeeAssignments: { where: { returnDate: null }, select: { quantity: true, variantId: true } },
    },
    orderBy: { name: "asc" },
  });

  const rows = items.map((i) => {
    const issuedByVariant = new Map<string, number>();
    for (const a of i.employeeAssignments) {
      if (!a.variantId) continue;
      issuedByVariant.set(a.variantId, (issuedByVariant.get(a.variantId) ?? 0) + a.quantity);
    }
    return {
      id: i.id,
      name: i.name,
      category: i.category,
      notes: i.notes,
      activeAssignments: i.assignments.length,
      assignedQuantity: i.assignments.reduce((sum, a) => sum + a.quantity, 0),
      // Quantity on hand is the sum over the item's variants; "issued" is what workers
      // currently hold, so available = on hand - issued.
      inStock: i.variants.reduce((sum, v) => sum + v.stock, 0),
      issued: i.employeeAssignments.reduce((sum, a) => sum + a.quantity, 0),
      variants: i.variants.map((v) => {
        const issued = issuedByVariant.get(v.id) ?? 0;
        return { id: v.id, name: v.name, sku: v.sku, stock: v.stock, issued, available: v.stock - issued };
      }),
    };
  });

  const stockLevels = rows
    .map((r) => {
      const available = r.inStock - r.issued;
      const tone: BarListTone = available <= 0 ? "danger" : available <= 5 ? "warning" : "success";
      return { id: r.id, name: r.name, available, tone };
    })
    .sort((a, b) => a.available - b.available)
    .slice(0, 8);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Inventory"
        icon={Package}
        description={<>Tools and equipment issued to project sites.</>}
      />

      <NewItemForm />

      {rows.length > 0 && (
        <Panel title="Stock on hand, lowest first">
          <BarList
            showShare={false}
            items={stockLevels.map((s) => ({ key: s.id, label: s.name, value: s.available, tone: s.tone }))}
            format={(n) => `${n} available`}
            emptyLabel="No inventory items yet."
          />
        </Panel>
      )}

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
