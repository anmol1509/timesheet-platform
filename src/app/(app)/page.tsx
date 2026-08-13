import Link from "next/link";
import { prisma } from "@/lib/db";
import { StatTile } from "@/components/StatTile";
import { Badge } from "@/components/Badge";
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
import {
  ClipboardList,
  Building2,
  AlertTriangle,
  UserPlus,
  Upload as UploadIcon,
  FileText,
  Stethoscope,
} from "lucide-react";

const ALERT_CHIP_COLORS = [
  "bg-blue-100 text-blue-600",
  "bg-amber-100 text-amber-600",
  "bg-rose-100 text-rose-600",
  "bg-violet-100 text-violet-600",
  "bg-emerald-100 text-emerald-600",
];

function formatMonthLabel(month: string) {
  const [y, m] = month.split("-");
  const date = new Date(Number(y), Number(m) - 1, 1);
  return date.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
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
  const topAlerts = alerts.slice(0, 5);

  const totalBeds = beds.length;
  const occupiedBeds = beds.filter((b) => b.employeeId).length;
  const vacantBeds = totalBeds - occupiedBeds;
  const occupancyPct = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">
          Overview of your labor management system.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          hero
          href="/employees"
          label="Total Employees"
          value={employeeCount}
          hint={`${onWorkCount} on active projects`}
        />
        <StatTile
          href="/projects"
          label="Active Projects"
          value={activeProjectCount}
          icon={ClipboardList}
        />
        <StatTile
          href="/clients"
          label="Active Clients"
          value={activeClientCount}
          icon={Building2}
        />
        <StatTile
          href="#key-alerts"
          label="Urgent Alerts"
          value={alerts.length}
          icon={AlertTriangle}
          tone={alerts.length > 0 ? "warning" : "default"}
        />
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-slate-900">
          Notification for Expiry
        </h2>
        <DocumentExpiryWidget categories={documentExpiryCounts} />
      </div>

      {lpoAlerts.length > 0 && (
        <div className="rounded-3xl border border-slate-200 bg-white p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <AlertTriangle className="h-4 w-4 text-amber-500" /> LPO Alerts
          </h2>
          <div className="space-y-3">
            {lpoAlerts.map((a, i) => (
              <div key={`${a.lpoId}-${a.kind}`} className="flex items-center gap-3">
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${ALERT_CHIP_COLORS[i % ALERT_CHIP_COLORS.length]}`}
                >
                  <AlertTriangle className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/projects/${a.projectId}`}
                    className="block truncate text-sm font-medium text-slate-900 hover:underline"
                  >
                    {a.lpoNumber} &mdash; {a.projectName}
                  </Link>
                  <p className="truncate text-xs text-slate-500">
                    {a.kind === "EXPIRING"
                      ? a.days != null && a.days < 0
                        ? `expired ${Math.abs(a.days)}d ago`
                        : `expires in ${a.days}d`
                      : `AED ${a.remaining?.toLocaleString(undefined, { maximumFractionDigits: 2 })} remaining`}
                  </p>
                </div>
                <Badge color={a.kind === "EXPIRING" && a.days != null && a.days < 0 ? "red" : "amber"}>
                  {a.kind === "EXPIRING" ? "Expiring" : "Low balance"}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">
            Employee Count
          </h2>
          <EmployeeTypeBreakdown counts={employeeTypeCounts} />
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">
            Business Associates
          </h2>
          <div className="space-y-3">
            <Link
              href="/clients"
              className="flex items-center justify-between rounded-lg text-sm transition hover:bg-slate-50"
            >
              <span className="text-slate-500">Clients</span>
              <span className="font-semibold text-slate-900">{entityCounts.clients}</span>
            </Link>
            <Link
              href="/suppliers"
              className="flex items-center justify-between rounded-lg text-sm transition hover:bg-slate-50"
            >
              <span className="text-slate-500">Suppliers</span>
              <span className="font-semibold text-slate-900">{entityCounts.suppliers}</span>
            </Link>
            <Link
              href="/projects"
              className="flex items-center justify-between rounded-lg text-sm transition hover:bg-slate-50"
            >
              <span className="text-slate-500">Projects</span>
              <span className="font-semibold text-slate-900">{entityCounts.projects}</span>
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 lg:col-span-2">
          <h2 className="mb-4 text-sm font-semibold text-slate-900">
            This month&rsquo;s hours by weekday
          </h2>
          <WeeklyHoursChart days={weeklyHours} />
        </div>

        <div id="key-alerts" className="scroll-mt-20 rounded-3xl border border-slate-200 bg-white p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <AlertTriangle className="h-4 w-4 text-amber-500" /> Key Alerts
          </h2>
          {topAlerts.length === 0 ? (
            <p className="text-sm text-slate-500">
              No compliance items expiring in the next 30 days.
            </p>
          ) : (
            <div className="space-y-3">
              {topAlerts.map((a, i) => (
                <div key={`${a.employeeId}-${a.field}-${i}`} className="flex items-center gap-3">
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${ALERT_CHIP_COLORS[i % ALERT_CHIP_COLORS.length]}`}
                  >
                    <AlertTriangle className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/documents?employee=${a.employeeId}`}
                      className="block truncate text-sm font-medium text-slate-900 hover:underline"
                    >
                      {a.field} &mdash; {a.name}
                    </Link>
                    <p className="truncate text-xs text-slate-500">
                      {a.days < 0 ? "expired" : "expires"}{" "}
                      {a.days < 0 ? `${Math.abs(a.days)}d ago` : `in ${a.days}d`}
                    </p>
                  </div>
                  <Badge color={a.days < 0 ? "red" : a.days <= 7 ? "red" : "amber"}>
                    {a.days < 0 ? "expired" : `${a.days}d`}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">
            Workforce status
          </h2>
          <WorkforcePie onWork={onWorkCount} bench={benchCount} />
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Assigned Staff</h2>
            <Link href="/employees" className="text-xs font-medium text-blue-600 hover:underline">
              View all
            </Link>
          </div>
          <AssignedStaffList staff={assignedStaff} />
        </div>
      </div>

      {totalBeds > 0 && (
        <Link
          href="/accommodation"
          className="block rounded-3xl border border-slate-200 bg-white p-5 transition hover:border-slate-300 hover:shadow-md"
        >
          <h2 className="mb-3 text-sm font-semibold text-slate-900">
            Camp Occupancy
          </h2>
          <OccupancyRing occupied={occupiedBeds} vacant={vacantBeds} pct={occupancyPct} />
        </Link>
      )}

      <div>
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Quick Actions</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <QuickAction
            href="/employees/new"
            icon={UserPlus}
            label="Add Employee"
            sub="Register new worker"
            tone="hero"
          />
          <QuickAction
            href="/upload"
            icon={UploadIcon}
            label="Submit Timesheet"
            sub="Record work hours"
          />
          <QuickAction
            href="/documents"
            icon={FileText}
            label="Upload Documents"
            sub="Add worker documents"
          />
          <QuickAction
            href="/employees"
            icon={Stethoscope}
            label="Schedule Medical"
            sub="Book health checkups"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-900">
            Timesheet activity
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Last upload:{" "}
            {latestUpload ? (
              <>
                {new Date(latestUpload.uploadedAt).toLocaleString("en-GB", {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}{" "}
                by {latestUpload.uploadedBy.name}
              </>
            ) : (
              "No uploads yet"
            )}
          </p>
          <Link
            href="/upload"
            className="mt-3 inline-block text-sm font-medium text-[var(--brand-primary)] hover:underline"
          >
            Go to Upload →
          </Link>
        </div>
        {months.length > 0 && (
          <div className="rounded-3xl border border-slate-200 bg-white p-5">
            <h2 className="mb-2 text-sm font-semibold text-slate-900">
              Months with data
            </h2>
            <div className="flex flex-wrap gap-2">
              {months.map((m) => (
                <span
                  key={m.month}
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600"
                >
                  {formatMonthLabel(m.month)}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function QuickAction({
  href,
  icon: Icon,
  label,
  sub,
  tone,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  sub: string;
  tone?: "hero";
}) {
  return (
    <Link
      href={href}
      className={`group rounded-3xl border p-5 shadow-sm transition hover:shadow-md ${
        tone === "hero"
          ? "border-transparent bg-gradient-to-br from-blue-600 to-[var(--brand-navy)] text-white"
          : "border-slate-200 bg-white hover:border-slate-300"
      }`}
    >
      <div
        className={`flex h-10 w-10 items-center justify-center rounded-xl ${
          tone === "hero" ? "bg-white/10" : "bg-slate-100"
        }`}
      >
        <Icon className={`h-5 w-5 ${tone === "hero" ? "text-white" : "text-slate-600"}`} />
      </div>
      <h3 className={`mt-3 text-sm font-semibold ${tone === "hero" ? "text-white" : "text-slate-900"}`}>
        {label}
      </h3>
      <p className={`mt-1 text-xs ${tone === "hero" ? "text-blue-100" : "text-slate-500"}`}>
        {sub}
      </p>
    </Link>
  );
}
