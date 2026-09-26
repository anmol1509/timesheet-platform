import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { DeleteButton } from "@/components/DeleteButton";
import { requireUserWithBranch } from "@/lib/auth";
import { isOutsideBranch, branchWhere } from "@/lib/branch";
import { deleteInventoryItemAction } from "../actions";
import { EditItemForm } from "./edit-form";
import { EmployeeIssuanceSection } from "./employee-issuance-section";
import { VariantsSection } from "./variants-section";

export default async function InventoryItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const { branchId, isSuperAdmin } = await requireUserWithBranch();

  const [item, employees] = await Promise.all([
    prisma.inventoryItem.findUnique({
      where: { id },
      include: {
        variants: {
          orderBy: { name: "asc" },
          include: { assignments: { where: { returnDate: null }, select: { quantity: true } } },
        },
        employeeAssignments: {
          orderBy: { issuedDate: "desc" },
          include: {
            employee: { select: { id: true, name: true, employeeIdNo: true } },
            variant: { select: { id: true, name: true } },
          },
        },
      },
    }),
    prisma.employee.findMany({
      where: branchWhere(branchId),
      select: { id: true, name: true, employeeIdNo: true },
      orderBy: { name: "asc" },
    }),
  ]);
  if (!item || isOutsideBranch(item.branchId, branchId, isSuperAdmin)) notFound();

  const variants = item.variants.map((v) => ({
    id: v.id,
    name: v.name,
    sku: v.sku,
    stock: v.stock,
    held: v.assignments.reduce((sum, a) => sum + a.quantity, 0),
  }));

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link href="/inventory" className="text-sm text-muted hover:underline">
          ← Inventory
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl tracking-tight text-primary font-semibold">{item.name}</h1>
          <DeleteButton
            action={deleteInventoryItemAction}
            hiddenFields={{ itemId: item.id }}
            confirmMessage={`Delete "${item.name}"?`}
            className="rounded-lg border border-[var(--error-border)] px-3 py-1.5 text-xs font-medium text-[var(--error)] hover:bg-[var(--error-soft)]"
          />
        </div>
        {error && (
          <p className="mt-3 rounded-lg bg-[var(--error-soft)] px-3 py-2 text-sm text-[var(--error)]">{error}</p>
        )}
      </div>

      <EditItemForm item={{ id: item.id, category: item.category, notes: item.notes }} />

      <VariantsSection itemId={item.id} variants={variants} />

      <EmployeeIssuanceSection
        itemId={item.id}
        assignments={item.employeeAssignments.map((a) => ({
          id: a.id,
          quantity: a.quantity,
          issuedDate: a.issuedDate.toISOString(),
          returnDate: a.returnDate ? a.returnDate.toISOString() : null,
          condition: a.condition,
          notes: a.notes,
          employee: a.employee,
          variant: a.variant,
        }))}
        employees={employees}
        variants={variants.map((v) => ({ id: v.id, name: v.name, available: v.stock - v.held }))}
      />
    </div>
  );
}
