import Link from "next/link";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/PageHeader";
import { StatTile } from "@/components/StatTile";
import { Panel } from "@/components/DashboardPanel";
import { Badge } from "@/components/Badge";
import { requireUserWithBranch } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { Truck, Building2, Clock, Ban } from "lucide-react";

export default async function BusinessPartnersDashboardPage() {
  const { branchId } = await requireUserWithBranch();
  const branchScope = branchWhere(branchId);

  const pendingWhere = {
    ...branchScope,
    OR: [{ approvalStatus: "Pending" }, { labourApprovalStatus: "Pending" }, { invoiceApprovalStatus: "Pending" }],
  };

  const [supplierCount, clientCount, blacklistedCount, pendingTotal, pendingSuppliers] = await Promise.all([
    prisma.supplier.count({ where: branchScope }),
    prisma.client.count({ where: branchScope }),
    prisma.supplier.count({ where: { ...branchScope, status: "BLACKLISTED" } }),
    prisma.supplier.count({ where: pendingWhere }),
    prisma.supplier.findMany({
      where: pendingWhere,
      select: { id: true, name: true, approvalStatus: true, labourApprovalStatus: true, invoiceApprovalStatus: true },
      orderBy: { name: "asc" },
      take: 10,
    }),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader title="Business Partners Dashboard" description="Suppliers and clients at a glance." />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile href="/suppliers" label="Suppliers" value={supplierCount} icon={Truck} />
        <StatTile href="/clients" label="Clients" value={clientCount} icon={Building2} />
        <StatTile
          href="/suppliers"
          label="Pending Approval"
          value={pendingTotal}
          icon={Clock}
          tone={pendingTotal > 0 ? "warning" : "default"}
        />
        <StatTile href="/suppliers" label="Blacklisted" value={blacklistedCount} icon={Ban} />
      </div>

      <Panel title="Suppliers awaiting approval" href="/suppliers">
        {pendingSuppliers.length === 0 ? (
          <p className="text-sm text-muted">Nothing pending.</p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {pendingSuppliers.map((s) => (
              <li key={s.id}>
                <Link href={`/suppliers/${s.id}`} className="flex items-center justify-between gap-3 py-2 text-sm hover:underline">
                  <span className="text-primary">{s.name}</span>
                  <span className="flex gap-1.5">
                    {s.approvalStatus === "Pending" && <Badge color="amber">Approval</Badge>}
                    {s.labourApprovalStatus === "Pending" && <Badge color="amber">Labour</Badge>}
                    {s.invoiceApprovalStatus === "Pending" && <Badge color="amber">Invoice</Badge>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
