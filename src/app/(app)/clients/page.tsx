import Link from "next/link";
import { prisma } from "@/lib/db";
import { StatTile } from "@/components/StatTile";
import { EmptyState } from "@/components/EmptyState";
import { Building2, FileCheck2, DollarSign } from "lucide-react";
import { complianceStatus } from "@/lib/compliance";
import { requireUserWithBranch } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { ClientList } from "./client-list";

export default async function ClientsPage() {
  const { branchId } = await requireUserWithBranch();
  const clients = await prisma.client.findMany({
    where: branchWhere(branchId),
    orderBy: { name: "asc" },
  });

  const activeCount = clients.filter((c) => c.status === "ACTIVE").length;
  const basicRates = clients.map((c) => c.basicRate).filter((r): r is number => r != null);
  const avgBasicRate =
    basicRates.length > 0
      ? basicRates.reduce((s, r) => s + r, 0) / basicRates.length
      : 0;

  const rows = clients.map((c) => ({
    id: c.id,
    name: c.name,
    code: c.code,
    contactPerson: c.contactPerson,
    contactEmail: c.contactEmail,
    contactPhone: c.contactPhone,
    basicRate: c.basicRate,
    hourlyRate: c.hourlyRate,
    contractStart: c.contractStart ? c.contractStart.toISOString() : null,
    contractEnd: c.contractEnd ? c.contractEnd.toISOString() : null,
    status: c.status,
    licenseStatus: complianceStatus(c.tradeLicenseExpiry),
  }));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl tracking-tight text-primary font-semibold">
            Client Management
          </h1>
          <p className="mt-1 text-sm text-muted">
            Manage your clients and contract details.
          </p>
        </div>
        <Link
          href="/clients/new"
          className="btn btn-primary"
        >
          + Add Client
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile href="/clients" label="Total Clients" value={clients.length} icon={Building2} />
        <StatTile
          href="/clients?status=active"
          label="Active Contracts"
          value={activeCount}
          icon={FileCheck2}
        />
        <StatTile
          label="Avg. Basic Rate"
          value={avgBasicRate ? `AED ${avgBasicRate.toFixed(0)}` : "—"}
          icon={DollarSign}
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No clients yet"
          description="Clients are who you invoice. Add one to start linking projects, agreeing trade rates, and raising invoices against approved timesheets."
          action={
            <Link href="/clients/new" className="btn btn-primary btn-sm">
              Add client
            </Link>
          }
          secondaryAction={
            <Link href="/upload" className="btn btn-secondary btn-sm">
              Upload a timesheet
            </Link>
          }
        />
      ) : (
        <ClientList clients={rows} />
      )}
    </div>
  );
}
