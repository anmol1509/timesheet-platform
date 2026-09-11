import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/Badge";
import { DeleteButton } from "@/components/DeleteButton";
import { requireUserWithBranch } from "@/lib/auth";
import { isOutsideBranch, branchWhere } from "@/lib/branch";
import { deleteInventoryItemAction } from "../actions";
import { EditItemForm } from "./edit-form";
import { AssignmentsSection } from "./assignments-section";

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

  const [item, projects] = await Promise.all([
    prisma.inventoryItem.findUnique({
      where: { id },
      include: {
        assignments: {
          orderBy: { assignedDate: "desc" },
          include: { project: { select: { id: true, name: true, code: true } } },
        },
        employeeAssignments: {
          orderBy: { issuedDate: "desc" },
          include: { employee: { select: { id: true, name: true, employeeIdNo: true } } },
        },
      },
    }),
    prisma.project.findMany({
      where: branchWhere(branchId),
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" },
    }),
  ]);
  if (!item || isOutsideBranch(item.branchId, branchId, isSuperAdmin)) notFound();

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
            className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
          />
        </div>
        {error && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}
      </div>

      <EditItemForm item={{ id: item.id, category: item.category, notes: item.notes }} />

      <AssignmentsSection
        itemId={item.id}
        assignments={item.assignments.map((a) => ({
          id: a.id,
          quantity: a.quantity,
          assignedDate: a.assignedDate.toISOString(),
          returnDate: a.returnDate ? a.returnDate.toISOString() : null,
          condition: a.condition,
          project: a.project,
        }))}
        projects={projects}
      />

      <section>
        <h2 className="mb-3 text-sm font-semibold text-primary">Issued to Employees</h2>
        <p className="mb-3 text-sm text-muted">
          Read-only here — issue or return from the employee&rsquo;s own Trades &amp; Records tab.
        </p>
        {item.employeeAssignments.length === 0 ? (
          <p className="empty-state py-8 text-sm text-muted">Never issued to an employee.</p>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-default bg-surface-subtle text-left text-xs font-medium tracking-wide text-muted uppercase">
                <tr>
                  <th className="px-4 py-3">Employee</th>
                  <th className="px-4 py-3 text-right">Qty</th>
                  <th className="px-4 py-3">Issued</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {item.employeeAssignments.map((a) => (
                  <tr key={a.id}>
                    <td className="px-4 py-3 font-medium text-primary">
                      <Link href={`/employees/${a.employee.id}`} className="hover:underline">
                        {a.employee.name}
                      </Link>
                      <span className="tabular ml-2 text-xs text-subtle">{a.employee.employeeIdNo}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-secondary">{a.quantity}</td>
                    <td className="px-4 py-3 text-secondary">{new Date(a.issuedDate).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      {a.returnDate ? (
                        <Badge color="slate">Returned {new Date(a.returnDate).toLocaleDateString()}</Badge>
                      ) : (
                        <Badge color="amber">Holding</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
