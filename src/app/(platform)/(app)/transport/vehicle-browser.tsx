"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import * as Popover from "@radix-ui/react-popover";
import { CalendarClock, LayoutGrid, List, MoreHorizontal, Phone, Search, Trash2, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/Badge";
import { ProgressBar } from "@/components/ProgressBar";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { daysUntil } from "@/lib/compliance";
import { cn } from "@/lib/cn";
import { deleteVehicleAction } from "./actions";
import { VehicleDrawer, type VehicleRowInfo } from "./vehicle-drawer";

export type VehicleCard = {
  id: string;
  plateNumber: string;
  type: string | null;
  capacity: number | null;
  status: string;
  driverName: string | null;
  driverPhone: string | null;
  riders: number;
  registrationExpiry: string | null;
  insuranceExpiry: string | null;
  routes: { id: string; name: string; time: string | null }[];
  projects: string[];
};

const STATUS: Record<string, { label: string; color: "green" | "amber" | "slate" }> = {
  ACTIVE: { label: "In service", color: "green" },
  MAINTENANCE: { label: "Maintenance", color: "amber" },
  INACTIVE: { label: "Out of service", color: "slate" },
};

const days = (iso: string | null) => (iso ? daysUntil(new Date(iso)) : null);
const docsDue = (v: VehicleCard) => [v.registrationExpiry, v.insuranceExpiry].some((d) => d && daysUntil(new Date(d)) <= 30);

/** Days until a document lapses: red when expired, amber inside 30 days, quiet otherwise. */
function DocChip({ label, date }: { label: string; date: string | null }) {
  const d = days(date);
  if (d === null) return <span className="text-[11px] text-subtle">{label}: not set</span>;
  const tone = d < 0 ? "text-[var(--error)] font-medium" : d <= 30 ? "text-[var(--warning)] font-medium" : "text-muted";
  return <span className={cn("text-[11px]", tone)}>{label}: {d < 0 ? `expired ${-d}d ago` : `${d}d left`}</span>;
}

export function VehicleBrowser({ vehicles, canEdit, initialStatus }: { vehicles: VehicleCard[]; canEdit: boolean; initialStatus: string }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState(initialStatus);
  const [view, setView] = useState<"cards" | "list">("cards");
  const [drawer, setDrawer] = useState<{ id: string; order: string[] } | null>(null);

  const count = (key: string) => vehicles.filter((v) => (key === "" ? true : key === "docs" ? docsDue(v) : v.status === key)).length;
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return vehicles.filter(
      (v) =>
        (filter === "" || (filter === "docs" ? docsDue(v) : v.status === filter)) &&
        (!q || `${v.plateNumber} ${v.driverName ?? ""} ${v.type ?? ""} ${v.routes.map((r) => r.name).join(" ")} ${v.projects.join(" ")}`.toLowerCase().includes(q))
    );
  }, [vehicles, query, filter]);

  const info = useMemo(() => new Map<string, VehicleRowInfo>(vehicles.map((v) => [v.id, { id: v.id, plateNumber: v.plateNumber, type: v.type, capacity: v.capacity, riders: v.riders, routes: v.routes }])), [vehicles]);
  const open = (id: string) => setDrawer({ id, order: shown.map((v) => v.id) });

  const due = vehicles.flatMap((v) => [
    { v, label: "registration", date: v.registrationExpiry },
    { v, label: "insurance", date: v.insuranceExpiry },
  ]).filter((x) => x.date && daysUntil(new Date(x.date)) <= 30).sort((a, b) => daysUntil(new Date(a.date!)) - daysUntil(new Date(b.date!)));

  const chips = [
    { key: "", label: "All" },
    ...Object.entries(STATUS).map(([key, s]) => ({ key, label: s.label })),
    { key: "docs", label: "Documents due" },
  ];

  return (
    <div className="space-y-4">
      {due.length > 0 && (
        <div role="status" className="flex flex-wrap items-center gap-3 rounded-card border border-[var(--error-border,var(--border))] bg-[var(--error-soft)] px-4 py-3 text-sm">
          <TriangleAlert className="h-5 w-5 shrink-0 text-[var(--error)]" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-primary">{due.length} vehicle {due.length === 1 ? "document needs" : "documents need"} attention</p>
            <p className="truncate text-muted">
              {due.slice(0, 3).map((x) => `${x.v.plateNumber} ${x.label} ${days(x.date)! < 0 ? `expired ${-days(x.date)!}d ago` : `in ${days(x.date)}d`}`).join(" · ")}
              {due.length > 3 ? ` · +${due.length - 3} more` : ""}
            </p>
          </div>
          <button type="button" onClick={() => setFilter("docs")} className="btn btn-secondary btn-sm">Review</button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-[16rem] flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-subtle" aria-hidden />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search plate, driver or route…" aria-label="Search vehicles" className="input w-full pl-9" />
        </label>
        {chips.map((c) => (
          <button
            key={c.key || "all"}
            type="button"
            onClick={() => setFilter(c.key)}
            className={cn(
              "rounded-full border px-3 py-1 text-sm transition",
              filter === c.key ? "border-[var(--brand-primary)] bg-brand-soft font-medium text-[var(--brand-primary)]" : c.key === "docs" && count("docs") > 0 ? "border-[var(--error-border,var(--border))] text-[var(--error)] hover:bg-surface-hover" : "border-default text-secondary hover:bg-surface-hover"
            )}
          >
            {c.label}<span className="tabular ml-1.5 text-xs opacity-70">{count(c.key)}</span>
          </button>
        ))}
        <div className="inline-flex overflow-hidden rounded-control border border-default" role="group" aria-label="View">
          {([["cards", LayoutGrid, "Cards"], ["list", List, "List"]] as const).map(([key, Icon, label]) => (
            <button key={key} type="button" aria-pressed={view === key} aria-label={label} title={label} onClick={() => setView(key)} className={cn("px-2.5 py-1.5", view === key ? "bg-[var(--brand-primary)] text-white" : "bg-surface text-muted hover:bg-surface-hover")}><Icon className="h-4 w-4" aria-hidden /></button>
          ))}
        </div>
      </div>

      {shown.length === 0 && <p className="card px-4 py-10 text-center text-sm text-muted">No vehicles match.</p>}

      {view === "cards" && shown.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((v) => {
            const st = STATUS[v.status] ?? { label: v.status, color: "slate" as const };
            return (
              <article
                key={v.id}
                tabIndex={0}
                onClick={() => open(v.id)}
                onKeyDown={(e) => { if (e.key === "Enter" && e.target === e.currentTarget) open(v.id); }}
                className="card flex cursor-pointer flex-col gap-3 p-4 transition hover:shadow-md focus-visible:outline-2 focus-visible:outline-[var(--brand-primary)]"
              >
                <header className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className="tabular block truncate text-base font-semibold text-primary">{v.plateNumber}</span>
                    <p className="text-xs text-muted">{v.type || "Type not set"}{v.capacity ? ` · ${v.capacity} seats` : ""}</p>
                  </div>
                  <span className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <Badge color={st.color} dot>{st.label}</Badge>
                    <RowMenu v={v} canEdit={canEdit} />
                  </span>
                </header>
                <div className="text-sm">
                  <p className="text-xs text-muted">Driver</p>
                  {v.driverName ? (
                    <p className="flex flex-wrap items-center gap-x-2 text-primary">
                      {v.driverName}
                      {v.driverPhone && <a href={`tel:${v.driverPhone}`} onClick={(e) => e.stopPropagation()} className="tabular inline-flex items-center gap-1 text-xs text-[var(--brand-primary)] hover:underline"><Phone className="h-3 w-3" aria-hidden />{v.driverPhone}</a>}
                    </p>
                  ) : <p className="text-muted">No driver assigned</p>}
                </div>
                <div>
                  <p className="mb-1 text-xs text-muted">Roster</p>
                  {v.capacity ? <ProgressBar value={v.riders} total={v.capacity} label={`${v.riders} / ${v.capacity}`} tone={v.riders > v.capacity ? "error" : undefined} /> : <p className="tabular text-sm text-secondary">{v.riders} riders</p>}
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
                          <span className="truncate text-secondary">{r.name}</span>
                          {r.time && <span className="tabular ml-auto shrink-0">{r.time}</span>}
                        </li>
                      ))}
                    </ul>
                  ) : <p>No routes yet.</p>}
                  {v.projects.length > 0 && <p className="mt-1.5 truncate">Serves {v.projects.join(", ")}</p>}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {view === "list" && shown.length > 0 && (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[52rem] text-sm">
            <thead className="border-b border-default bg-surface-subtle text-left text-xs font-medium tracking-wide text-muted uppercase">
              <tr><th className="px-4 py-3">Vehicle</th><th className="px-4 py-3">Driver</th><th className="px-4 py-3">Roster</th><th className="px-4 py-3">Registration</th><th className="px-4 py-3">Insurance</th><th className="px-4 py-3">Status</th><th className="w-10 px-2 py-3" /></tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {shown.map((v) => {
                const st = STATUS[v.status] ?? { label: v.status, color: "slate" as const };
                return (
                  <tr key={v.id} tabIndex={0} onClick={() => open(v.id)} onKeyDown={(e) => { if (e.key === "Enter" && e.target === e.currentTarget) open(v.id); }} className="cursor-pointer hover:bg-surface-hover">
                    <td className="px-4 py-3"><span className="tabular block font-medium text-primary">{v.plateNumber}</span><span className="text-xs text-muted">{v.type ?? "—"}{v.capacity ? ` · ${v.capacity} seats` : ""}</span></td>
                    <td className="px-4 py-3 text-secondary">{v.driverName ?? "—"}</td>
                    <td className={cn("tabular px-4 py-3", v.capacity && v.riders > v.capacity ? "text-[var(--error)]" : "text-secondary")}>{v.riders}{v.capacity ? ` / ${v.capacity}` : ""}</td>
                    <td className="px-4 py-3"><DocChip label="" date={v.registrationExpiry} /></td>
                    <td className="px-4 py-3"><DocChip label="" date={v.insuranceExpiry} /></td>
                    <td className="px-4 py-3"><Badge color={st.color} dot>{st.label}</Badge></td>
                    <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}><RowMenu v={v} canEdit={canEdit} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {drawer && <VehicleDrawer id={drawer.id} order={drawer.order} info={info} onNavigate={(id) => setDrawer({ id, order: drawer.order })} onClose={() => setDrawer(null)} />}
    </div>
  );
}

/** Open or delete, behind one "⋯" so the card stays quiet. */
function RowMenu({ v, canEdit }: { v: VehicleCard; canEdit: boolean }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const entry = "flex w-full items-center gap-2 rounded-sm px-2.5 py-1.5 text-left text-sm text-secondary hover:bg-surface-hover hover:text-primary";
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button type="button" aria-label={`Actions for ${v.plateNumber}`} className="rounded-md p-1 text-subtle hover:bg-surface-sunken hover:text-primary"><MoreHorizontal className="h-4 w-4" aria-hidden /></button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={4} className="rx-popover z-50 w-44 rounded-control border border-default bg-surface p-1 shadow-popover">
          <Link href={`/transport/${v.id}`} className={entry} onClick={() => setOpen(false)}>Open full page</Link>
          {canEdit && (
            <ConfirmDialog
              title="Delete this vehicle?"
              description={`Delete vehicle "${v.plateNumber}"?${v.riders > 0 ? ` ${v.riders} employee(s) will be unassigned.` : ""}`}
              confirmLabel="Delete"
              onConfirm={async () => {
                const form = new FormData();
                form.append("vehicleId", v.id);
                setOpen(false);
                await deleteVehicleAction(form);
                router.refresh();
              }}
              trigger={(openConfirm) => <button type="button" className={cn(entry, "text-[var(--error)] hover:text-[var(--error)]")} onClick={openConfirm}><Trash2 className="h-4 w-4" aria-hidden />Delete</button>}
            />
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
