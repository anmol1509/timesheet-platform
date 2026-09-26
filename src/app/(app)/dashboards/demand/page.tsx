import { ClipboardList } from "lucide-react";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/PageHeader";
import { DashboardTabs } from "@/components/DashboardTabs";
import { KpiStrip } from "@/components/KpiStrip";
import { Panel } from "@/components/DashboardPanel";
import { Badge } from "@/components/Badge";
import { approvedHeadcount } from "@/lib/demandApproval";
import { requireUserWithBranch } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";

export default async function DemandDashboardPage() {
  const { branchId } = await requireUserWithBranch();
  const branchScope = branchWhere(branchId);

  const [openCount, demands] = await Promise.all([
    prisma.demandRequest.count({
      where: { ...branchScope, status: { notIn: ["Rejected", "Closed"] } },
    }),
    prisma.demandRequest.findMany({
      where: { ...branchScope, status: { notIn: ["Rejected", "Closed"] } },
      include: {
        client: { select: { name: true } },
        project: { select: { name: true, code: true } },
        trades: {
          select: {
            quantity: true,
            approvedQuantity: true,
            _count: { select: { allocations: true } },
          },
        },
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

  const totalNeeded = rows.reduce((s, r) => s + r.needed, 0);
  const totalFilled = rows.reduce((s, r) => s + r.filled, 0);
  const fulfilmentPct =
    totalNeeded > 0 ? Math.round((totalFilled / totalNeeded) * 100) : 0;
  const shortfall = rows.filter((r) => r.filled < r.needed);
  const pendingApprovalCount = rows.filter((r) => r.pendingApproval).length;

  return (
    <div className="space-y-5">
      <PageHeader
        icon={ClipboardList}
        title="Demand overview"
        description="Open manpower requests and how well they are staffed."
      />
      <DashboardTabs />

      <KpiStrip
        cells={[
          {
            label: "Open requests",
            value: openCount,
            sub: "still being fulfilled",
            href: "/demand",
          },
          {
            label: "Short-staffed",
            value: shortfall.length,
            sub: "requests below headcount",
            href: "/demand/mobilisation",
            tone:
              shortfall.length > 0
                ? ("warning" as const)
                : ("default" as const),
          },
          {
            label: "Awaiting approval",
            value: pendingApprovalCount,
            sub: "need a decision",
            href: "/demand",
            tone:
              pendingApprovalCount > 0
                ? ("warning" as const)
                : ("default" as const),
          },
          {
            label: "Total fulfilment",
            value: `${rows.reduce((s, r) => s + r.filled, 0)}/${rows.reduce((s, r) => s + r.needed, 0)}`,
            sub: "filled / needed",
            href: "/demand/mobilisation",
          },
        ]}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel
          title="Fulfilment"
          href="/demand/mobilisation"
          linkLabel="Mobilisation"
        >
          <div className="space-y-4">
            <div>
              <span className="tabular text-3xl font-semibold tracking-tight text-primary">
                {fulfilmentPct}%
              </span>
              <span className="ml-2 text-sm text-muted">
                of approved headcount filled
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-[var(--surface-sunken)]">
              <div
                className="h-full rounded-full bg-[var(--brand-primary)]"
                style={{ width: `${fulfilmentPct}%` }}
              />
            </div>
            <p className="text-xs text-subtle">
              {totalFilled} of {totalNeeded} workers across {rows.length} open
              requests
            </p>
          </div>
        </Panel>

        <Panel
          title="Requests short of headcount"
          href="/demand/mobilisation"
          className="lg:col-span-2"
        >
          {shortfall.length === 0 ? (
            <p className="text-sm text-muted">
              Every open request is fully staffed.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {shortfall.slice(0, 10).map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/demand/${r.id}`}
                    className="flex items-center justify-between gap-3 py-2 text-sm hover:underline"
                  >
                    <span className="text-primary">
                      #{r.requestNo} — {r.clientName} ({r.projectLabel})
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-[var(--surface-sunken)] sm:block">
                        <span
                          className="block h-full rounded-full bg-[var(--warning)]"
                          style={{
                            width: `${r.needed > 0 ? (r.filled / r.needed) * 100 : 0}%`,
                          }}
                        />
                      </span>
                      <Badge color="amber">
                        {r.filled}/{r.needed}
                      </Badge>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
