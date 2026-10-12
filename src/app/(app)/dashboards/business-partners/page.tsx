import { Handshake } from "lucide-react";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/PageHeader";
import { PartnersExtras } from "@/components/dashboard/ModuleExtras";
import { can } from "@/lib/permissions";
import { subjectOf } from "@/lib/auth";
import { Sec } from "@/components/dashboard/Sec";
import { CustomizeSections } from "@/components/dashboard/CustomizeSections";
import { getHiddenSections } from "@/lib/dashboardSections";
import { DashboardTabs } from "@/components/DashboardTabs";
import { KpiStrip } from "@/components/KpiStrip";
import { BarList } from "@/components/BarList";
import { Panel } from "@/components/DashboardPanel";
import { StatusDonut } from "@/components/Donut";
import { Badge } from "@/components/Badge";
import { requireUserWithBranch } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";

export default async function BusinessPartnersDashboardPage() {
  const { user, branchId } = await requireUserWithBranch();
  const branchScope = branchWhere(branchId);

  const pendingWhere = {
    ...branchScope,
    OR: [
      { approvalStatus: "Pending" },
      { labourApprovalStatus: "Pending" },
      { invoiceApprovalStatus: "Pending" },
    ],
  };

  const [
    supplierCount,
    clientCount,
    blacklistedCount,
    pendingTotal,
    pendingSuppliers,
    suppliersByStatus,
    workforceBySupplier,
  ] = await Promise.all([
    prisma.supplier.count({ where: branchScope }),
    prisma.client.count({ where: branchScope }),
    prisma.supplier.count({ where: { ...branchScope, status: "BLACKLISTED" } }),
    prisma.supplier.count({ where: pendingWhere }),
    prisma.supplier.findMany({
      where: pendingWhere,
      select: {
        id: true,
        name: true,
        approvalStatus: true,
        labourApprovalStatus: true,
        invoiceApprovalStatus: true,
      },
      orderBy: { name: "asc" },
      take: 10,
    }),
    prisma.supplier.groupBy({
      by: ["status"],
      where: branchScope,
      _count: { _all: true },
    }),
    prisma.supplier.findMany({
      where: { ...branchScope, employees: { some: {} } },
      select: { id: true, name: true, isOwnCompany: true, _count: { select: { employees: true } } },
      orderBy: { employees: { _count: "desc" } },
      take: 8,
    }),
  ]);

  const hiddenSections = await getHiddenSections(user.id, "business-partners");

  return (
    <div className="space-y-5">
      <PageHeader
        icon={Handshake}
        title="Partners overview"
        description="Suppliers, clients and pending approvals."
      actions={<CustomizeSections module="business-partners" sections={[{ id: "overview", label: "Suppliers and approvals" }, { id: "extras", label: "Licences and supplier bills" }]} hidden={[...hiddenSections]} />}
      />
      <DashboardTabs />

      <KpiStrip
        cells={[
          {
            label: "Suppliers",
            value: supplierCount,
            sub: "registered",
            href: "/suppliers",
          },
          {
            label: "Clients",
            value: clientCount,
            sub: "registered",
            href: "/clients",
          },
          {
            label: "Pending approval",
            value: pendingTotal,
            sub: "awaiting review",
            href: "/suppliers",
            tone:
              pendingTotal > 0 ? ("warning" as const) : ("default" as const),
          },
          {
            label: "Blacklisted",
            value: blacklistedCount,
            sub: "blocked from work",
            href: "/suppliers",
          },
        ]}
      />

      <Sec id="overview" hidden={hiddenSections}>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel title="Workforce by supplier" href="/suppliers" className="lg:col-span-2">
          <BarList
            tone="info"
            items={workforceBySupplier.map((sp) => ({ key: sp.id, label: sp.isOwnCompany ? `${sp.name} (own company)` : sp.name, value: sp._count.employees, href: `/suppliers/${sp.id}` }))}
            emptyLabel="No suppliers have workers on the roster yet."
          />
        </Panel>

        <Panel title="Suppliers by status" href="/suppliers">
          <StatusDonut
            items={suppliersByStatus.map((r) => ({
              status: r.status,
              count: r._count._all,
            }))}
            emptyMessage="No suppliers yet."
          />
        </Panel>

        <Panel
          title="Suppliers awaiting approval"
          href="/suppliers"
          className="lg:col-span-2"
        >
          {pendingSuppliers.length === 0 ? (
            <p className="text-sm text-muted">Nothing pending.</p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {pendingSuppliers.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/suppliers/${s.id}`}
                    className="flex items-center justify-between gap-3 py-2 text-sm hover:underline"
                  >
                    <span className="text-primary">{s.name}</span>
                    <span className="flex gap-1.5">
                      {s.approvalStatus === "Pending" && (
                        <Badge color="amber">Approval</Badge>
                      )}
                      {s.labourApprovalStatus === "Pending" && (
                        <Badge color="amber">Labour</Badge>
                      )}
                      {s.invoiceApprovalStatus === "Pending" && (
                        <Badge color="amber">Invoice</Badge>
                      )}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
      </Sec>

      <Sec id="extras" hidden={hiddenSections}>
      <PartnersExtras branchId={branchId} canBills={can(subjectOf(user), "finance", "view")} />
      </Sec>
    </div>
  );
}
