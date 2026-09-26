import { PageHeader } from "@/components/PageHeader";
import Link from "next/link";
import { Bus, CalendarClock, Phone, Route as RouteIcon, ShieldAlert, Users } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/Badge";
import { ProgressBar } from "@/components/ProgressBar";
import { DeleteButton } from "@/components/DeleteButton";
import { daysUntil } from "@/lib/compliance";
import { cn } from "@/lib/cn";
import { AddVehicleDialog } from "./add-vehicle-dialog";
import { deleteVehicleAction } from "./actions";

const STATUS: Record<string, { label: string; color: "green" | "amber" | "slate" }> = {
  ACTIVE: { label: "In service", color: "green" },
  MAINTENANCE: { label: "Maintenance", color: "amber" },
  INACTIVE: { label: "Out of service", color: "slate" },
};

/** Days until a document lapses, as a chip: red when expired, amber inside 30 days, quiet otherwise. */
function DocChip({ label, date }: { label: string; date: Date | null }) {
  if (!date) return <span className="text-[11px] text-subtle">{label}: not set</span>;
  const d = daysUntil(date);
  const tone = d < 0 ? "text-[var(--error)] font-medium" : d <= 30 ? "text-[var(--warning)] font-medium" : "text-muted";
  return <span className={cn("text-[11px]", tone)}>{label}: {d < 0 ? `expired ${-d}d ago` : `${d}d left`}</span>;
}

export default async function TransportPage({ searchParams }: { searchParams: Promise<{ error?: string; status?: string }> }) {
  const { error, status: statusFilter } = await searchParams;
  const vehicles = await prisma.vehicle.findMany({
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
  const shown = statusFilter && STATUS[statusFilter] ? vehicles.filter((v) => v.status === statusFilter) : vehicles;

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

      {vehicles.length === 0 ? (
        <EmptyState icon={Bus} title="No vehicles yet" description="Vehicles carry workers between the camp and site. Add one to record its plate, capacity and driver, then build pickup routes around it." />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Filter by status">
            {[{ key: "", label: "All", n: vehicles.length }, ...Object.entries(STATUS).map(([k, v]) => ({ key: k, label: v.label, n: vehicles.filter((x) => x.status === k).length }))].map((t) => (
              <Link key={t.key || "all"} href={t.key ? `/transport?status=${t.key}` : "/transport"} role="tab" aria-selected={(statusFilter ?? "") === t.key}
                className={cn("rounded-full border px-3 py-1 text-sm transition", (statusFilter ?? "") === t.key ? "border-[var(--brand-primary)] bg-brand-soft font-medium text-[var(--brand-primary)]" : "border-default text-secondary hover:bg-surface-hover")}>
                {t.label}<span className="tabular ml-1.5 text-xs opacity-70">{t.n}</span>
              </Link>
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {shown.map((v) => {
              const st = STATUS[v.status] ?? { label: v.status, color: "slate" as const };
              return (
                <article key={v.id} className="card flex flex-col gap-3 p-4">
                  <header className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link href={`/transport/${v.id}`} className="tabular block truncate text-base font-semibold text-primary hover:underline">{v.plateNumber}</Link>
                      <p className="text-xs text-muted">{v.type || "Type not set"}{v.capacity ? ` · ${v.capacity} seats` : ""}</p>
                    </div>
                    <Badge color={st.color} dot>{st.label}</Badge>
                  </header>

                  <div className="text-sm">
                    <p className="text-xs text-muted">Driver</p>
                    {v.driverName ? (
                      <p className="flex flex-wrap items-center gap-x-2 text-primary">
                        {v.driverName}
                        {v.driverPhone && <a href={`tel:${v.driverPhone}`} className="tabular inline-flex items-center gap-1 text-xs text-[var(--brand-primary)] hover:underline"><Phone className="h-3 w-3" aria-hidden />{v.driverPhone}</a>}
                      </p>
                    ) : (
                      <p className="text-muted">No driver assigned</p>
                    )}
                  </div>

                  <div>
                    <p className="mb-1 text-xs text-muted">Roster</p>
                    {v.capacity ? <ProgressBar value={v._count.employees} total={v.capacity} label={`${v._count.employees} / ${v.capacity}`} tone={v._count.employees > v.capacity ? "error" : undefined} /> : <p className="tabular text-sm text-secondary">{v._count.employees} riders</p>}
                  </div>

                  <div className="flex flex-col gap-0.5">
                    <DocChip label="Registration" date={v.registrationExpiry} />
                    <DocChip label="Insurance" date={v.insuranceExpiry} />
                  </div>

                  <div className="flex-1 border-t border-default pt-2 text-xs text-muted">
                    {v.routes.length > 0 ? (
                      <ul className="space-y-1">
                        {v.routes.slice(0, 2).map((r) => (
                          <li key={r.id} className="flex items-center gap-1.5">
                            <CalendarClock className="h-3 w-3 shrink-0 text-subtle" aria-hidden />
                            <Link href={`/transport/routes/${r.id}`} className="truncate text-secondary hover:underline">{r.name}</Link>
                            {r.stops[0]?.pickupTime && <span className="tabular ml-auto shrink-0">{r.stops[0].pickupTime}</span>}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p>No routes yet.</p>
                    )}
                    {v.projects.length > 0 && <p className="mt-1.5 truncate">Serves {v.projects.map((p) => p.project.name).join(", ")}</p>}
                  </div>

                  <footer className="flex items-center justify-between">
                    <Link href={`/transport/${v.id}`} className="text-xs font-medium text-[var(--brand-primary)] hover:underline">Open vehicle →</Link>
                    <DeleteButton action={deleteVehicleAction} hiddenFields={{ vehicleId: v.id }} confirmMessage={`Delete vehicle "${v.plateNumber}"?${v._count.employees > 0 ? ` ${v._count.employees} employee(s) will be unassigned.` : ""}`} />
                  </footer>
                </article>
              );
            })}
          </div>

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
