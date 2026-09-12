import Link from "next/link";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/PageHeader";
import { DashboardTabs } from "@/components/DashboardTabs";
import { StatTile } from "@/components/StatTile";
import { Panel } from "@/components/DashboardPanel";
import { Badge } from "@/components/Badge";
import { getLpoAlerts } from "@/lib/lpoAlerts";
import { requireUserWithBranch } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { ClipboardList, MapPin, AlertTriangle, PauseCircle } from "lucide-react";

export default async function ProjectsDashboardPage() {
  const { branchId } = await requireUserWithBranch();
  const branchScope = branchWhere(branchId);

  const [activeCount, onHoldCount, siteCount, lpoAlerts] = await Promise.all([
    prisma.project.count({ where: { ...branchScope, status: "ACTIVE" } }),
    prisma.project.count({ where: { ...branchScope, status: "ON_HOLD" } }),
    prisma.site.count({ where: { project: branchScope } }),
    getLpoAlerts(branchId),
  ]);

  const expiringLpos = lpoAlerts.filter((a) => a.kind === "EXPIRING");
  const lowBalanceLpos = lpoAlerts.filter((a) => a.kind === "LOW_BALANCE");

  return (
    <div className="space-y-5">
      <PageHeader title="Dashboard" description="Active projects, sites, and LPO health." />
      <DashboardTabs />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile href="/projects" label="Active Projects" value={activeCount} icon={ClipboardList} />
        <StatTile href="/projects" label="On Hold" value={onHoldCount} icon={PauseCircle} />
        <StatTile href="/sites" label="Sites" value={siteCount} icon={MapPin} />
        <StatTile
          href="/projects"
          label="LPO Alerts"
          value={lpoAlerts.length}
          icon={AlertTriangle}
          tone={lpoAlerts.length > 0 ? "warning" : "default"}
          hint={`${expiringLpos.length} expiring · ${lowBalanceLpos.length} low balance`}
        />
      </div>

      <Panel title="LPOs needing attention">
        {lpoAlerts.length === 0 ? (
          <p className="text-sm text-muted">No LPO issues right now.</p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {lpoAlerts.slice(0, 10).map((a) => (
              <li key={`${a.lpoId}-${a.kind}`}>
                <Link href={`/projects/${a.projectId}`} className="flex items-center justify-between gap-3 py-2 text-sm hover:underline">
                  <span className="text-primary">{a.lpoNumber} — {a.projectName}</span>
                  <Badge color={a.kind === "EXPIRING" ? "amber" : "red"}>
                    {a.kind === "EXPIRING" ? `${a.days}d left` : "Low balance"}
                  </Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
