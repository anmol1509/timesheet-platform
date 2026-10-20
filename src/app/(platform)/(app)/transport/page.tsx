import { PageHeader } from "@/components/PageHeader";
import Link from "next/link";
import { Bus, Download, Route as RouteIcon, ShieldAlert, Upload, Users } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { prisma } from "@/lib/db";
import { requireUserWithBranch, subjectOf } from "@/lib/auth";
import { can, canWrite } from "@/lib/permissions";
import { isAdminRole } from "@/lib/roles";
import { branchWhere } from "@/lib/branch";
import { BarList, type BarListTone } from "@/components/BarList";
import { Insights } from "@/components/ListSummary";
import { daysUntil } from "@/lib/compliance";
import { cn } from "@/lib/cn";
import { AddVehicleDialog } from "./add-vehicle-dialog";
import { VehicleBrowser } from "./vehicle-browser";

export const metadata = { title: "Transport" };

const STATUS: Record<string, { label: string; color: "green" | "amber" | "slate" }> = {
  ACTIVE: { label: "In service", color: "green" },
  MAINTENANCE: { label: "Maintenance", color: "amber" },
  INACTIVE: { label: "Out of service", color: "slate" },
};

export default async function TransportPage({ searchParams }: { searchParams: Promise<{ error?: string; status?: string }> }) {
  const { error, status: statusFilter } = await searchParams;
  const { user, branchId } = await requireUserWithBranch();
  const canExport = can(subjectOf(user), "facilities.transport", "export");
  const canImport = isAdminRole(user.role);
  const canEditVehicles = canWrite(subjectOf(user), "facilities.transport");
  const vehicles = await prisma.vehicle.findMany({
    where: branchWhere(branchId),
    include: {
      _count: { select: { employees: true } },
      projects: { include: { project: { select: { name: true } } } },
      routes: { include: { stops: { orderBy: { stopOrder: "asc" } }, project: { select: { name: true } } } },
    },
    orderBy: { plateNumber: "asc" },
  });

  const inService = vehicles.filter((v) => v.status === "ACTIVE").length;
  const docsDue = vehicles.filter((v) => [v.registrationExpiry, v.insuranceExpiry].some((d) => d && daysUntil(d) <= 30)).length;
  const seats = vehicles.reduce((n, v) => n + (v.capacity ?? 0), 0);
  const riders = vehicles.reduce((n, v) => n + v._count.employees, 0);

  const utilization = vehicles
    .filter((v) => v.capacity)
    .map((v) => {
      const pct = Math.round((v._count.employees / v.capacity!) * 100);
      const tone: BarListTone = pct >= 100 ? "danger" : pct >= 75 ? "warning" : "success";
      return { id: v.id, label: `${v.plateNumber} · ${v._count.employees}/${v.capacity} seats`, pct, tone };
    })
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 8);

  const runs = vehicles
    .flatMap((v) => v.routes.map((r) => ({ id: r.id, name: r.name, plate: v.plateNumber, vehicleId: v.id, driver: v.driverName, project: r.project?.name ?? null, first: r.stops[0], last: r.stops[r.stops.length - 1], stops: r.stops.length })))
    .sort((a, b) => (a.first?.pickupTime ?? "99").localeCompare(b.first?.pickupTime ?? "99"));

  const tiles = [
    { label: "Vehicles", value: vehicles.length, sub: `${inService} in service`, icon: Bus },
    { label: "Seats used", value: seats ? `${riders} / ${seats}` : String(riders), sub: seats ? `${Math.round((riders / seats) * 100)}% of capacity` : "capacity not set", icon: Users },
    { label: "Documents due", value: docsDue, sub: docsDue ? "registration or insurance within 30 days" : "all in date", icon: ShieldAlert, warn: docsDue > 0 },
    { label: "Pickup runs", value: runs.length, sub: runs[0]?.first?.pickupTime ? `first at ${runs[0].first.pickupTime}` : "none scheduled", icon: RouteIcon },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title="Transport"
          icon={Bus}
          description={<>Vehicles, their drivers and rosters, and the daily pickup runs.</>}
        />
        <div className="flex items-center gap-2">
          <Link href="/transport/routes" className="btn btn-secondary gap-1.5"><RouteIcon className="h-4 w-4" aria-hidden />Routes</Link>
          {canImport && <Link href="/import/new/vehicles" className="btn btn-secondary gap-1.5"><Upload className="h-4 w-4" aria-hidden />Import</Link>}
          {canExport && vehicles.length > 0 && <a href="/api/transport/vehicles/export" className="btn btn-secondary gap-1.5"><Download className="h-4 w-4" aria-hidden />Export</a>}
          <AddVehicleDialog />
        </div>
      </div>

      {error && <p className="rounded-lg border border-[var(--error-border)] bg-[var(--error-soft)] px-4 py-2 text-sm text-[var(--error)]">{error}</p>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="card px-4 py-3">
            <p className="flex items-center gap-1.5 text-xs font-medium text-muted"><t.icon className="h-3.5 w-3.5" aria-hidden />{t.label}</p>
            <p className={cn("tabular mt-0.5 text-xl font-semibold tracking-tight", t.warn ? "text-[var(--warning)]" : "text-primary")}>{t.value}</p>
            <p className="truncate text-xs text-subtle">{t.sub}</p>
          </div>
        ))}
      </div>

      {utilization.length > 0 && (
        <Insights id="transport" title="Seat utilization by vehicle">
          <BarList
            showShare={false}
            items={utilization.map((v) => ({ key: v.id, label: v.label, value: v.pct, valueLabel: `${v.pct}%`, tone: v.tone }))}
          />
        </Insights>
      )}

      {vehicles.length === 0 ? (
        <EmptyState icon={Bus} title="No vehicles yet" description="Vehicles carry workers between the camp and site. Add one to record its plate, capacity and driver, then build pickup routes around it." />
      ) : (
        <>
          <VehicleBrowser
            canEdit={canEditVehicles}
            initialStatus={statusFilter && STATUS[statusFilter] ? statusFilter : ""}
            vehicles={vehicles.map((v) => ({
              id: v.id,
              plateNumber: v.plateNumber,
              type: v.type,
              capacity: v.capacity,
              status: v.status,
              driverName: v.driverName,
              driverPhone: v.driverPhone,
              riders: v._count.employees,
              registrationExpiry: v.registrationExpiry ? v.registrationExpiry.toISOString().slice(0, 10) : null,
              insuranceExpiry: v.insuranceExpiry ? v.insuranceExpiry.toISOString().slice(0, 10) : null,
              routes: v.routes.map((r) => ({ id: r.id, name: r.name, time: r.stops[0]?.pickupTime ?? null })),
              projects: v.projects.map((p) => p.project.name),
            }))}
          />

          {runs.length > 0 && (
            <section className="card overflow-hidden" aria-label="Pickup timetable">
              <header className="border-b border-default bg-surface-subtle px-4 py-2.5">
                <h2 className="text-sm font-semibold text-primary">Pickup timetable</h2>
              </header>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-[var(--border)]">
                  {runs.map((r) => (
                    <tr key={r.id}>
                      <td className="tabular w-20 px-4 py-2.5 font-medium text-primary">{r.first?.pickupTime ?? "—"}</td>
                      <td className="px-2 py-2.5"><Link href={`/transport/routes/${r.id}`} className="font-medium text-primary hover:underline">{r.name}</Link><p className="text-xs text-muted">{r.first?.location} → {r.last?.location}{r.stops > 2 ? ` · ${r.stops} stops` : ""}</p></td>
                      <td className="hidden px-2 py-2.5 text-xs text-secondary sm:table-cell"><Link href={`/transport/${r.vehicleId}`} className="tabular hover:underline">{r.plate}</Link>{r.driver ? ` · ${r.driver}` : ""}</td>
                      <td className="hidden px-4 py-2.5 text-right text-xs text-muted md:table-cell">{r.project ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
        </>
      )}
    </div>
  );
}
