import Link from "next/link";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/PageHeader";
import { DashboardTabs } from "@/components/DashboardTabs";
import { StatTile } from "@/components/StatTile";
import { Panel } from "@/components/DashboardPanel";
import { Badge } from "@/components/Badge";
import { approvedHeadcount } from "@/lib/demandApproval";
import { requireUserWithBranch } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { ListChecks, HardHat, Clock } from "lucide-react";

export default async function DemandDashboardPage() {
  const { branchId } = await requireUserWithBranch();
  const branchScope = branchWhere(branchId);

  const [openCount, demands] = await Promise.all([
    prisma.demandRequest.count({ where: { ...branchScope, status: { notIn: ["Rejected", "Closed"] } } }),
    prisma.demandRequest.findMany({
      where: { ...branchScope, status: { notIn: ["Rejected", "Closed"] } },
      include: {
        client: { select: { name: true } },
        project: { select: { name: true, code: true } },
        trades: { select: { quantity: true, approvedQuantity: true, _count: { select: { allocations: true } } } },
      },
      orderBy: { requestNo: "desc" },
    }),
  ]);

  const rows = demands.map((d) => ({
    id: d.id,
    requestNo: d.requestNo,
    clientName: d.client.name,
    projectLabel: `${d.project.code} — ${d.project.name}`,
    needed: d.trades.reduce((sum, t) => sum + approvedHeadcount(t), 0),
    filled: d.trades.reduce((sum, t) => sum + t._count.allocations, 0),
    pendingApproval: d.trades.some((t) => t.approvedQuantity == null),
  }));

  const shortfall = rows.filter((r) => r.filled < r.needed);
  const pendingApprovalCount = rows.filter((r) => r.pendingApproval).length;

  return (
    <div className="space-y-5">
      <PageHeader title="Dashboard" description="Open demand requests and mobilisation progress." />
      <DashboardTabs />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile href="/demand" label="Open Requests" value={openCount} icon={ListChecks} />
        <StatTile href="/demand/mobilisation" label="Short-Staffed" value={shortfall.length} icon={HardHat} tone={shortfall.length > 0 ? "warning" : "default"} />
        <StatTile href="/demand" label="Awaiting Approval" value={pendingApprovalCount} icon={Clock} tone={pendingApprovalCount > 0 ? "warning" : "default"} />
        <StatTile
          href="/demand/mobilisation"
          label="Total Fulfilment"
          value={`${rows.reduce((s, r) => s + r.filled, 0)}/${rows.reduce((s, r) => s + r.needed, 0)}`}
          icon={ListChecks}
        />
      </div>

      <Panel title="Requests short of headcount" href="/demand/mobilisation">
        {shortfall.length === 0 ? (
          <p className="text-sm text-muted">Every open request is fully staffed.</p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {shortfall.slice(0, 10).map((r) => (
              <li key={r.id}>
                <Link href={`/demand/${r.id}`} className="flex items-center justify-between gap-3 py-2 text-sm hover:underline">
                  <span className="text-primary">#{r.requestNo} — {r.clientName} ({r.projectLabel})</span>
                  <Badge color="amber">{r.filled}/{r.needed}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
