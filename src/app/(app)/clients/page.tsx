import Link from "next/link";
import { prisma } from "@/lib/db";
import { StatTile } from "@/components/StatTile";
import { Building2, FileCheck2, DollarSign } from "lucide-react";
import { complianceStatus } from "@/lib/compliance";
import { ClientList } from "./client-list";

export default async function ClientsPage() {
  const clients = await prisma.client.findMany({ orderBy: { name: "asc" } });

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
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Client Management
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage your clients and contract details.
          </p>
        </div>
        <Link
          href="/clients/new"
          className="rounded-lg bg-[#166534] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#166534]/90"
        >
          + Add Client
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile label="Total Clients" value={clients.length} icon={Building2} />
        <StatTile label="Active Contracts" value={activeCount} icon={FileCheck2} />
        <StatTile
          label="Avg. Basic Rate"
          value={avgBasicRate ? `AED ${avgBasicRate.toFixed(0)}` : "—"}
          icon={DollarSign}
        />
      </div>

      {rows.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
          <p className="text-sm text-slate-500">
            No clients yet.{" "}
            <Link href="/clients/new" className="font-medium text-slate-900 underline">
              Add one
            </Link>{" "}
            or upload a time sheet — client sites are also picked up
            automatically from the &ldquo;Client Name&rdquo; column.
          </p>
        </div>
      ) : (
        <ClientList clients={rows} />
      )}
    </div>
  );
}
