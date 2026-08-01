import Link from "next/link";
import { prisma } from "@/lib/db";
import { StatTile } from "@/components/StatTile";
import { Badge } from "@/components/Badge";
import { OccupancyRing } from "@/components/OccupancyRing";
import { WorkforcePie } from "@/components/WorkforcePie";
import { daysUntil, COMPLIANCE_FIELDS } from "@/lib/compliance";
import {
  Users,
  ClipboardList,
  Building2,
  AlertTriangle,
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

export default async function DashboardPage() {
  const [
    employeeCount,
    onWorkCount,
    activeProjectCount,
    activeClientCount,
    employeesForAlerts,
    beds,
    latestUpload,
    months,
  ] = await Promise.all([
    prisma.employee.count(),
    prisma.employee.count({ where: { active: true, projectId: { not: null } } }),
    prisma.project.count({ where: { status: "ACTIVE" } }),
    prisma.client.count({ where: { status: "ACTIVE" } }),
    prisma.employee.findMany({
      select: {
        id: true,
        name: true,
        employeeIdNo: true,
        visaExpiry: true,
        laborCardExpiry: true,
        medicalExpiry: true,
        passportExpiry: true,
        emiratesIdExpiry: true,
      },
    }),
    prisma.bed.findMany({ select: { employeeId: true } }),
    prisma.upload.findFirst({
      orderBy: { uploadedAt: "desc" },
      include: { uploadedBy: true },
    }),
    prisma.timesheetEntry.findMany({
      distinct: ["month"],
      select: { month: true },
      orderBy: { month: "desc" },
    }),
  ]);
  const benchCount = employeeCount - onWorkCount;

  const ALERT_THRESHOLD_DAYS = 30;
  type Alert = { employeeId: string; name: string; field: string; days: number };
  const alerts: Alert[] = [];
  for (const e of employeesForAlerts) {
    for (const f of COMPLIANCE_FIELDS) {
      const date = e[f.key as keyof typeof e] as Date | null;
      if (!date) continue;
      const days = daysUntil(date);
      if (days <= ALERT_THRESHOLD_DAYS) {
        alerts.push({ employeeId: e.id, name: e.name, field: f.label, days });
      }
    }
  }
  alerts.sort((a, b) => a.days - b.days);
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
        <StatTile label="Total Employees" value={employeeCount} icon={Users} />
        <StatTile label="Active Projects" value={activeProjectCount} icon={ClipboardList} />
        <StatTile label="Active Clients" value={activeClientCount} icon={Building2} />
        <StatTile
          label="Urgent Alerts"
          value={alerts.length}
          icon={AlertTriangle}
          tone={alerts.length > 0 ? "warning" : "default"}
        />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">
          Workforce status
        </h2>
        <WorkforcePie onWork={onWorkCount} bench={benchCount} />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
          <AlertTriangle className="h-4 w-4 text-amber-500" /> Key Alerts
        </h2>
        {topAlerts.length === 0 ? (
          <p className="text-sm text-slate-500">
            No compliance items expiring in the next {ALERT_THRESHOLD_DAYS} days.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {topAlerts.map((a, i) => (
              <div
                key={`${a.employeeId}-${a.field}-${i}`}
                className="flex items-center justify-between py-2.5"
              >
                <div>
                  <Link
                    href={`/documents?employee=${a.employeeId}`}
                    className="text-sm font-medium text-slate-900 hover:underline"
                  >
                    {a.field} Expiry
                  </Link>
                  <p className="text-xs text-slate-500">
                    {a.name} · {a.field} {a.days < 0 ? "expired" : "expires"}{" "}
                    {a.days < 0
                      ? `${Math.abs(a.days)}d ago`
                      : `in ${a.days}d`}
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

      {totalBeds > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">
            Camp Occupancy
          </h2>
          <OccupancyRing occupied={occupiedBeds} vacant={vacantBeds} pct={occupancyPct} />
        </div>
      )}

      <div>
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Quick Actions</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <QuickAction
            href="/employees/new"
            icon={UserPlus}
            label="Add Employee"
            sub="Register new worker"
            tone="navy"
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
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
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
            className="mt-3 inline-block text-sm font-medium text-blue-600 hover:underline"
          >
            Go to Upload →
          </Link>
        </div>
        {months.length > 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
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
  tone?: "navy";
}) {
  return (
    <Link
      href={href}
      className={`group rounded-2xl border p-5 shadow-sm transition hover:shadow-md ${
        tone === "navy"
          ? "border-[#0B1642] bg-[#0B1642] text-white"
          : "border-slate-200 bg-white hover:border-slate-300"
      }`}
    >
      <div
        className={`flex h-10 w-10 items-center justify-center rounded-xl ${
          tone === "navy" ? "bg-white/10" : "bg-slate-100"
        }`}
      >
        <Icon className={`h-5 w-5 ${tone === "navy" ? "text-white" : "text-slate-600"}`} />
      </div>
      <h3 className={`mt-3 text-sm font-semibold ${tone === "navy" ? "text-white" : "text-slate-900"}`}>
        {label}
      </h3>
      <p className={`mt-1 text-xs ${tone === "navy" ? "text-slate-300" : "text-slate-500"}`}>
        {sub}
      </p>
    </Link>
  );
}
