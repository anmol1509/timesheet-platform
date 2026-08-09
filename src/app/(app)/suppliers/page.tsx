import { prisma } from "@/lib/db";
import { complianceStatus } from "@/lib/compliance";
import { requireUserWithBranch } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { createSupplierAction } from "./actions";
import { SupplierList } from "./supplier-list";

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const { branchId } = await requireUserWithBranch();
  const suppliers = await prisma.supplier.findMany({
    where: branchWhere(branchId),
    select: {
      id: true,
      name: true,
      contactPerson: true,
      contactPhone: true,
      status: true,
      tradeLicenseExpiry: true,
      _count: { select: { employees: true, entries: true } },
    },
    orderBy: { name: "asc" },
  });

  const rows = suppliers.map((s) => ({
    id: s.id,
    name: s.name,
    contactPerson: s.contactPerson,
    contactPhone: s.contactPhone,
    status: s.status,
    employeeCount: s._count.employees,
    entryCount: s._count.entries,
    licenseStatus: complianceStatus(s.tradeLicenseExpiry),
  }));

  return (
    <div className="max-w-4xl space-y-6">
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
        className="flex flex-wrap items-end gap-3 rounded-3xl border border-slate-200 bg-white p-4"
      >
        <label className="block flex-1 min-w-[180px]">
          <span className="mb-1 block text-xs font-medium text-slate-500">
            Supplier name
          </span>
          <input
            name="name"
            required
            placeholder="e.g. Top Peak"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
          />
        </label>
        <label className="block flex-1 min-w-[220px]">
          <span className="mb-1 block text-xs font-medium text-slate-500">
            Full name (for letterhead)
          </span>
          <input
            name="fullName"
            placeholder="e.g. TOP PEAK GENERAL CONTRACTING"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
          />
        </label>
        <button
          type="submit"
          className="rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--brand-primary-hover)]"
        >
          + Add Supplier
        </button>
      </form>

      {rows.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center text-sm text-slate-500">
          No suppliers yet. Add one above, or upload a timesheet to create
          them automatically.
        </p>
      ) : (
        <SupplierList suppliers={rows} />
      )}
    </div>
  );
}
