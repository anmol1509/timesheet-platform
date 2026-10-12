import { PageHeader } from "@/components/PageHeader";
import Link from "next/link";
import { Truck, Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/EmptyState";
import { BarList } from "@/components/BarList";
import { Panel } from "@/components/DashboardPanel";
import { prisma } from "@/lib/db";
import { billTotals } from "@/lib/payables";
import { complianceStatus } from "@/lib/compliance";
import { requireUserWithBranch } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { groupLookups } from "@/lib/lookups";
import { SupplierList } from "./supplier-list";

function outstanding(bills: { amount: unknown; vatAmount: unknown; dueDate: Date; payments: { amount: unknown }[] }[]) {
  const today = new Date();
  let balance = 0;
  let overdue = 0;
  for (const b of bills) {
    const t = billTotals({ amount: Number(b.amount), vatAmount: Number(b.vatAmount) }, b.payments.map((p) => ({ amount: Number(p.amount) })));
    if (t.balance > 0) {
      balance += t.balance;
      if (b.dueDate.getTime() < today.getTime()) overdue += t.balance;
    }
  }
  return { billBalance: balance, billOverdue: overdue };
}

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const { branchId, isSuperAdmin } = await requireUserWithBranch();
  // The registration dialog opened from a scanned certificate needs the same
  // reference data the full wizard page loads.
  const [projects, sponsors, lookupValues] = await Promise.all([
    prisma.project.findMany({ where: branchWhere(branchId), orderBy: { name: "asc" } }),
    prisma.supplier.findMany({
      where: branchWhere(branchId),
      orderBy: { name: "asc" },
    }),
    prisma.lookupValue.findMany({
      where: { ...branchWhere(branchId), isActive: true },
      orderBy: [{ sortOrder: "asc" }, { value: "asc" }],
      select: { category: true, value: true },
    }),
  ]);

  const suppliers = await prisma.supplier.findMany({
    where: branchWhere(branchId),
    select: {
      id: true,
      name: true,
      code: true,
      contactPerson: true,
      contactPhone: true,
      contactEmail: true,
      fullName: true,
      trn: true,
      tradeLicenseNumber: true,
      status: true,
      tradeLicenseExpiry: true,
      category: true,
      approvalStatus: true,
      labourApprovalStatus: true,
      invoiceApprovalStatus: true,
      bills: {
        where: { approvalStatus: { not: "REJECTED" } },
        select: { amount: true, vatAmount: true, dueDate: true, payments: { select: { amount: true } } },
      },
      branchId: true,
      isOwnCompany: true,
      parent: { select: { name: true } },
      parentSupplierId: true,
      _count: { select: { employees: true, entries: true } },
    },
    orderBy: { name: "asc" },
  });

  const rows = suppliers.map((s) => ({
    id: s.id,
    name: s.name,
    code: s.code,
    contactPerson: s.contactPerson,
    contactPhone: s.contactPhone,
    contactEmail: s.contactEmail,
    fullName: s.fullName,
    trn: s.trn,
    tradeLicenseNumber: s.tradeLicenseNumber,
    status: s.status,
    isOwnCompany: s.isOwnCompany,
    parentName: s.parent?.name ?? null,
    parentId: s.parentSupplierId,
    branchId: s.branchId,
    parentSupplierId: s.parentSupplierId,
    employeeCount: s._count.employees,
    entryCount: s._count.entries,
    licenseStatus: complianceStatus(s.tradeLicenseExpiry),
    licenseExpiry: s.tradeLicenseExpiry ? s.tradeLicenseExpiry.toISOString() : null,
    category: s.category,
    approvals: { project: s.approvalStatus, labour: s.labourApprovalStatus, invoicing: s.invoiceApprovalStatus },
    ...outstanding(s.bills),
  }));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Suppliers"
        icon={Truck}
        description={<>Manage the manpower suppliers/subcontractors referenced across timesheets and employees.</>}
        actions={
          <Button href="/suppliers/new" size="sm">
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Add supplier
          </Button>
        }
      />

      {error && (
        <p className="rounded-lg border border-[var(--error-border)] bg-[var(--error-soft)] px-4 py-2 text-sm text-[var(--error)]">
          {error}
        </p>
      )}

      {isSuperAdmin && !branchId && (
        <p className="rounded-lg border border-[var(--warning-border)] bg-[var(--warning-soft)] px-4 py-2 text-sm text-[var(--warning)]">
          You&apos;re viewing <strong>All branches</strong>. Pick a specific branch from the
          switcher (top right) before adding a supplier.
        </p>
      )}

      {rows.length > 0 && rows.some((r) => r.employeeCount > 0) && (
        <Panel title="Top suppliers by workforce">
          <BarList
            tone="info"
            items={[...rows]
              .filter((r) => r.employeeCount > 0)
              .sort((a, b) => b.employeeCount - a.employeeCount)
              .slice(0, 5)
              .map((r) => ({ key: r.id, label: r.isOwnCompany ? `${r.name} (own company)` : r.name, value: r.employeeCount, href: `/suppliers/${r.id}` }))}
          />
        </Panel>
      )}

      {rows.length === 0 ? (
        <EmptyState
          icon={Truck}
          title="No suppliers yet"
          description="Suppliers provide the manpower you deploy. Use Add supplier to record its trade licence and approval status — suppliers are also created automatically when they appear in a timesheet upload."
          action={
            <Link href="/import/new/suppliers" className="btn btn-secondary btn-sm">
              Import suppliers
            </Link>
          }
        />
      ) : (
        <SupplierList
          suppliers={rows}
          wizardData={{
            projects,
            suppliers: suppliers.map((s) => ({ id: s.id, name: s.name })),
            sponsors,
            lookups: groupLookups(lookupValues),
          }}
        />
      )}
    </div>
  );
}
