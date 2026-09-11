import Link from "next/link";
import {
  ClipboardList,
  AlertTriangle,
  BedDouble,
  CheckCircle2,
  UserPlus,
  Upload as UploadIcon,
  FileText,
  Stethoscope,
} from "lucide-react";
import { Panel, QuickAction } from "@/components/DashboardPanel";
import { StatTile } from "@/components/StatTile";
import { Badge } from "@/components/Badge";
import { OccupancyRing } from "@/components/OccupancyRing";
import { WorkforcePie } from "@/components/WorkforcePie";
import { WeeklyHoursChart } from "@/components/WeeklyHoursChart";
import { AssignedStaffList } from "@/components/AssignedStaffList";
import { DocumentExpiryWidget } from "@/components/DocumentExpiryWidget";
import { EmployeeTypeBreakdown } from "@/components/EmployeeTypeBreakdown";
import type { ComplianceAlert } from "@/lib/dashboardAlerts";
import type { LpoAlert } from "@/lib/lpoAlerts";
import type { WeeklyHoursDay } from "@/lib/weeklyHours";
import type { AssignedStaffRow } from "@/lib/assignedStaff";
import type { DocumentExpiryCategory } from "@/lib/documentExpiryCounts";
import type { EmployeeTypeCounts } from "@/lib/employeeTypeCounts";
import type { EntityCounts } from "@/lib/entityCounts";
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
    label: "KPI strip (workforce, deployed, projects, needs attention)",
    render: (d) => (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          href="/employees"
          label="Total workforce"
          value={d.employeeCount}
          icon={ClipboardList}
          hint={`${d.onWorkCount} deployed · ${d.benchCount} on bench`}
        />
        <StatTile
          href="/employees?filter=on-work"
          label="Deployed"
          value={`${d.deployedPct}%`}
          icon={ClipboardList}
          hint={`${d.onWorkCount} of ${d.employeeCount} workers`}
        />
        <StatTile
          href="/projects"
          label="Active projects"
          value={d.activeProjectCount}
          icon={ClipboardList}
          hint={`${d.activeClientCount} active clients`}
        />
        <StatTile
          href="#needs-attention"
          label="Needs attention"
          value={d.alerts.length + d.lpoAlerts.length}
          icon={AlertTriangle}
          tone={d.expiredCount > 0 ? "warning" : "default"}
          hint={d.expiredCount > 0 ? `${d.expiredCount} already expired` : "expiring within 30 days"}
        />
      </div>
    ),
  },
  {
    id: "trend-attention",
    label: "Hours trend + Needs attention queue",
    render: (d) => (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel title="Hours this month by weekday" className="lg:col-span-2" href="/history" linkLabel="History">
          <WeeklyHoursChart days={d.weeklyHours} />
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
                <li key={item.key}>
                  <Link href={item.href} className="flex items-center gap-3 px-5 py-2.5 transition hover:bg-surface-hover">
                    <span
                      className={cn(
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
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
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
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
    label: "Workforce composition + Deployment split",
    render: (d) => (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel title="Workforce by type" className="lg:col-span-2" href="/employees">
          <EmployeeTypeBreakdown counts={d.employeeTypeCounts} />
        </Panel>

        <Panel title="Deployment" href="/employees?filter=bench" linkLabel="View bench">
          <WorkforcePie onWork={d.onWorkCount} bench={d.benchCount} />
        </Panel>
      </div>
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
    label: "Quick actions",
    render: () => (
      <section>
        <h2 className="mb-2.5 text-sm font-semibold text-primary">Quick actions</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <QuickAction href="/employees/new" icon={UserPlus} label="Add employee" sub="Register a new worker" />
          <QuickAction href="/upload" icon={UploadIcon} label="Submit timesheet" sub="Record work hours" />
          <QuickAction href="/documents" icon={FileText} label="Upload documents" sub="Add worker documents" />
          <QuickAction href="/employees" icon={Stethoscope} label="Medical checks" sub="Review medical expiry" />
        </div>
      </section>
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

export function orderedVisibleWidgets(hiddenWidgets: string[], widgetOrder: string[]): DashboardWidget[] {
  const byId = new Map(DASHBOARD_WIDGETS.map((w) => [w.id, w]));
  const known = widgetOrder.filter((id) => byId.has(id));
  const missing = DASHBOARD_WIDGETS.map((w) => w.id).filter((id) => !known.includes(id));
  const fullOrder = [...known, ...missing];
  return fullOrder
    .filter((id) => !hiddenWidgets.includes(id))
    .map((id) => byId.get(id)!)
    .filter(Boolean);
}
