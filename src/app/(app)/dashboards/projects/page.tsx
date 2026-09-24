import Link from "next/link";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/PageHeader";
import { DashboardTabs } from "@/components/DashboardTabs";
import { KpiStrip } from "@/components/KpiStrip";
import { Panel } from "@/components/DashboardPanel";
import { StatusBreakdown } from "@/components/StatusBreakdown";
import { Badge } from "@/components/Badge";
import { getLpoAlerts } from "@/lib/lpoAlerts";
import { requireUserWithBranch } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";

export default async function ProjectsDashboardPage() {
  const { branchId } = await requireUserWithBranch();
  const branchScope = branchWhere(branchId);

  const [activeCount, onHoldCount, siteCount, lpoAlerts, projectsByStatus] =
    await Promise.all([
      prisma.project.count({ where: { ...branchScope, status: "ACTIVE" } }),
      prisma.project.count({ where: { ...branchScope, status: "ON_HOLD" } }),
      prisma.site.count({ where: { project: branchScope } }),
      getLpoAlerts(branchId),
      prisma.project.groupBy({
        by: ["status"],
        where: branchScope,
        _count: { _all: true },
      }),
    ]);

  const expiringLpos = lpoAlerts.filter((a) => a.kind === "EXPIRING");
  const lowBalanceLpos = lpoAlerts.filter((a) => a.kind === "LOW_BALANCE");

  return (
    <div className="space-y-5">
      <PageHeader
        title="Projects overview"
        description="Active projects, sites and LPO health."
      />
      <DashboardTabs />

      <KpiStrip
        cells={[
          {
            label: "Active projects",
            value: activeCount,
            sub: "in progress",
            href: "/projects",
          },
          {
            label: "On hold",
            value: onHoldCount,
            sub: "paused",
            href: "/projects",
          },
          {
            label: "Sites",
            value: siteCount,
            sub: "work locations",
            href: "/sites",
          },
          {
            label: "LPO alerts",
            value: lpoAlerts.length,
            sub: `${expiringLpos.length} expiring · ${lowBalanceLpos.length} low balance`,
            href: "/projects",
            tone:
              lpoAlerts.length > 0
                ? ("warning" as const)
                : ("default" as const),
          },
        ]}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel title="Projects by status" href="/projects">
          <StatusBreakdown
            items={projectsByStatus.map((r) => ({
              status: r.status,
              count: r._count._all,
            }))}
            unit="projects"
            emptyMessage="No projects yet."
          />
        </Panel>

        <Panel title="LPOs needing attention" className="lg:col-span-2">
          {lpoAlerts.length === 0 ? (
            <p className="text-sm text-muted">No LPO issues right now.</p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {lpoAlerts.slice(0, 10).map((a) => (
                <li key={`${a.lpoId}-${a.kind}`}>
                  <Link
                    href={`/projects/${a.projectId}`}
                    className="flex items-center justify-between gap-3 py-2 text-sm hover:underline"
                  >
                    <span className="text-primary">
                      {a.lpoNumber} — {a.projectName}
                    </span>
                    <Badge color={a.kind === "EXPIRING" ? "amber" : "red"}>
                      {a.kind === "EXPIRING"
                        ? `${a.days}d left`
                        : "Low balance"}
                    </Badge>
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
