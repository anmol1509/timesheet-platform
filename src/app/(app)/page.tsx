import Link from "next/link";
import { prisma } from "@/lib/db";
import { StatTile } from "@/components/StatTile";
import { Badge } from "@/components/Badge";
import { PageHeader } from "@/components/PageHeader";
import { OccupancyRing } from "@/components/OccupancyRing";
import { WorkforcePie } from "@/components/WorkforcePie";
import { WeeklyHoursChart } from "@/components/WeeklyHoursChart";
import { AssignedStaffList } from "@/components/AssignedStaffList";
import { DocumentExpiryWidget } from "@/components/DocumentExpiryWidget";
import { EmployeeTypeBreakdown } from "@/components/EmployeeTypeBreakdown";
import { getComplianceAlerts } from "@/lib/dashboardAlerts";
import { getLpoAlerts } from "@/lib/lpoAlerts";
import { getWeeklyHours } from "@/lib/weeklyHours";
import { getAssignedStaff } from "@/lib/assignedStaff";
import { getDocumentExpiryCounts } from "@/lib/documentExpiryCounts";
import { getEmployeeTypeCounts } from "@/lib/employeeTypeCounts";
import { getEntityCounts } from "@/lib/entityCounts";
import { requireUserWithBranch } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { cn } from "@/lib/cn";
import {
  ClipboardList,
  AlertTriangle,
  ArrowRight,
  BedDouble,
  CheckCircle2,
  Users,
  UserPlus,
  Upload as UploadIcon,
  FileText,
  Stethoscope,
} from "lucide-react";

function formatMonthLabel(month: string) {
  const [y, m] = month.split("-");
  const date = new Date(Number(y), Number(m) - 1, 1);
  return date.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

/** Card wrapper for dashboard widgets — title bar, optional link, body. */
function Panel({
  title,
  icon: Icon,
  href,
  linkLabel = "View all",
  children,
  className,
  bodyClassName,
}: {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  href?: string;
  linkLabel?: string;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("card flex flex-col", className)}>
      <div className="card-header">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-primary">
          {Icon && <Icon className="h-4 w-4 text-subtle" />}
          {title}
        </h2>
        {href && (
          <Link
            href={href}
            className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-[var(--brand-primary)] transition hover:underline"
          >
            {linkLabel}
            <ArrowRight className="h-3 w-3" aria-hidden />
          </Link>
        )}
      </div>
      <div className={cn("flex-1 p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

export default async function DashboardPage() {
  const { branchId } = await requireUserWithBranch();
  const branchScope = branchWhere(branchId);

  const [
    employeeCount,
    onWorkCount,
    activeProjectCount,
    activeClientCount,
    alerts,
    lpoAlerts,
    weeklyHours,
    assignedStaff,
    beds,
    latestUpload,
    months,
    documentExpiryCounts,
    employeeTypeCounts,
    entityCounts,
  ] = await Promise.all([
    prisma.employee.count({ where: branchScope }),
    prisma.employee.count({
      where: { ...branchScope, active: true, projectId: { not: null } },
    }),
    prisma.project.count({ where: { ...branchScope, status: "ACTIVE" } }),
    prisma.client.count({ where: { ...branchScope, status: "ACTIVE" } }),
    getComplianceAlerts(branchId),
    getLpoAlerts(branchId),
    getWeeklyHours(branchId),
    getAssignedStaff(4, branchId),
    // Camp/Room/Bed aren't branch-scoped yet (deferred to a later phase),
    // so occupancy stays cross-branch for now.
    prisma.bed.findMany({ select: { employeeId: true } }),
    prisma.upload.findFirst({
      where: branchScope,
      orderBy: { uploadedAt: "desc" },
      include: { uploadedBy: true },
    }),
    prisma.timesheetEntry.findMany({
      where: branchScope,
      distinct: ["month"],
      select: { month: true },
      orderBy: { month: "desc" },
    }),
    getDocumentExpiryCounts(branchId),
    getEmployeeTypeCounts(branchId),
    getEntityCounts(branchId),
  ]);

  const benchCount = employeeCount - onWorkCount;
  const deployedPct =
    employeeCount > 0 ? Math.round((onWorkCount / employeeCount) * 100) : 0;
  const expiredCount = alerts.filter((a) => a.days < 0).length;

  const totalBeds = beds.length;
  const occupiedBeds = beds.filter((b) => b.employeeId).length;
  const vacantBeds = totalBeds - occupiedBeds;
  const occupancyPct = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

  // Compliance and LPO warnings share one "needs attention" queue — they're the
  // same job for the user (something is about to lapse), just different sources.
  const attention = [
    ...alerts.slice(0, 6).map((a) => ({
      key: `c-${a.employeeId}-${a.field}`,
      href: `/documents?employee=${a.employeeId}`,
      title: `${a.field} — ${a.name}`,
      sub:
        a.days < 0
          ? `expired ${Math.abs(a.days)} days ago`
          : a.days === 0
            ? "expires today"
            : `expires in ${a.days} days`,
      overdue: a.days < 0,
      badge: a.days < 0 ? "Expired" : `${a.days}d`,
    })),
    ...lpoAlerts.map((a) => ({
      key: `l-${a.lpoId}-${a.kind}`,
      href: `/projects/${a.projectId}`,
      title: `${a.lpoNumber} — ${a.projectName}`,
      sub:
        a.kind === "EXPIRING"
          ? a.days != null && a.days < 0
            ? `expired ${Math.abs(a.days)} days ago`
            : `expires in ${a.days} days`
          : `AED ${a.remaining?.toLocaleString(undefined, { maximumFractionDigits: 0 })} remaining`,
      overdue: a.kind === "EXPIRING" && a.days != null && a.days < 0,
      badge: a.kind === "EXPIRING" ? "LPO expiring" : "Low balance",
    })),
  ].slice(0, 8);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Dashboard"
        description="Workforce, compliance and billing at a glance."
        actions={
          <>
            <Link
              href="/upload"
              className="inline-flex h-8 items-center gap-1.5 rounded-control border border-strong bg-surface px-2.5 text-xs font-medium text-secondary shadow-xs transition hover:bg-surface-hover hover:text-primary"
            >
              <UploadIcon className="h-3.5 w-3.5" aria-hidden />
              Upload timesheet
            </Link>
            <Link
              href="/employees/new"
              className="btn btn-primary btn-sm h-8 gap-1.5 rounded-control shadow-xs"
            >
              <UserPlus className="h-3.5 w-3.5" aria-hidden />
              Add employee
            </Link>
          </>
        }
      />

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          href="/employees"
          label="Total workforce"
          value={employeeCount}
          icon={Users}
          hint={`${onWorkCount} deployed · ${benchCount} on bench`}
        />
        <StatTile
          href="/employees?filter=on-work"
          label="Deployed"
          value={`${deployedPct}%`}
          icon={ClipboardList}
          hint={`${onWorkCount} of ${employeeCount} workers`}
        />
        <StatTile
          href="/projects"
          label="Active projects"
          value={activeProjectCount}
          icon={ClipboardList}
          hint={`${activeClientCount} active clients`}
        />
        <StatTile
          href="#needs-attention"
          label="Needs attention"
          value={alerts.length + lpoAlerts.length}
          icon={AlertTriangle}
          tone={expiredCount > 0 ? "warning" : "default"}
          hint={
            expiredCount > 0
              ? `${expiredCount} already expired`
              : "expiring within 30 days"
          }
        />
      </div>

      {/* Primary working area: trend + the queue of things to act on */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel
          title="Hours this month by weekday"
          className="lg:col-span-2"
          href="/history"
          linkLabel="History"
        >
          <WeeklyHoursChart days={weeklyHours} />
        </Panel>

        <Panel
          title="Needs attention"
          icon={AlertTriangle}
          href="/documents"
          className="scroll-mt-20"
          bodyClassName="p-0"
        >
          <div id="needs-attention" />
          {attention.length === 0 ? (
            <div className="flex flex-col items-center px-5 py-10 text-center">
              <CheckCircle2
                className="mb-2 h-5 w-5 text-[var(--success)]"
                aria-hidden
              />
              <p className="text-sm font-medium text-primary">All clear</p>
              <p className="mt-1 text-xs text-muted">
                Nothing expires in the next 30 days.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {attention.map((item) => (
                <li key={item.key}>
                  <Link
                    href={item.href}
                    className="flex items-center gap-3 px-5 py-2.5 transition hover:bg-surface-hover"
                  >
                    <span
                      className={cn(
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
                        item.overdue
                          ? "bg-[var(--error-soft)] text-[var(--error)]"
                          : "bg-[var(--warning-soft)] text-[var(--warning)]"
                      )}
                    >
                      <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-primary">
                        {item.title}
                      </span>
                      <span className="block truncate text-xs text-muted">
                        {item.sub}
                      </span>
                    </span>
                    <Badge color={item.overdue ? "red" : "amber"}>{item.badge}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {/* Document expiry counters */}
      <section>
        <h2 className="mb-2.5 text-sm font-semibold text-primary">
          Document expiry
        </h2>
        <DocumentExpiryWidget categories={documentExpiryCounts} />
      </section>

      {/* Composition + occupancy */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel title="Workforce by type" className="lg:col-span-2" href="/employees">
          <EmployeeTypeBreakdown counts={employeeTypeCounts} />
        </Panel>

        <Panel title="Deployment" href="/employees?filter=bench" linkLabel="View bench">
          <WorkforcePie onWork={onWorkCount} bench={benchCount} />
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel title="Assigned staff" href="/employees">
          <AssignedStaffList staff={assignedStaff} />
        </Panel>

        <Panel title="Business associates">
          <ul className="space-y-1">
            {[
              { label: "Clients", value: entityCounts.clients, href: "/clients" },
              { label: "Suppliers", value: entityCounts.suppliers, href: "/suppliers" },
              { label: "Projects", value: entityCounts.projects, href: "/projects" },
            ].map((row) => (
              <li key={row.label}>
                <Link
                  href={row.href}
                  className="-mx-2 flex items-center justify-between rounded-control px-2 py-1.5 text-sm transition hover:bg-surface-hover"
                >
                  <span className="text-muted">{row.label}</span>
                  <span className="tabular font-semibold text-primary">{row.value}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>

        {totalBeds > 0 ? (
          <Panel title="Camp occupancy" icon={BedDouble} href="/accommodation">
            <OccupancyRing
              occupied={occupiedBeds}
              vacant={vacantBeds}
              pct={occupancyPct}
            />
          </Panel>
        ) : (
          <Panel title="Timesheet activity" href="/upload" linkLabel="Upload">
            <p className="text-sm text-secondary">
              Last upload:{" "}
              {latestUpload ? (
                <span className="font-medium text-primary">
                  {new Date(latestUpload.uploadedAt).toLocaleString("en-GB", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  by {latestUpload.uploadedBy.name}
                </span>
              ) : (
                <span className="text-subtle">No uploads yet</span>
              )}
            </p>
          </Panel>
        )}
      </div>

      {/* Quick actions */}
      <section>
        <h2 className="mb-2.5 text-sm font-semibold text-primary">Quick actions</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <QuickAction
            href="/employees/new"
            icon={UserPlus}
            label="Add employee"
            sub="Register a new worker"
          />
          <QuickAction
            href="/upload"
            icon={UploadIcon}
            label="Submit timesheet"
            sub="Record work hours"
          />
          <QuickAction
            href="/documents"
            icon={FileText}
            label="Upload documents"
            sub="Add worker documents"
          />
          <QuickAction
            href="/employees"
            icon={Stethoscope}
            label="Medical checks"
            sub="Review medical expiry"
          />
        </div>
      </section>

      {/* Footer strip: months with recorded data */}
      {months.length > 0 && (
        <section className="card card-padded">
          <h2 className="text-sm font-semibold text-primary">Months with data</h2>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {months.map((m) => (
              <span
                key={m.month}
                className="rounded-md border border-default bg-surface-subtle px-2 py-0.5 text-xs font-medium text-secondary"
              >
                {formatMonthLabel(m.month)}
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function QuickAction({
  href,
  icon: Icon,
  label,
  sub,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  sub: string;
}) {
  return (
    <Link
      href={href}
      className="group card flex items-start gap-3 p-3.5 transition hover:border-strong hover:shadow-sm"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface-sunken text-secondary transition group-hover:bg-brand-soft group-hover:text-[var(--brand-primary)]">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-primary">{label}</span>
        <span className="block truncate text-xs text-muted">{sub}</span>
      </span>
    </Link>
  );
}
