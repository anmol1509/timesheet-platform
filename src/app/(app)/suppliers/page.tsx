import { prisma } from "@/lib/db";
import { DeleteButton } from "@/components/DeleteButton";
import { createSupplierAction, deleteSupplierAction } from "./actions";

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const suppliers = await prisma.supplier.findMany({
    include: { _count: { select: { employees: true, entries: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Suppliers</h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage the manpower suppliers/subcontractors referenced across
          timesheets and employees.
        </p>
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <form
        action={createSupplierAction}
        className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4"
      >
        <label className="block flex-1 min-w-[180px]">
          <span className="mb-1 block text-xs font-medium text-slate-500">
            Supplier name
          </span>
          <input
            name="name"
            required
            placeholder="e.g. Top Peak"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
          />
        </label>
        <label className="block flex-1 min-w-[220px]">
          <span className="mb-1 block text-xs font-medium text-slate-500">
            Full name (for letterhead)
          </span>
          <input
            name="fullName"
            placeholder="e.g. TOP PEAK GENERAL CONTRACTING"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
          />
        </label>
        <button
          type="submit"
          className="rounded-lg bg-[#0B1642] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#0B1642]/90"
        >
          + Add Supplier
        </button>
      </form>

      {suppliers.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center text-sm text-slate-500">
          No suppliers yet. Add one above, or upload a timesheet to create
          them automatically.
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium tracking-wide text-slate-500 uppercase">
              <tr>
                <th className="px-4 py-3">Supplier</th>
                <th className="px-4 py-3">Full name</th>
                <th className="px-4 py-3 text-right">Employees</th>
                <th className="px-4 py-3 text-right">Timesheet rows</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {suppliers.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {s.name}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {s.fullName || "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600">
                    {s._count.employees}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600">
                    {s._count.entries}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <DeleteButton
                      action={deleteSupplierAction}
                      hiddenFields={{ supplierId: s.id }}
                      confirmMessage={`Delete supplier "${s.name}"?${
                        s._count.employees > 0
                          ? ` ${s._count.employees} employee(s) will be unassigned.`
                          : ""
                      }`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
