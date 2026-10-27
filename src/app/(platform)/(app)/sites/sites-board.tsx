"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, MapPin, Plus } from "lucide-react";
import { HeroHeader, heroButton } from "@/components/HeroHeader";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/Dialog";
import { Select } from "@/components/ui/Select";
import { DeleteButton } from "@/components/DeleteButton";
import { cn } from "@/lib/cn";
import { createSiteAction, deleteSiteAction, updateSiteAction } from "./actions";
import { SiteTable, type SiteRow } from "./site-table";

export type ProjectGroup = {
  id: string;
  code: string;
  name: string;
  client: string | null;
  sites: { id: string; name: string; address: string | null; workers: number; hours: number; timesheetRows: number }[];
};

const num = (n: number) => Math.round(n).toLocaleString("en-AE");
const mapUrl = (address: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

/** Sites under the project they belong to, with who is on each and the hours they have worked this month. */
export function SitesBoard({ projects, canWrite, monthLabel }: { projects: ProjectGroup[]; canWrite: boolean; monthLabel: string }) {
  const [view, setView] = useState<"grouped" | "table">("grouped");
  const [query, setQuery] = useState("");
  const [client, setClient] = useState("");
  const [use, setUse] = useState<"" | "used" | "unused">("");
  const [adding, setAdding] = useState<{ projectId: string } | null>(null);
  const [editing, setEditing] = useState<{ site: ProjectGroup["sites"][number]; project: ProjectGroup } | null>(null);

  const all = projects.flatMap((p) => p.sites);
  const withSites = projects.filter((p) => p.sites.length > 0);
  const without = projects.filter((p) => p.sites.length === 0);
  const clients = useMemo(() => [...new Set(projects.map((p) => p.client).filter((c): c is string => !!c))].sort(), [projects]);
  const inUse = (s: ProjectGroup["sites"][number]) => s.workers > 0 || s.timesheetRows > 0;

  const q = query.trim().toLowerCase();
  const groups = withSites
    .filter((p) => !client || p.client === client)
    .map((p) => ({ ...p, sites: p.sites.filter((s) => (!use || (use === "used") === inUse(s)) && (!q || [s.name, s.address, p.name, p.code, p.client].some((x) => x?.toLowerCase().includes(q)))) }))
    .filter((g) => g.sites.length > 0);
  const tableRows: SiteRow[] = projects.flatMap((p) => p.sites.map((s) => ({ id: s.id, name: s.name, address: s.address, projectId: p.id, projectCode: p.code, projectName: p.name, clientName: p.client, workers: s.workers, timesheetRows: s.timesheetRows })));

  return (
    <div className="space-y-5">
      <HeroHeader
        icon={MapPin}
        title="Sites"
        subtitle="Where work actually happens. Each site sits under a project and takes its client from it."
        pills={[
          { label: "Sites", value: String(all.length) },
          { label: "Workers on sites", value: String(all.reduce((n, s) => n + s.workers, 0)) },
          { label: "Projects with sites", value: `${withSites.length} of ${projects.length}` },
          ...(without.length > 0 ? [{ label: "Projects without a site", value: String(without.length), warn: true }] : []),
        ]}
        actions={canWrite ? (
          <>
            <button type="button" className={heroButton()} onClick={() => setView("table")}>Import or export</button>
            <button type="button" className={heroButton(true)} onClick={() => setAdding({ projectId: "" })}><Plus className="h-4 w-4" aria-hidden /> Add site</button>
          </>
        ) : undefined}
      />

      <div className="flex flex-wrap items-center gap-2">
        {view === "grouped" && (
          <>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search sites, projects or addresses" aria-label="Search sites" className="input h-9 w-72 text-sm" />
            <div className="w-44"><Select value={client} onChange={setClient} searchable={false} options={[{ value: "", label: "All clients" }, ...clients.map((c) => ({ value: c, label: c }))]} /></div>
            <div className="inline-flex overflow-hidden rounded-[10px] border border-default" role="group" aria-label="Usage">
              {([["", "All"], ["used", "In use"], ["unused", "Not in use"]] as const).map(([k, l]) => (
                <button key={k} type="button" aria-pressed={use === k} onClick={() => setUse(k)} className={cn("px-3 py-1.5 text-sm", use === k ? "bg-brand-soft font-semibold text-brand" : "text-secondary hover:bg-surface-hover")}>{l}</button>
              ))}
            </div>
          </>
        )}
        <div className="ml-auto inline-flex overflow-hidden rounded-[10px] border border-default" role="group" aria-label="View">
          {([["grouped", "Grouped"], ["table", "Table"]] as const).map(([k, l]) => (
            <button key={k} type="button" aria-pressed={view === k} onClick={() => setView(k)} className={cn("px-3 py-1.5 text-sm", view === k ? "bg-brand-soft font-semibold text-brand" : "text-secondary hover:bg-surface-hover")}>{l}</button>
          ))}
        </div>
      </div>

      {view === "table" ? (
        <SiteTable sites={tableRows} />
      ) : (
        <>
          {groups.length === 0 && (
            <div className="card p-10 text-center text-sm text-muted">{all.length === 0 ? "No sites yet. Add the first one, or import a list under Table." : "No sites match."}</div>
          )}
          {groups.map((g) => {
            const workers = g.sites.reduce((n, s) => n + s.workers, 0);
            return (
              <section key={g.id} className="card overflow-hidden" aria-label={g.name}>
                <div className="flex flex-wrap items-center gap-3 border-b border-default bg-surface-subtle px-4 py-3 sm:px-5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-brand-soft text-brand"><MapPin className="h-4 w-4" aria-hidden /></span>
                  <div className="min-w-0 flex-1">
                    <Link href={`/projects/${g.id}`} className="block truncate text-sm font-semibold text-primary hover:underline"><span className="tabular text-muted">{g.code}</span> · {g.name}</Link>
                    <p className="truncate text-xs text-muted">{g.client ?? "No client"}</p>
                  </div>
                  <span className="text-xs text-muted">{g.sites.length} {g.sites.length === 1 ? "site" : "sites"} · {workers} workers</span>
                  {canWrite && <button type="button" onClick={() => setAdding({ projectId: g.id })} className="btn btn-secondary"><Plus className="h-3.5 w-3.5" aria-hidden /> Add site</button>}
                </div>
                <ul className="divide-y divide-default overflow-x-auto">
                  {g.sites.map((s) => (
                    <li key={s.id}>
                      <button type="button" onClick={() => setEditing({ site: s, project: g })} className="grid w-full min-w-[40rem] grid-cols-[1.2fr_1.6fr_6rem_7.5rem_6.5rem_1.25rem] items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-surface-hover sm:px-5">
                        <span className="truncate font-semibold text-primary">{s.name}</span>
                        <span className="truncate text-xs text-muted">{s.address ?? "No address"}</span>
                        <span className="tabular text-right"><b className="font-semibold text-primary">{s.workers}</b> <span className="text-xs text-muted">workers</span></span>
                        <span className="tabular text-right text-xs text-muted">{num(s.hours)} h {monthLabel}</span>
                        <span><span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", inUse(s) ? "bg-success-soft text-success" : "bg-surface-sunken text-muted")}>{inUse(s) ? "In use" : "Not in use"}</span></span>
                        <ChevronRight className="h-4 w-4 text-subtle" aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
          {without.length > 0 && !q && !use && !client && (
            <div className="flex flex-wrap items-center gap-3 rounded-[var(--radius-card)] border border-[var(--warning-border)] bg-[var(--warning-soft)] px-4 py-3 text-sm">
              <b className="font-semibold text-[var(--warning)]">{without.length} {without.length === 1 ? "project has" : "projects have"} no site yet</b>
              <span className="min-w-0 flex-1 truncate text-muted">{without.map((p) => p.name).join(" · ")}</span>
              {canWrite && <button type="button" onClick={() => setAdding({ projectId: without[0].id })} className="font-semibold text-brand hover:underline">Add sites</button>}
            </div>
          )}
        </>
      )}

      <Dialog open={!!adding} onOpenChange={(o) => !o && setAdding(null)}>
        <DialogContent title="Add site" description="A site belongs to one project and takes its client from it.">
          {adding && (
            <form action={async (fd) => { await createSiteAction(fd); setAdding(null); }} className="space-y-3">
              <label className="block text-sm font-medium text-primary">Project
                <div className="mt-1"><Select name="projectId" defaultValue={adding.projectId} placeholder="Select project" options={projects.map((p) => ({ value: p.id, label: `${p.code}: ${p.name}${p.client ? ` · ${p.client}` : ""}` }))} /></div>
              </label>
              <label className="block text-sm font-medium text-primary">Site name<input name="name" required placeholder="e.g. Tower 3: Podium" className="input mt-1 w-full" /></label>
              <label className="block text-sm font-medium text-primary">Address <span className="font-normal text-muted">(optional)</span><input name="address" className="input mt-1 w-full" /></label>
              <DialogFooter>
                <button type="button" className="btn btn-secondary" onClick={() => setAdding(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Add site</button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent title={editing?.site.name ?? "Site"} description={editing ? `${editing.project.code} · ${editing.project.name}${editing.project.client ? ` · ${editing.project.client}` : ""}` : undefined}>
          {editing && (
            <div className="space-y-4">
              <dl className="grid grid-cols-3 gap-2 text-center">
                {[["Workers", String(editing.site.workers)], [`Hours ${monthLabel}`, num(editing.site.hours)], ["Timesheet rows", String(editing.site.timesheetRows)]].map(([l, v]) => (
                  <div key={l} className="rounded-xl bg-surface-sunken px-2 py-2"><dt className="text-[11px] text-muted">{l}</dt><dd className="tabular text-lg font-semibold text-primary">{v}</dd></div>
                ))}
              </dl>
              {canWrite ? (
                <form action={async (fd) => { await updateSiteAction(fd); setEditing(null); }} className="space-y-3">
                  <input type="hidden" name="siteId" value={editing.site.id} />
                  <label className="block text-sm font-medium text-primary">Site name<input name="name" required defaultValue={editing.site.name} className="input mt-1 w-full" /></label>
                  <label className="block text-sm font-medium text-primary">Address<input name="address" defaultValue={editing.site.address ?? ""} className="input mt-1 w-full" /></label>
                  {editing.site.address && <a href={mapUrl(editing.site.address)} target="_blank" rel="noreferrer" className="inline-block text-sm font-medium text-brand hover:underline">Open in Maps ↗</a>}
                  <DialogFooter>
                    <button type="submit" className="btn btn-primary">Save</button>
                  </DialogFooter>
                </form>
              ) : (
                <p className="text-sm text-secondary">{editing.site.address ?? "No address"}{editing.site.address && <> · <a href={mapUrl(editing.site.address)} target="_blank" rel="noreferrer" className="font-medium text-brand hover:underline">Open in Maps ↗</a></>}</p>
              )}
              {canWrite && (
                <div className="flex items-center justify-between border-t border-default pt-3">
                  {editing.site.workers === 0 && editing.site.timesheetRows === 0 ? (
                    <DeleteButton action={deleteSiteAction} hiddenFields={{ siteId: editing.site.id }} confirmMessage={`Delete site "${editing.site.name}"?`} />
                  ) : (
                    <span className="text-xs text-muted">In use by workers or timesheets, so it can&apos;t be deleted.</span>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
