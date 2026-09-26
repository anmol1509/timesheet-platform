import Link from "next/link";
import {
  AlertTriangle,
  BedDouble,
  CheckCircle2,
  UserPlus,
  Upload as UploadIcon,
  FileText,
  Stethoscope,
  FolderPlus,
  ClipboardList,
  FolderKanban,
  Users,
} from "lucide-react";
import { Panel, QuickAction } from "@/components/DashboardPanel";
import { DashboardKpiCards } from "@/components/DashboardKpiCards";
import { Badge } from "@/components/Badge";
import { OccupancyRing } from "@/components/OccupancyRing";
import { WorkforcePie } from "@/components/WorkforcePie";
import { WeeklyHoursChart } from "@/components/WeeklyHoursChart";
import { AssignedStaffList } from "@/components/AssignedStaffList";
import { DocumentExpiryWidget } from "@/components/DocumentExpiryWidget";
import { EmployeeTypeBreakdown } from "@/components/EmployeeTypeBreakdown";
import { ComplianceRunway } from "@/components/ComplianceRunway";
import { HoursSplitChart } from "@/components/HoursSplitChart";
import { TimesheetPipelineChart } from "@/components/TimesheetPipelineChart";
import { DeploymentPipelineFunnel } from "@/components/DeploymentPipelineFunnel";
import { RecentActivityFeed } from "@/components/RecentActivityFeed";
import { ManpowerAiCard } from "@/components/ManpowerAiCard";
import type { ComplianceRunway as Runway } from "@/lib/complianceRunway";
import type { HoursSplit } from "@/lib/attendanceHours";
import type { TimesheetPipeline } from "@/lib/timesheetPipeline";
import type { ComplianceAlert } from "@/lib/dashboardAlerts";
import type { LpoAlert } from "@/lib/lpoAlerts";
import type { WeeklyHoursDay } from "@/lib/weeklyHours";
import type { AssignedStaffRow } from "@/lib/assignedStaff";
import type { DocumentExpiryCategory } from "@/lib/documentExpiryCounts";
import type { EmployeeTypeCounts } from "@/lib/employeeTypeCounts";
import type { EntityCounts } from "@/lib/entityCounts";
import type { DeploymentStage } from "@/lib/deploymentPipeline";
import type { RecentActivityRow } from "@/lib/recentActivity";
import { cn } from "@/lib/cn";

function formatMonthLabel(month: string) {
  const [y, m] = month.split("-");
  const date = new Date(Number(y), Number(m) - 1, 1);
  return date.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

export type AttentionItem = {
  key: string;
  href: string;
  title: string;
  sub: string;
  overdue: boolean;
  badge: string;
};

export type DashboardData = {
  employeeCount: number;
  onWorkCount: number;
  benchCount: number;
  deployedPct: number;
  activeProjectCount: number;
  activeClientCount: number;
  alerts: ComplianceAlert[];
  lpoAlerts: LpoAlert[];
  expiredCount: number;
  attention: AttentionItem[];
  weeklyHours: WeeklyHoursDay[];
  hoursSplit: HoursSplit;
  timesheetPipeline: TimesheetPipeline;
  complianceRunway: Runway;
  documentExpiryCounts: DocumentExpiryCategory[];
  employeeTypeCounts: EmployeeTypeCounts;
  entityCounts: EntityCounts;
  assignedStaff: AssignedStaffRow[];
  totalBeds: number;
  occupiedBeds: number;
  vacantBeds: number;
  occupancyPct: number;
  latestUpload: { uploadedAt: Date; uploadedBy: { name: string } } | null;
  months: { month: string }[];
  deploymentPipeline: DeploymentStage[];
  recentActivity: RecentActivityRow[];
  /** Headcount at the end of each of the last six months, oldest first. */
  headcountTrend: number[];
  newThisMonth: number;
  activeProjects: { id: string; name: string; code: string; clientName: string; workers: number; required: number | null }[];
};

export type DashboardWidget = {
  id: string;
  label: string;
  render: (data: DashboardData) => React.ReactNode;
};

// The customize panel shows/reorders these as whole units, not the finer
// StatTile-by-StatTile grain — a widget here is one visually coherent block
// (sometimes two panels sharing a row), which keeps the reorder UI to a
// manageable handful of items instead of two dozen.
export const DASHBOARD_WIDGETS: DashboardWidget[] = [
  {
    id: "kpi",
    label: "KPI cards (workforce, deployment, projects, attention)",
    render: (d) => (
      <DashboardKpiCards
        employeeCount={d.employeeCount}
        onWorkCount={d.onWorkCount}
        benchCount={d.benchCount}
        deployedPct={d.deployedPct}
        activeProjectCount={d.activeProjectCount}
        activeClientCount={d.activeClientCount}
        attentionCount={d.alerts.length + d.lpoAlerts.length}
        expiredCount={d.expiredCount}
        headcountTrend={d.headcountTrend}
        newThisMonth={d.newThisMonth}
      />
    ),
  },
  {
    id: "trend-attention",
    label: "Hours trend + Needs attention queue",
    render: (d) => (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel
          title="Hours — normal vs overtime"
          className="lg:col-span-2"
          href="/attendance"
          linkLabel="Attendance"
        >
          <HoursSplitChart split={d.hoursSplit} />
        </Panel>

        <Panel
          title="Needs attention"
          icon={AlertTriangle}
          href="/documents"
          className="scroll-mt-20"
          bodyClassName="p-0"
        >
          <div id="needs-attention" />
          {d.attention.length === 0 ? (
            <div className="flex flex-col items-center px-5 py-10 text-center">
              <CheckCircle2 className="mb-2 h-5 w-5 text-[var(--success)]" aria-hidden />
              <p className="text-sm font-medium text-primary">All clear</p>
              <p className="mt-1 text-xs text-muted">Nothing expires in the next 30 days.</p>
            </div>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {d.attention.map((item) => (
                <li key={item.key} className="px-5 py-3">
                  <div className="flex items-start gap-3">
                    <span
                      className={cn(
                        "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
                        item.overdue ? "bg-[var(--error-soft)] text-[var(--error)]" : "bg-[var(--warning-soft)] text-[var(--warning)]"
                      )}
                    >
                      <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-primary">{item.title}</span>
                      <span className="block truncate text-xs text-muted">{item.sub}</span>
                    </span>
                    <Badge color={item.overdue ? "red" : "amber"}>{item.badge}</Badge>
                  </div>
                  <div className="mt-2 flex gap-2 pl-10">
                    <Link href={item.href} className="rounded-full border border-default px-2.5 py-1 text-xs font-medium text-secondary transition hover:border-strong hover:text-primary">
                      View employee
                    </Link>
                    <Link href={item.href} className="rounded-full border border-default px-2.5 py-1 text-xs font-medium text-secondary transition hover:border-strong hover:text-primary">
                      Renew document
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    ),
  },
  {
    id: "utilization-projects",
    label: "Workforce utilization + Active projects",
    render: (d) => (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel title="Workforce utilization" icon={Users} href="/employees?filter=bench" linkLabel="View bench">
          <WorkforcePie onWork={d.onWorkCount} bench={d.benchCount} />
        </Panel>
        <Panel title="Active projects" icon={FolderKanban} className="lg:col-span-2" href="/projects" bodyClassName="p-0">
          {d.activeProjects.length === 0 ? (
            <div className="flex flex-col items-center px-5 py-10 text-center">
              <p className="text-sm font-medium text-primary">No active projects</p>
              <p className="mt-1 text-xs text-muted">Projects marked Active appear here with their workforce.</p>
              <Link href="/projects/new" className="btn btn-secondary btn-sm mt-3">Create project</Link>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-default text-left text-xs uppercase">
                <tr>
                  <th className="px-5">Project / Client</th>
                  <th className="px-3 text-right">Workers</th>
                  <th className="w-2/5 px-5">Capacity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {d.activeProjects.map((p) => {
                  // Staffed against the project's required headcount when it has
                  // one; otherwise its share of everyone deployed.
                  const share = p.required
                    ? Math.round((p.workers / p.required) * 100)
                    : d.onWorkCount > 0
                      ? Math.round((p.workers / d.onWorkCount) * 100)
                      : 0;
                  const barColor = !p.required ? "bg-[var(--brand-primary)]" : share >= 90 ? "bg-[var(--success)]" : share >= 60 ? "bg-[var(--info)]" : "bg-[var(--warning)]";
                  return (
                    <tr key={p.id} className="transition-colors hover:bg-surface-subtle">
                      <td className="px-5 py-3">
                        <Link href={`/projects/${p.id}`} className="group flex items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-violet-100 text-[11px] font-bold text-violet-600">
                            {p.code.slice(-3)}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-primary group-hover:underline">{p.name}</span>
                            <span className="block truncate text-xs text-subtle">{p.clientName}</span>
                          </span>
                        </Link>
                      </td>
                      <td className="tabular px-3 py-3 text-right font-semibold text-primary">
                        {p.workers}
                        {p.required ? <span className="font-normal text-subtle"> / {p.required}</span> : null}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-sunken">
                            <div className={cn("h-full rounded-full", barColor)} style={{ width: `${Math.min(100, share)}%` }} />
                          </div>
                          <span className="tabular w-16 text-right text-xs font-medium text-muted">{share}%{p.required ? "" : " of all"}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Panel>
      </div>
    ),
  },
  {
    id: "deployment-pipeline",
    label: "Deployment pipeline + Recent activity",
    render: (d) => (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel title="Deployment pipeline" className="lg:col-span-2" href="/employees" linkLabel="Workforce">
          <DeploymentPipelineFunnel stages={d.deploymentPipeline} />
        </Panel>

        <Panel title="Recent activity">
          <RecentActivityFeed rows={d.recentActivity} />
        </Panel>
      </div>
    ),
  },
  {
    id: "timesheet-pipeline",
    label: "Timesheet pipeline + Hours by weekday",
    render: (d) => (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel
          title="Timesheet pipeline"
          className="lg:col-span-2"
          href="/invoices/client-timesheet"
          linkLabel="Open timesheets"
        >
          <TimesheetPipelineChart pipeline={d.timesheetPipeline} />
        </Panel>

        <Panel title="Hours by weekday" href="/history" linkLabel="History">
          <WeeklyHoursChart days={d.weeklyHours} />
        </Panel>
      </div>
    ),
  },
  {
    id: "compliance-runway",
    label: "Compliance runway (90-day document expiry)",
    render: (d) => (
      <Panel
        title="Compliance runway"
        icon={AlertTriangle}
        href="/employees/renewals"
        linkLabel="Renewals"
      >
        <ComplianceRunway runway={d.complianceRunway} />
      </Panel>
    ),
  },
  {
    id: "document-expiry",
    label: "Document expiry counters",
    render: (d) => (
      <section>
        <h2 className="mb-2.5 text-sm font-semibold text-primary">Document expiry</h2>
        <DocumentExpiryWidget categories={d.documentExpiryCounts} />
      </section>
    ),
  },
  {
    id: "composition",
    label: "Workforce by type",
    render: (d) => (
      <Panel title="Workforce by type" icon={Users} href="/employees">
        <EmployeeTypeBreakdown counts={d.employeeTypeCounts} />
      </Panel>
    ),
  },
  {
    id: "staff-partners-facilities",
    label: "Assigned staff + Business associates + Camp occupancy",
    render: (d) => (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel title="Assigned staff" href="/employees">
          <AssignedStaffList staff={d.assignedStaff} />
        </Panel>

        <Panel title="Business associates">
          <ul className="space-y-1">
            {[
              { label: "Clients", value: d.entityCounts.clients, href: "/clients" },
              { label: "Suppliers", value: d.entityCounts.suppliers, href: "/suppliers" },
              { label: "Projects", value: d.entityCounts.projects, href: "/projects" },
            ].map((row) => (
              <li key={row.label}>
                <Link href={row.href} className="-mx-2 flex items-center justify-between rounded-control px-2 py-1.5 text-sm transition hover:bg-surface-hover">
                  <span className="text-muted">{row.label}</span>
                  <span className="tabular font-semibold text-primary">{row.value}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>

        {d.totalBeds > 0 ? (
          <Panel title="Camp occupancy" icon={BedDouble} href="/accommodation/camps">
            <OccupancyRing occupied={d.occupiedBeds} vacant={d.vacantBeds} pct={d.occupancyPct} />
          </Panel>
        ) : (
          <Panel title="Timesheet activity" href="/upload" linkLabel="Upload">
            <p className="text-sm text-secondary">
              Last upload:{" "}
              {d.latestUpload ? (
                <span className="font-medium text-primary">
                  {new Date(d.latestUpload.uploadedAt).toLocaleString("en-GB", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  by {d.latestUpload.uploadedBy.name}
                </span>
              ) : (
                <span className="text-subtle">No uploads yet</span>
              )}
            </p>
          </Panel>
        )}
      </div>
    ),
  },
  {
    id: "quick-actions",
    label: "Quick actions + Assistant AI",
    render: () => (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <h2 className="mb-2.5 text-sm font-semibold text-primary">Quick actions</h2>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <QuickAction href="/employees/new" icon={UserPlus} label="Add employee" sub="Register a new worker" />
            <QuickAction href="/projects/new" icon={FolderPlus} label="Create project" sub="Set up a new project" />
            <QuickAction href="/demand/new" icon={ClipboardList} label="Add demand" sub="Raise a labour request" />
            <QuickAction href="/upload" icon={UploadIcon} label="Submit timesheet" sub="Record work hours" />
            <QuickAction href="/documents" icon={FileText} label="Upload documents" sub="Add worker documents" />
            <QuickAction href="/employees" icon={Stethoscope} label="Medical checks" sub="Review medical expiry" />
          </div>
        </section>

        <ManpowerAiCard />
      </div>
    ),
  },
  {
    id: "months-with-data",
    label: "Months with data (footer strip)",
    render: (d) =>
      d.months.length > 0 ? (
        <section className="card card-padded">
          <h2 className="text-sm font-semibold text-primary">Months with data</h2>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {d.months.map((m) => (
              <span key={m.month} className="rounded-md border border-default bg-surface-subtle px-2 py-0.5 text-xs font-medium text-secondary">
                {formatMonthLabel(m.month)}
              </span>
            ))}
          </div>
        </section>
      ) : null,
  },
];

/**
 * A saved order plus any widgets added since it was saved. New widgets go in
 * right after the widget that precedes them in the default order, rather than
 * all piling up at the bottom of an existing user's dashboard.
 */
export function mergeWidgetOrder(saved: string[]): string[] {
  const ids = DASHBOARD_WIDGETS.map((w) => w.id);
  const order = saved.filter((id) => ids.includes(id));
  ids.forEach((id, i) => {
    if (order.includes(id)) return;
    const prev = ids.slice(0, i).reverse().find((p) => order.includes(p));
    order.splice(prev ? order.indexOf(prev) + 1 : 0, 0, id);
  });
  return order;
}

export function orderedVisibleWidgets(hiddenWidgets: string[], widgetOrder: string[]): DashboardWidget[] {
  const byId = new Map(DASHBOARD_WIDGETS.map((w) => [w.id, w]));
  return mergeWidgetOrder(widgetOrder)
    .filter((id) => !hiddenWidgets.includes(id))
    .map((id) => byId.get(id)!)
    .filter(Boolean);
}
