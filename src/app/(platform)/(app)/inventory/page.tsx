import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@/lib/db";
import { Package, Boxes, Users, AlertTriangle } from "lucide-react";
import { requireUserWithBranch } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { StatTile } from "@/components/StatTile";
import { AddItemDialog } from "./add-item-dialog";
import { isLowStock } from "./stock";
import { InventoryList } from "./inventory-list";

export default async function InventoryPage() {
  const { branchId } = await requireUserWithBranch();
  const [items, employees] = await Promise.all([prisma.inventoryItem.findMany({
    where: branchWhere(branchId),
    select: {
      id: true,
      name: true,
      category: true,
      notes: true,
      assignments: { where: { returnDate: null }, select: { id: true, quantity: true } },
      variants: { select: { id: true, name: true, sku: true, stock: true }, orderBy: { name: "asc" } },
      employeeAssignments: {
        where: { returnDate: null },
        select: { id: true, quantity: true, variantId: true, issuedDate: true, employee: { select: { id: true, name: true, employeeIdNo: true } }, variant: { select: { name: true } } },
        orderBy: { issuedDate: "desc" },
      },
    },
    orderBy: { name: "asc" },
  }),
  prisma.employee.findMany({ where: { ...branchWhere(branchId), active: true }, select: { id: true, name: true, employeeIdNo: true }, orderBy: { name: "asc" } }),
  ]);

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
      holders: i.employeeAssignments.map((a) => ({
        id: a.id,
        employeeId: a.employee.id,
        employeeName: a.employee.name,
        employeeIdNo: a.employee.employeeIdNo,
        variantName: a.variant?.name ?? null,
        quantity: a.quantity,
        issuedDate: a.issuedDate.toISOString(),
      })),
      variants: i.variants.map((v) => {
        const issued = issuedByVariant.get(v.id) ?? 0;
        return { id: v.id, name: v.name, sku: v.sku, stock: v.stock, issued, available: v.stock - issued };
      }),
    };
  });

  const owned = rows.reduce((n, r) => n + r.inStock, 0);
  const withWorkers = rows.reduce((n, r) => n + r.issued, 0);
  const workersHolding = new Set(rows.flatMap((r) => r.holders.map((h) => h.employeeId))).size;
  const outCount = rows.filter((r) => r.inStock > 0 && r.inStock - r.issued <= 0).length + rows.filter((r) => r.inStock === 0).length;
  const lowCount = rows.filter((r) => isLowStock(r.inStock, r.issued)).length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Inventory"
        icon={Package}
        description={<>Tools and equipment, and who is holding them.</>}
        actions={<AddItemDialog />}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Items" value={rows.length} icon={Package} hint={`${new Set(rows.map((r) => r.category).filter(Boolean)).size} categories`} />
        <StatTile label="Units owned" value={owned} icon={Boxes} hint={`${owned - withWorkers} on the shelf`} />
        <StatTile label="With workers" value={withWorkers} icon={Users} hint={`${workersHolding} worker${workersHolding === 1 ? "" : "s"}`} />
        <StatTile label="Needs attention" value={outCount + lowCount} icon={AlertTriangle} tone={outCount + lowCount > 0 ? "warning" : "default"} hint={`${outCount} out · ${lowCount} low`} />
      </div>

      <InventoryList items={rows} employees={employees} />
    </div>
  );
}
