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
  Truck,
  Package,
} from "lucide-react";
import type { ApprovalsSummary, AttendanceToday, DemandFill, MoneySnapshot, OperationsSnapshot, PayrollStatus } from "@/lib/dashboardExtras";
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
import { AttentionRow, type AttentionItem as ActionItem } from "@/components/dashboard/AttentionList";

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
  /** Optional sections; null when the person may not see them or has switched them off. */
  approvalsSummary: ApprovalsSummary | null;
  attendanceToday: AttendanceToday | null;
  /** Wrapped so "no payroll run yet" (run: null) differs from "may not see payroll" (null). */
  payrollStatus: { run: PayrollStatus } | null;
  money: MoneySnapshot | null;
  demandFill: DemandFill | null;
  operations: OperationsSnapshot | null;
  activeProjects: { id: string; name: string; code: string; clientName: string; workers: number; required: number | null }[];
};

/** The headed groups the dashboard is laid out in, top to bottom. */
export const DASHBOARD_SECTIONS = [
  { id: "overview", label: null },
  { id: "people", label: "People & deployment" },
  { id: "hours", label: "Hours & timesheets" },
  { id: "money", label: "Money" },
  { id: "business", label: "Sales, hiring & facilities" },
  { id: "compliance", label: "Compliance" },
  { id: "more", label: "More" },
] as const;
export type DashboardSectionId = (typeof DASHBOARD_SECTIONS)[number]["id"];

export type DashboardWidget = {
  id: string;
  label: string;
  section: DashboardSectionId;
  render: (data: DashboardData) => React.ReactNode;
};

// The customize panel shows/reorders these as whole units, not the finer
// StatTile-by-StatTile grain — a widget here is one visually coherent block
// (sometimes two panels sharing a row), which keeps the reorder UI to a
// manageable handful of items instead of two dozen.
export const DASHBOARD_WIDGETS: DashboardWidget[] = [
  {
    id: "kpi",
    section: "overview",
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
    id: "today",
    section: "overview",
    label: "Needs you today + Demand fill",
    render: (d) => {
      const todo = buildTodo(d);
      const f = d.demandFill;
      if (todo.length === 0 && !d.approvalsSummary && !d.attendanceToday && !d.payrollStatus && !f) return null;
      const shown = todo.slice(0, 5);
      const rest = todo.slice(5);
      return (
        <div className={`grid grid-cols-1 gap-4 ${f ? "lg:grid-cols-3" : ""}`}>
          <section className={cn("card overflow-hidden", f && "lg:col-span-2")}>
            <div className="card-header">
              <h2 className="text-[15px] font-semibold tracking-tight text-primary">Needs you today</h2>
              {todo.length > 0 && <span className="text-xs text-muted">{todo.length} item{todo.length === 1 ? "" : "s"} · most urgent first</span>}
            </div>
            {todo.length === 0 ? (
              <div className="flex flex-col items-center px-5 py-10 text-center">
                <CheckCircle2 className="mb-2 h-5 w-5 text-[var(--success)]" aria-hidden />
                <p className="text-sm font-medium text-primary">All clear</p>
                <p className="mt-1 text-xs text-muted">Nothing is waiting for you right now.</p>
              </div>
            ) : (
              <>
                <ul className="divide-y divide-[var(--border)]">{shown.map((t) => <AttentionRow key={t.key} item={t} />)}</ul>
                {rest.length > 0 && (
                  <details className="group border-t border-default">
                    <summary className="cursor-pointer px-5 py-3 text-sm font-medium text-[var(--brand-primary)] hover:underline group-open:hidden">Show {rest.length} more</summary>
                    <ul className="divide-y divide-[var(--border)]">{rest.map((t) => <AttentionRow key={t.key} item={t} />)}</ul>
                  </details>
                )}
              </>
            )}
          </section>
          {f && <DemandPanel f={f} />}
        </div>
      );
    },
  },
  {
    id: "money-demand",
    section: "money",
    label: "Money in and out + Payroll",
    render: (d) => {
      const m = d.money;
      const p = d.payrollStatus;
      if (!m && !p) return null;
      const aed = (n: number) => `AED ${Math.round(n).toLocaleString()}`;
      return (
        <div className={`grid grid-cols-1 gap-4 ${m && p ? "lg:grid-cols-3" : ""}`}>
          {m && (
            <Panel title="Money in and out" icon={FileText} className={p ? "lg:col-span-2" : undefined} href={m.scope.invoices ? "/dashboards/billing" : "/finance/bills"} linkLabel={m.scope.invoices ? "Billing" : "Bills"}>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {m.scope.invoices && (
                  <>
                    <Stat label="Invoiced this month" value={aed(m.invoicedThisMonth)} sub={`${m.invoicedCount} invoice${m.invoicedCount === 1 ? "" : "s"}`} />
                    <Stat label="Waiting to be paid" value={aed(m.outstanding)} sub={`${m.outstandingCount} invoice${m.outstandingCount === 1 ? "" : "s"}`} />
                    <Stat label="Overdue from clients" value={aed(m.overdue)} sub={`${m.overdueCount} invoice${m.overdueCount === 1 ? "" : "s"}`} tone={m.overdue > 0 ? "danger" : undefined} href="/invoices/history" />
                  </>
                )}
                {m.scope.bills && (
                  <>
                    <Stat label="Supplier bills due in 7 days" value={aed(m.billsDueSoon.amount)} sub={`${m.billsDueSoon.count} bill${m.billsDueSoon.count === 1 ? "" : "s"}`} tone={m.billsDueSoon.count > 0 ? "warning" : undefined} href="/finance/bills" />
                    <Stat label="Supplier bills overdue" value={aed(m.billsOverdue.amount)} sub={`${m.billsOverdue.count} bill${m.billsOverdue.count === 1 ? "" : "s"}`} tone={m.billsOverdue.count > 0 ? "danger" : undefined} href="/finance/bills" />
                    <Stat label="We owe suppliers" value={aed(m.owedToSuppliers)} sub="approved bills, unpaid" href="/finance/bills" />
                  </>
                )}
              </div>
            </Panel>
          )}
          {p && <PayrollPanel p={p} />}
        </div>
      );
    },
  },
  {
    id: "trend-attention",
    section: "hours",
    label: "Hours: normal vs overtime + Hours by weekday",
    render: (d) => (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel title="Hours: normal vs overtime" className="lg:col-span-2" href="/attendance" linkLabel="Attendance">
          <HoursSplitChart split={d.hoursSplit} />
        </Panel>
        <Panel title="Hours by weekday" href="/history" linkLabel="History">
          <WeeklyHoursChart days={d.weeklyHours} />
        </Panel>
      </div>
    ),
  },
  {
    id: "utilization-projects",
    section: "people",
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
    section: "people",
    label: "Deployment pipeline + Workforce by type",
    render: (d) => (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel title="Deployment pipeline" className="lg:col-span-2" href="/employees" linkLabel="Workforce">
          <DeploymentPipelineFunnel stages={d.deploymentPipeline} />
        </Panel>
        <Panel title="Workforce by type" icon={Users} href="/employees">
          <EmployeeTypeBreakdown counts={d.employeeTypeCounts} />
        </Panel>
      </div>
    ),
  },
  {
    id: "timesheet-pipeline",
    section: "hours",
    label: "Timesheet pipeline",
    render: (d) => (
      <Panel title="Timesheet pipeline" href="/invoices/client-timesheet" linkLabel="Open timesheets">
        <TimesheetPipelineChart pipeline={d.timesheetPipeline} />
      </Panel>
    ),
  },
  {
    id: "business",
    section: "business",
    label: "Sales, Onboarding, Applications, Transport, Inventory",
    render: (d) => {
      const o = d.operations;
      if (!o) return null;
      const cards: React.ReactNode[] = [];
      if (o.sales) {
        const s = o.sales;
        cards.push(
          <MiniCard key="sales" title="Sales" icon={FileText} href="/sales" linkLabel="Pipeline" lines={[
            { label: "Follow-ups due", value: s.followUpsDue, warn: s.followUpsDue > 0 },
            { label: "Open enquiries", value: s.openEnquiries },
            { label: "Quotations sent or negotiating", value: s.sentQuotes },
            { label: "Quotations still in draft", value: s.draftQuotes },
            { label: "Quotations expiring this week", value: s.expiringQuotes, warn: s.expiringQuotes > 0 },
          ]} />,
        );
      }
      if (o.onboarding) {
        cards.push(
          <MiniCard key="onb" title="Onboarding" icon={UserPlus} href="/onboarding" linkLabel="Candidate tracker" lines={[
            { label: "Candidates in progress", value: o.onboarding.inProgress },
            { label: "Ready to join", value: o.onboarding.readyToJoin, good: o.onboarding.readyToJoin > 0 },
          ]} />,
        );
      }
      if (o.applications) {
        cards.push(
          <MiniCard key="apps" title="Visa & labour cards" icon={ClipboardList} href="/employees/renewals" linkLabel="Renewals" lines={[
            { label: "Visa applications in progress", value: o.applications.visa },
            { label: "Labour card applications in progress", value: o.applications.labourCard },
          ]} />,
        );
      }
      if (o.transport) {
        const t = o.transport;
        cards.push(
          <MiniCard key="transport" title="Transport" icon={Truck} href="/transport" linkLabel="Vehicles" lines={[
            { label: "Active vehicles", value: t.vehicles },
            { label: "Registration or insurance expired", value: t.expired, bad: t.expired > 0 },
            { label: "Expiring in 30 days", value: t.expiringSoon, warn: t.expiringSoon > 0 },
            { label: "In maintenance", value: t.inMaintenance },
          ]} />,
        );
      }
      if (o.inventory) {
        const i = o.inventory;
        cards.push(
          <MiniCard key="inv" title="Inventory" icon={Package} href="/inventory" linkLabel="Stock" lines={[
            { label: "Sizes out of stock", value: i.out, bad: i.out > 0 },
            { label: "Sizes running low", value: i.low, warn: i.low > 0 },
            { label: "Items held by workers", value: i.itemsHeld },
          ]} />,
        );
      }
      if (cards.length === 0) return null;
      return <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">{cards}</div>;
    },
  },
  {
    id: "compliance-runway",
    section: "compliance",
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
    section: "compliance",
    label: "Document expiry counters",
    render: (d) => (
      <section>
        <h2 className="mb-2.5 text-sm font-semibold text-primary">Document expiry</h2>
        <DocumentExpiryWidget categories={d.documentExpiryCounts} />
      </section>
    ),
  },
  {
    id: "staff-partners-facilities",
    section: "people",
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
    id: "activity",
    section: "more",
    label: "Recent activity",
    render: (d) => (
      <Panel title="Recent activity" href="/audit-log" linkLabel="Audit log">
        <RecentActivityFeed rows={d.recentActivity} />
      </Panel>
    ),
  },
  {
    id: "quick-actions",
    section: "more",
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
    section: "more",
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

function Stat({ label, value, sub, tone, href }: { label: string; value: string; sub?: string; tone?: "danger" | "warning"; href?: string }) {
  const body = (
    <>
      <p className="text-xs text-muted">{label}</p>
      <p className={`tabular mt-0.5 text-lg font-semibold ${tone === "danger" ? "text-[var(--error)]" : tone === "warning" ? "text-[var(--warning)]" : "text-primary"}`}>{value}</p>
      {sub && <p className="text-[11px] text-subtle">{sub}</p>}
    </>
  );
  return href ? (
    <Link href={href} className="block rounded-lg border border-default p-3 transition hover:bg-surface-hover">{body}</Link>
  ) : (
    <div className="rounded-lg border border-default p-3">{body}</div>
  );
}

type TodoItem = ActionItem;

/** Everything waiting on this person, most urgent first. Shared with the page so the greeting can count it. */
export function buildTodo(d: DashboardData): TodoItem[] {
  const out: (TodoItem & { rank: number })[] = [];
  const aed = (n: number) => `AED ${Math.round(n).toLocaleString()}`;
  const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

  const expired = d.alerts.filter((a) => a.days < 0);
  const soon = d.alerts.filter((a) => a.days >= 0);
  if (expired.length > 0) {
    out.push({ rank: 10, key: "expired", tone: "red", icon: AlertTriangle, title: `${plural(expired.length, "document")} expired`, sub: expired.slice(0, 3).map((a) => `${a.field}: ${a.name}`).join(", ") + (expired.length > 3 ? ` and ${expired.length - 3} more` : ""), href: "/employees/renewals", action: "Review", tag: "Expired" });
  }
  const m = d.money;
  if (m?.scope.bills && m.billsOverdue.count > 0) {
    out.push({ rank: 20, key: "bills-overdue", tone: "red", icon: FileText, title: `${aed(m.billsOverdue.amount)} overdue to suppliers`, sub: `${plural(m.billsOverdue.count, "supplier bill")} past due`, href: "/finance/bills", action: "Review bills" });
  }
  if (m?.scope.invoices && m.overdueCount > 0) {
    out.push({ rank: 30, key: "inv-overdue", tone: "red", icon: FileText, title: `${aed(m.overdue)} overdue from clients`, sub: `${plural(m.overdueCount, "invoice")} past due`, href: "/invoices/history", action: "Chase" });
  }
  const a = d.approvalsSummary;
  if (a && a.total > 0) {
    out.push({ rank: a.oldestDays > 7 ? 15 : 40, key: "approvals", tone: a.oldestDays > 7 ? "red" : "amber", icon: CheckCircle2, title: `${plural(a.total, "approval")} waiting`, sub: a.byKind.slice(0, 4).map((k) => `${k.label} ${k.count}`).join(" · "), href: "/approvals", action: "Open inbox", tag: a.oldestDays > 0 ? `${a.oldestDays}d old` : undefined });
  }
  const t = d.attendanceToday;
  if (t && t.expected > 0 && t.unmarked > 0) {
    out.push({ rank: 50, key: "attendance", tone: "amber", icon: Users, title: "Attendance not marked today", sub: `${plural(t.unmarked, "worker")} not marked${t.byProject.length > 0 ? ` across ${plural(t.byProject.length, "project")}` : ""}`, href: "/attendance", action: "Mark" });
  }
  const run = d.payrollStatus?.run;
  if (run && run.status !== "PAID") {
    const label = run.status === "APPROVED" ? "approved, waiting to be paid" : run.submitted ? "awaiting approval" : "in draft";
    out.push({ rank: 60, key: "payroll", tone: "blue", icon: FileText, title: `${formatMonthLabel(run.month)} payroll ${label}`, sub: `${plural(run.workers, "worker")} · net ${aed(run.netTotal)}`, href: `/payroll/${run.runId}`, action: "Open run" });
  }
  if (d.payrollStatus && !run) {
    // nothing yet — the payroll page explains how to start one
  }
  if (m?.scope.bills && m.billsDueSoon.count > 0) {
    out.push({ rank: 70, key: "bills-soon", tone: "amber", icon: FileText, title: `${aed(m.billsDueSoon.amount)} due to suppliers this week`, sub: plural(m.billsDueSoon.count, "bill"), href: "/finance/bills", action: "Review" });
  }
  if (soon.length > 0) {
    out.push({ rank: 80, key: "expiring", tone: "amber", icon: AlertTriangle, title: `${plural(soon.length, "document")} expiring soon`, sub: soon.slice(0, 3).map((x) => `${x.field}: ${x.name}`).join(", ") + (soon.length > 3 ? ` and ${soon.length - 3} more` : ""), href: "/employees/renewals", action: "Review" });
  }
  if (d.lpoAlerts.length > 0) {
    out.push({ rank: 90, key: "lpo", tone: "amber", icon: ClipboardList, title: `${plural(d.lpoAlerts.length, "LPO alert")}`, sub: d.lpoAlerts.slice(0, 2).map((x) => `${x.lpoNumber}: ${x.projectName}`).join(", "), href: "/projects", action: "Review" });
  }
  const o = d.operations;
  if (o?.sales && o.sales.followUpsDue > 0) {
    out.push({ rank: 45, key: "sales-follow", tone: "amber", icon: ClipboardList, title: `${plural(o.sales.followUpsDue, "sales follow-up")} due`, sub: "Calls and quotations to chase today or overdue", href: "/sales", action: "Open pipeline" });
  }
  if (o?.transport && o.transport.expired > 0) {
    out.push({ rank: 25, key: "vehicles", tone: "red", icon: Truck, title: `${plural(o.transport.expired, "vehicle")} with expired papers`, sub: "Registration or insurance has lapsed", href: "/transport", action: "Review" });
  }
  if (o?.waitingForBed) {
    out.push({ rank: 35, key: "beds", tone: "amber", icon: BedDouble, title: `${plural(o.waitingForBed, "worker")} waiting for a bed`, sub: "Checked in, no bed yet", href: "/accommodation/camps", action: "Assign beds" });
  }
  if (o?.onboarding && o.onboarding.readyToJoin > 0) {
    out.push({ rank: 55, key: "ready", tone: "blue", icon: UserPlus, title: `${plural(o.onboarding.readyToJoin, "candidate")} ready to join`, sub: "Onboarding is complete", href: "/onboarding", action: "Open tracker" });
  }
  if (o?.inventory && o.inventory.out > 0) {
    out.push({ rank: 75, key: "stock-out", tone: "amber", icon: Package, title: `${plural(o.inventory.out, "size")} out of stock`, sub: `${o.inventory.low} more running low`, href: "/inventory", action: "Review" });
  }
  if (o && o.drafts > 0) {
    out.push({ rank: 85, key: "drafts", tone: "blue", icon: FileText, title: `${plural(o.drafts, "unfinished draft")}`, sub: "Forms you started and haven't submitted", href: "/drafts", action: "Finish" });
  }
  return out.sort((x, y) => x.rank - y.rank);
}

function DemandPanel({ f }: { f: DemandFill }) {
  return (
    <Panel title="Demand fill" icon={ClipboardList} href="/demand" linkLabel="Demands">
      {f.openRequests === 0 ? (
        <p className="py-4 text-center text-sm text-muted">No open demand requests.</p>
      ) : (
        <div className="space-y-3">
          <div>
            <p className="flex items-baseline gap-2">
              <span className="tabular text-3xl font-semibold text-primary">{f.needed > 0 ? Math.round((f.filled / f.needed) * 100) : 0}%</span>
              <span className="text-xs text-muted">{f.filled} of {f.needed} mobilised · {f.openRequests} open request{f.openRequests === 1 ? "" : "s"}</span>
            </p>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-sunken">
              <div className="h-full rounded-full bg-[var(--brand-primary)]" style={{ width: `${f.needed > 0 ? (f.filled / f.needed) * 100 : 0}%` }} />
            </div>
          </div>
          {f.gaps.length === 0 ? (
            <p className="text-xs text-[var(--success)]">Every open request is fully staffed.</p>
          ) : (
            <ul className="space-y-1">
              {f.gaps.map((g) => (
                <li key={g.trade} className="flex items-center justify-between rounded-md px-1.5 py-1 text-xs">
                  <span className="text-secondary">{g.trade}</span>
                  <span className="tabular">
                    <span className="font-medium text-[var(--warning)]">short by {g.short}</span>
                    <span className="text-muted"> · {g.bench >= g.short ? `${g.bench} on bench covers it` : `${g.bench} on bench`}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Panel>
  );
}

function PayrollPanel({ p }: { p: { run: PayrollStatus } }) {
  return (
    <Panel title="Payroll" icon={FileText} href={p.run ? `/payroll/${p.run.runId}` : "/payroll"} linkLabel={p.run ? "Open run" : "Payroll"}>
      {!p.run ? (
        <p className="py-4 text-center text-sm text-muted">No payroll run yet. Start one from the Payroll page when a month closes.</p>
      ) : (
        <div className="space-y-2.5">
          <p className="flex items-center gap-2">
            <span className="text-base font-semibold whitespace-nowrap text-primary">{formatMonthLabel(p.run.month)}</span>
            <Badge color={p.run.status === "PAID" ? "green" : p.run.status === "APPROVED" ? "blue" : p.run.submitted ? "amber" : "slate"} dot>
              {p.run.status === "DRAFT" && p.run.submitted ? "Awaiting approval" : p.run.status.toLowerCase()}
            </Badge>
          </p>
          <p className="text-sm text-secondary">
            <span className="tabular font-medium text-primary">{p.run.workers}</span> workers · net{" "}
            <span className="tabular font-medium text-primary">AED {Math.round(p.run.netTotal).toLocaleString()}</span>
          </p>
          {!p.run.hasCurrentMonth && <p className="text-xs text-muted">No run yet for this month.</p>}
        </div>
      )}
    </Panel>
  );
}

function MiniCard({ title, icon, href, linkLabel, lines }: { title: string; icon: React.ComponentType<{ className?: string }>; href: string; linkLabel: string; lines: { label: string; value: number; warn?: boolean; bad?: boolean; good?: boolean }[] }) {
  return (
    <Panel title={title} icon={icon} href={href} linkLabel={linkLabel}>
      <ul className="space-y-1">
        {lines.map((l) => (
          <li key={l.label} className="flex items-center justify-between py-1 text-sm">
            <span className="text-muted">{l.label}</span>
            <span className={cn("tabular font-semibold", l.bad ? "text-[var(--error)]" : l.warn ? "text-[var(--warning)]" : l.good ? "text-[var(--success)]" : "text-primary")}>{l.value}</span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
