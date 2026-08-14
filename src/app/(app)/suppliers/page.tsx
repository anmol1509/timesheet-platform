import Link from "next/link";
import { Truck } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
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
  const { branchId, isSuperAdmin } = await requireUserWithBranch();
  const suppliers = await prisma.supplier.findMany({
    where: branchWhere(branchId),
    select: {
      id: true,
      name: true,
      contactPerson: true,
      contactPhone: true,
      status: true,
      tradeLicenseExpiry: true,
      parent: { select: { name: true } },
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
    parentName: s.parent?.name ?? null,
    employeeCount: s._count.employees,
    entryCount: s._count.entries,
    licenseStatus: complianceStatus(s.tradeLicenseExpiry),
  }));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl tracking-tight text-primary font-semibold">Suppliers</h1>
        <p className="mt-1 text-sm text-muted">
          Manage the manpower suppliers/subcontractors referenced across
          timesheets and employees.
        </p>
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {isSuperAdmin && !branchId && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          You&apos;re viewing <strong>All branches</strong>. Pick a specific branch from the
          switcher (top right) before adding a supplier.
        </p>
      )}

      <form
        action={createSupplierAction}
        className="card flex flex-wrap items-end gap-3 p-4"
      >
        <label className="block flex-1 min-w-[180px]">
          <span className="mb-1 block text-xs font-medium text-muted">
            Supplier name
          </span>
          <input
            name="name"
            required
            placeholder="e.g. Top Peak"
            className="input w-full"
          />
        </label>
        <label className="block flex-1 min-w-[220px]">
          <span className="mb-1 block text-xs font-medium text-muted">
            Full name (for letterhead)
          </span>
          <input
            name="fullName"
            placeholder="e.g. TOP PEAK GENERAL CONTRACTING"
            className="input w-full"
          />
        </label>
        <button
          type="submit"
          className="btn btn-primary"
        >
          + Add Supplier
        </button>
      </form>

      {rows.length === 0 ? (
        <EmptyState
          icon={Truck}
          title="No suppliers yet"
          description="Suppliers provide the manpower you deploy. Add one above to record its trade licence and approval status — suppliers are also created automatically when they appear in a timesheet upload."
          action={
            <Link href="/upload" className="btn btn-secondary btn-sm">
              Upload a timesheet
            </Link>
          }
        />
      ) : (
        <SupplierList suppliers={rows} />
      )}
    </div>
  );
}
