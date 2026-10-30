"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertOctagon,
  AlertTriangle,
  Building2,
  CalendarClock,
  CalendarDays,
  ChevronRight,
  Clock,
  Download,
  FileText,
  MapPin,
  Search,
  ShieldCheck,
  Truck,
  Upload,
  UserRound,
  X,
} from "lucide-react";
import { EmployeeAvatar } from "@/components/Avatar";
import { ScanUpload } from "../scan-upload";
import { DatePicker } from "@/components/ui/DatePicker";
import { setRenewalExpiryAction } from "./actions";
import { scanVerdict } from "@/lib/renewalScan";
import { Badge } from "@/components/Badge";
import { SlideOver } from "@/components/motion";
import { RowMenu } from "@/components/ui/RowMenu";
import { useViewerPref } from "@/lib/useViewerPref";
import { Select } from "@/components/ui/Select";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { cn } from "@/lib/cn";
import type { RenewalItem, RenewalTier } from "@/lib/renewals";
import { RENEWAL_STATUSES, type RenewalCaseView, type RenewalRow, type RenewalStatus } from "@/lib/renewalCases";
import { updateRenewalsAction, type RenewalPatch } from "./actions";
import { BulkBar, ExportDialog, NoteCell, OwnerCell, ProgressStrip, StatusChip, type Owner } from "./renewal-workflow";

const NO_CHANGES: Record<string, Partial<RenewalCaseView>> = {};

type TierMeta = {
  key: RenewalTier;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  card: string;
  chip: string;
  bar: string;
  badge: "red" | "amber" | "slate" | "blue";
};

// Red = already expired, orange = critical (a week), amber = upcoming,
// neutral for the long-lead horizon — severity is the whole point of the page.
const TIERS: TierMeta[] = [
  { key: "expired", label: "Expired", icon: AlertOctagon, card: "border-[var(--error-border)] bg-[var(--error-soft)]", chip: "bg-[var(--error)] text-white", bar: "bg-[var(--error)]", badge: "red" },
  { key: "urgent", label: "Due in 7 days", icon: AlertTriangle, card: "border-[#fed7aa] bg-[#fff7ed]", chip: "bg-[#ea580c] text-white", bar: "bg-[#ea580c]", badge: "red" },
  { key: "soon", label: "Due in 30 days", icon: Clock, card: "border-[var(--warning-border)] bg-[var(--warning-soft)]", chip: "bg-[#f59e0b] text-white", bar: "bg-[#f59e0b]", badge: "amber" },
  { key: "planned", label: "Due in 60 days", icon: CalendarDays, card: "border-default bg-surface", chip: "bg-[var(--info-soft)] text-[var(--info)]", bar: "bg-[var(--info)]", badge: "blue" },
  { key: "horizon", label: "Due in 90 days", icon: CalendarClock, card: "border-default bg-surface", chip: "bg-surface-sunken text-muted", bar: "bg-[var(--text-subtle)]", badge: "slate" },
];
const TIER_BY_KEY = new Map(TIERS.map((t) => [t.key, t]));

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function runwayLabel(days: number) {
  if (days < 0) return `${Math.abs(days)} day${days === -1 ? "" : "s"} overdue`;
  if (days === 0) return "Expires today";
  return `${days} day${days === 1 ? "" : "s"} left`;
}

/** 0–100 fill for the runway bar: a full bar is 90 days out, empty is expired. */
function runwayPct(days: number) {
  return Math.max(4, Math.min(100, (Math.max(0, days) / 90) * 100));
}

function subjectHref(item: RenewalItem) {
  if (item.href) return item.href;
  return item.kind === "employee" ? `/employees/${item.subjectId}` : `/suppliers/${item.subjectId}`;
}

type Kind = RenewalItem["kind"];
const KINDS: Kind[] = ["employee", "supplier", "party", "vehicle", "record"];
const KIND_FILTER = [
  { value: "", label: "Everyone" },
  { value: "employee", label: "Employees" },
  { value: "supplier", label: "Suppliers" },
  { value: "party", label: "Owners & sponsors" },
  { value: "vehicle", label: "Vehicles" },
  { value: "record", label: "Clients, projects & other" },
];
const VIEW_LABEL: Record<Kind, string> = { employee: "View employee", supplier: "View supplier", party: "View supplier", vehicle: "View vehicle", record: "Open record" };
const UPDATE_LABEL: Record<Kind, string> = { employee: "", supplier: "Update supplier documents", party: "Update owner & sponsor documents", vehicle: "Update vehicle documents", record: "Update the document" };
/** The line under a name: suppliers are marked as such; owners and vehicles already say what they are. */
const subjectLine = (item: RenewalItem) => (item.kind === "supplier" ? `Supplier · ${item.subjectRef}` : item.subjectRef);
function KindIcon({ kind, className }: { kind: Kind; className: string }) {
  if (kind === "vehicle") return <Truck className={className} aria-hidden />;
  if (kind === "record") return <FileText className={className} aria-hidden />;
  if (kind === "party" || kind === "employee") return <UserRound className={className} aria-hidden />;
  return <Building2 className={className} aria-hidden />;
}

function SubjectAvatar({ item, size = "md" }: { item: RenewalItem; size?: "md" | "xl" }) {
  if (item.kind === "employee") {
    return <EmployeeAvatar employeeId={item.subjectId} name={item.subjectName} hasPhoto={item.hasPhoto} size={size} />;
  }
  return (
    <span className={cn("flex shrink-0 items-center justify-center rounded-full bg-surface-sunken text-muted ring-2 ring-[var(--surface)]", size === "xl" ? "h-16 w-16" : "h-9 w-9")}>
      <KindIcon kind={item.kind} className={size === "xl" ? "h-7 w-7" : "h-4 w-4"} />
    </span>
  );
}

export function RenewalsBoard({ items: base, counts, owners, currentUserId, canEdit, canExport }: { items: RenewalRow[]; counts: Record<RenewalTier, number>; owners: Owner[]; currentUserId: string; canEdit: boolean; canExport: boolean }) {
  // Changes show at once and are replaced by the saved state when the page refreshes.
  const [ov, setOv] = useState<{ base: RenewalRow[]; map: Record<string, Partial<RenewalCaseView>> }>({ base, map: {} });
  const overrides = ov.base === base ? ov.map : NO_CHANGES;
  const items = useMemo(() => base.map((i) => (overrides[i.key] ? { ...i, ...overrides[i.key] } : i)), [base, overrides]);
  const [, startSave] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<RenewalStatus | "">("");
  const [mine, setMine] = useState(false);
  const [viewPref, setViewPref] = useViewerPref("ui.renewals.view");
  const view = viewPref === "board" ? "board" : "list";
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  function change(targets: RenewalRow[], patch: RenewalPatch) {
    if (targets.length === 0) return;
    setSaveError(null);
    const view: Partial<RenewalCaseView> = {
      ...(patch.status !== undefined ? { status: patch.status as RenewalStatus, recent: true } : {}),
      ...(patch.ownerId !== undefined ? { ownerId: patch.ownerId, ownerName: patch.ownerId ? (owners.find((o) => o.id === patch.ownerId)?.name ?? null) : null } : {}),
      ...(patch.note !== undefined ? { note: patch.note } : {}),
    };
    setOv({ base, map: { ...overrides, ...Object.fromEntries(targets.map((t) => [t.key, { ...overrides[t.key], ...view }])) } });
    startSave(async () => {
      const res = await updateRenewalsAction(targets.map((t) => ({ kind: t.kind, subjectId: t.subjectId, document: t.document, expiry: t.expiry })), patch);
      if ("error" in res) { setSaveError(res.error); setOv({ base, map: {} }); }
    });
  }

  async function download(refs: RenewalRow[]) {
    setExporting(true);
    setExportError(null);
    try {
      const res = await fetch("/api/renewals/export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refs: refs.map((r) => ({ kind: r.kind, subjectId: r.subjectId, document: r.document, expiry: r.expiry })) }) });
      if (!res.ok) { setExportError(((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? "The export didn't work. Please try again."); return; }
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = `renewals-${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      setExportOpen(false);
    } finally {
      setExporting(false);
    }
  }

  // The filters live in the address, so a filtered list can be shared or reloaded.
  const params = useSearchParams();
  const list = (k: string) => (params.get(k) ?? "").split("|").filter(Boolean);
  const tableRef = useRef<HTMLDivElement>(null);
  const [tier, setTier] = useState<RenewalTier | "all">((TIERS.some((t) => t.key === params.get("tier")) ? params.get("tier") : "all") as RenewalTier | "all");
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [docs, setDocs] = useState<string[]>(list("doc"));
  const [suppliers, setSuppliers] = useState<string[]>(list("supplier"));
  const [projects, setProjects] = useState<string[]>(list("project"));
  const [kind, setKind] = useState<"" | Kind>(KINDS.includes(params.get("who") as Kind) ? (params.get("who") as Kind) : "");
  const [sort, setSort] = useState<"soonest" | "name" | "document">((["soonest", "name", "document"].includes(params.get("sort") ?? "") ? params.get("sort") : "soonest") as "soonest" | "name" | "document");
  const wp = params.get("week");
  const [week, setWeek] = useState<WeekKey | null>(wp === "overdue" ? "overdue" : wp !== null && /^\d+$/.test(wp) && Number(wp) < WEEKS ? Number(wp) : null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const selected = selectedKey ? (items.find((i) => i.key === selectedKey) ?? null) : null;
  const setSelected = (i: RenewalItem | null) => setSelectedKey(i ? (i as RenewalRow).key : null);
  const NONE = "__none";
  useEffect(() => {
    const q = new URLSearchParams();
    if (tier !== "all") q.set("tier", tier);
    if (query) q.set("q", query);
    if (docs.length) q.set("doc", docs.join("|"));
    if (suppliers.length) q.set("supplier", suppliers.join("|"));
    if (projects.length) q.set("project", projects.join("|"));
    if (kind) q.set("who", kind);
    if (sort !== "soonest") q.set("sort", sort);
    if (week !== null) q.set("week", String(week));
    window.history.replaceState(null, "", q.size ? `?${q}` : window.location.pathname);
  }, [tier, query, docs, suppliers, projects, kind, sort, week]);
  const docOptions = useMemo(() => [...new Set(items.map((i) => i.document))].sort().map((d) => ({ value: d, label: d })), [items]);
  const supplierOptions = useMemo(() => [...new Set(items.map((i) => i.supplier).filter((x): x is string => !!x))].sort().map((d) => ({ value: d, label: d })), [items]);
  const projectOptions = useMemo(() => [{ value: NONE, label: "Not deployed" }, ...[...new Set(items.map((i) => i.project).filter((x): x is string => !!x))].sort().map((d) => ({ value: d, label: d }))], [items]);
  // Everything the filters allow, before the week is chosen: the chart reads this so it stays a way to move between weeks.
  const rowsNoWeek = useMemo(() => {
    const q = query.trim().toLowerCase();
    const out = items.filter(
      (i) =>
        (tier === "all" || i.tier === tier) &&
        (docs.length === 0 || docs.includes(i.document)) &&
        (suppliers.length === 0 || (i.supplier !== null && suppliers.includes(i.supplier))) &&
        (projects.length === 0 || (i.project === null ? projects.includes(NONE) : projects.includes(i.project))) &&
        (!kind || i.kind === kind) &&
        (!statusFilter || i.status === statusFilter) &&
        (!mine || i.ownerId === currentUserId) &&
        (!q || [i.subjectName, i.subjectRef, i.document, i.project, i.supplier].filter(Boolean).some((v) => String(v).toLowerCase().includes(q)))
    );
    return sort === "soonest" ? out : [...out].sort((a, b) => (sort === "name" ? a.subjectName.localeCompare(b.subjectName) : a.document.localeCompare(b.document) || a.days - b.days));
  }, [items, tier, query, docs, suppliers, projects, kind, sort, statusFilter, mine, currentUserId]);
  const rows = useMemo(() => (week === null ? rowsNoWeek : rowsNoWeek.filter((i) => weekOf(i.days) === week)), [rowsNoWeek, week]);
  const filtersActive = !!statusFilter || mine || week !== null || tier !== "all" || !!query || docs.length > 0 || suppliers.length > 0 || projects.length > 0 || !!kind;
  const clear = () => { setStatusFilter(""); setMine(false); setWeek(null); setTier("all"); setQuery(""); setDocs([]); setSuppliers([]); setProjects([]); setKind(""); };
  const statusCounts = useMemo(() => Object.fromEntries(RENEWAL_STATUSES.map((s) => [s.key, items.filter((i) => i.status === s.key).length])) as Record<RenewalStatus, number>, [items]);
  const mineCount = items.filter((i) => i.ownerId === currentUserId).length;
  const pickedRows = items.filter((i) => picked.has(i.key));
  const allShownPicked = rows.length > 0 && rows.every((r) => picked.has(r.key));
  const togglePick = (key: string) => setPicked((p) => { const n = new Set(p); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  const exportChoices = [
    { key: "selected", label: "Selected", count: pickedRows.length },
    { key: "notstarted", label: "All not started", count: items.filter((i) => i.status === "NOT_STARTED").length },
    { key: "month", label: "Due in 30 days", count: items.filter((i) => i.days <= 30).length },
    { key: "list", label: "Everything in the list below", count: rows.length },
    { key: "all", label: "All renewals", count: items.length },
  ];
  const exportRows = (key: string) => (key === "selected" ? pickedRows : key === "notstarted" ? items.filter((i) => i.status === "NOT_STARTED") : key === "month" ? items.filter((i) => i.days <= 30) : key === "list" ? rows : items);
  return (
    <div className="space-y-5">
      {canExport && items.length > 0 && (
        <div className="flex justify-end">
          <button type="button" className="btn btn-secondary" onClick={() => { setExportError(null); setExportOpen(true); }}><Download className="h-4 w-4" aria-hidden /> Export for PRO</button>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {TIERS.map((t) => {
          const active = tier === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => {
                setTier(active ? "all" : t.key);
                // Picking a box filters the table below, so take the reader to it.
                if (!active) requestAnimationFrame(() => tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
              }}
              aria-pressed={active}
              className={cn(
                "group rounded-card border p-4 text-left shadow-card transition hover:-translate-y-px hover:shadow-md",
                t.card,
                active && "!border-[var(--brand-primary)] ring-2 ring-[var(--brand-primary)] ring-offset-2 ring-offset-[var(--canvas)]"
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className={cn("flex h-8 w-8 items-center justify-center rounded-[10px]", t.chip)}>
                  <t.icon className="h-4 w-4" aria-hidden />
                </span>
                <ChevronRight className="h-4 w-4 text-subtle opacity-0 transition group-hover:opacity-100" aria-hidden />
              </div>
              <p className="tabular mt-3 text-[28px] leading-8 font-semibold tracking-tight text-primary">{counts[t.key]}</p>
              <p className="mt-1 text-[13px] font-medium text-secondary">{t.label}</p>
            </button>
          );
        })}
      </div>

      {items.length > 0 && (
        <div className="card p-4">
          <p className="mb-2.5 text-xs font-medium text-muted">Composition: {items.length} renewals due within 90 days</p>
          <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-surface-sunken">
            {TIERS.map((t) =>
              counts[t.key] > 0 ? (
                <span
                  key={t.key}
                  title={`${t.label}: ${counts[t.key]}`}
                  className={cn("h-full first:rounded-l-full last:rounded-r-full transition-[width] duration-500", t.bar)}
                  style={{ width: `${(counts[t.key] / items.length) * 100}%` }}
                />
              ) : null
            )}
          </div>
        </div>
      )}

      {items.length > 0 && <ProgressStrip counts={statusCounts} status={statusFilter} onStatus={setStatusFilter} mine={mine} onMine={setMine} mineCount={mineCount} />}

      {items.length > 0 && (
        <ExpiryChart items={rowsNoWeek} week={week} onWeek={setWeek} onSelect={setSelected} />
      )}

      <div ref={tableRef} className="card scroll-mt-4 overflow-hidden">
        {saveError && <p role="alert" className="border-b border-[var(--error-border)] bg-[var(--error-soft)] px-4 py-2 text-sm text-[var(--error)]">{saveError}</p>}
        {view === "list" && canEdit && pickedRows.length > 0 && (
          <BulkBar count={pickedRows.length} owners={owners} currentUserId={currentUserId} canExport={canExport} onStatus={(s) => change(pickedRows, { status: s })} onOwner={(id) => change(pickedRows, { ownerId: id })} onExport={() => { setExportError(null); setExportOpen(true); }} onClear={() => setPicked(new Set())} />
        )}
        <div className="flex flex-wrap items-center gap-2 border-b border-default p-3">
          <div className="inline-flex overflow-hidden rounded-[10px] border border-default" role="group" aria-label="View">
            {([["board", "Board"], ["list", "List"]] as const).map(([k, l]) => (
              <button key={k} type="button" aria-pressed={view === k} onClick={() => setViewPref(k)} className={cn("px-3.5 py-1.5 text-sm", view === k ? "bg-brand-soft font-semibold text-brand" : "text-secondary hover:bg-surface-hover")}>{l}</button>
            ))}
          </div>
          <div className="relative min-w-[12rem] flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-subtle" aria-hidden />
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name or ID" aria-label="Search renewals" className="input h-9 w-full py-0 pl-9 text-sm" />
          </div>
          <div className="w-44"><MultiSelect values={docs} onChange={setDocs} options={docOptions} placeholder="All documents" noun="documents" /></div>
          <div className="w-44"><MultiSelect values={suppliers} onChange={setSuppliers} options={supplierOptions} placeholder="All suppliers" noun="suppliers" /></div>
          <div className="w-44"><MultiSelect values={projects} onChange={setProjects} options={projectOptions} placeholder="All projects" noun="projects" /></div>
          <div className="w-36">
            <Select value={kind} onChange={(v) => setKind(v as typeof kind)} searchable={false} placeholder="Everyone" options={KIND_FILTER} />
          </div>
          <div className="w-40">
            <Select value={sort} onChange={(v) => setSort(v as typeof sort)} searchable={false} options={[{ value: "soonest", label: "Soonest first" }, { value: "name", label: "Name A–Z" }, { value: "document", label: "By document" }]} />
          </div>
          {filtersActive && (
            <button type="button" onClick={clear} className="inline-flex items-center gap-1 text-xs font-medium text-[var(--brand-primary)] hover:underline"><X className="h-3.5 w-3.5" aria-hidden /> Clear filters</button>
          )}
          <span className="tabular ml-auto text-xs text-muted">{rows.length} of {items.length}</span>
        </div>
        {view === "board" && rows.length > 0 ? (
          <RenewalKanban rows={rows} owners={owners} currentUserId={currentUserId} canEdit={canEdit} onChange={(row, patch) => change([row], patch)} onOpen={(row) => setSelected(row)} />
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-14 text-center">
            <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--success-soft)] text-[var(--success)]">
              <ShieldCheck className="h-5 w-5" aria-hidden />
            </span>
            <p className="text-[15px] font-semibold text-primary">
              {items.length === 0 ? "Nothing due in the next 90 days" : "Nothing matches these filters"}
            </p>
            <p className="mt-1 max-w-sm text-sm text-muted">
              {items.length === 0
                ? "Every tracked document on the active roster is valid beyond the 90-day horizon."
                : "Clear the filters to see the whole renewal queue."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[74rem] text-sm">
              <thead className="border-b border-default text-left text-xs uppercase">
                <tr>
                  {canEdit && (
                    <th className="relative w-10 px-4">
                      <input type="checkbox" aria-label="Select all shown" checked={allShownPicked} onChange={() => setPicked(allShownPicked ? new Set() : new Set(rows.map((r) => r.key)))} />
                    </th>
                  )}
                  <th className="px-4">Employee / Supplier</th>
                  <th className="px-4">Document</th>
                  <th className="px-4">Expires</th>
                  <th className="w-44 px-4">Runway</th>
                  <th className="px-4">Status</th>
                  <th className="px-4">Owner</th>
                  <th className="px-4">Note</th>
                  <th className="px-4">Deployment</th>
                  <th className="relative px-4"><span className="sr-only">Open</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {rows.map((item) => {
                  const t = TIER_BY_KEY.get(item.tier)!;
                  return (
                    <tr
                      key={item.key}
                      onClick={() => setSelected(item)}
                      className={cn("cursor-pointer transition-colors hover:bg-surface-subtle", picked.has(item.key) && "bg-brand-soft/60", item.status === "DONE" && "opacity-65")}
                    >
                      {canEdit && (
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <input type="checkbox" aria-label={`Select ${item.subjectName}, ${item.document}`} checked={picked.has(item.key)} onChange={() => togglePick(item.key)} />
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <SubjectAvatar item={item} />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-primary">{item.subjectName}</p>
                            <p className="tabular truncate text-xs text-subtle">
                              {subjectLine(item)}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-2 whitespace-nowrap text-secondary">
                          <FileText className="h-4 w-4 text-subtle" aria-hidden />
                          {item.document}
                        </span>
                      </td>
                      <td className="tabular px-4 py-3 whitespace-nowrap text-secondary" onClick={(e) => e.stopPropagation()}>{fmt(item.expiry)}<ScanNote item={item} /></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-surface-sunken">
                            <div className={cn("h-full rounded-full", t.bar)} style={{ width: `${runwayPct(item.days)}%` }} />
                          </div>
                          <Badge color={t.badge}>{runwayLabel(item.days)}</Badge>
                        </div>
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <StatusChip value={item.status} disabled={!canEdit} onChange={(s) => change([item], { status: s })} />
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <OwnerCell ownerId={item.ownerId} ownerName={item.ownerName} owners={owners} currentUserId={currentUserId} disabled={!canEdit} onChange={(id) => change([item], { ownerId: id })} />
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <NoteCell value={item.note} disabled={!canEdit} onSave={(n) => change([item], { note: n })} />
                      </td>
                      <td className="max-w-[12rem] truncate px-4 py-3 text-muted">{item.project || item.supplier || "—"}</td>
                      <td className="px-4 py-3 text-right">
                        <ChevronRight className="ml-auto h-4 w-4 text-subtle" aria-hidden />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <SlideOver
        open={!!selected}
        onOpenChange={(o) => !o && setSelected(null)}
        title={selected ? `${selected.document} renewal` : ""}
        description={selected ? runwayLabel(selected.days) : undefined}
        width="34rem"
      >
        {selected && <RenewalDetail item={selected} owners={owners} currentUserId={currentUserId} canEdit={canEdit} onChange={(patch) => change([selected], patch)} onClose={() => setSelected(null)} />}
      </SlideOver>

      {canExport && (
        <ExportDialog open={exportOpen} onOpenChange={setExportOpen} choices={exportChoices} busy={exporting} error={exportError} onExport={(k) => void download(exportRows(k))} />
      )}
    </div>
  );
}

/** Renewals as columns by status. Drag a card to another column to change its status; on a phone one column shows at a time. */
function RenewalKanban({ rows, owners, currentUserId, canEdit, onChange, onOpen }: { rows: RenewalRow[]; owners: Owner[]; currentUserId: string; canEdit: boolean; onChange: (row: RenewalRow, patch: RenewalPatch) => void; onOpen: (row: RenewalRow) => void }) {
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [over, setOver] = useState<RenewalStatus | null>(null);
  const [mobile, setMobile] = useState<RenewalStatus>("NOT_STARTED");
  const byStatus = (s: RenewalStatus) => rows.filter((r) => r.status === s).sort((a, b) => a.days - b.days);
  // Done shows only what was finished lately, so the column does not grow for ever.
  const doneAll = byStatus("DONE");
  const done = doneAll.filter((r) => r.recent);
  const hiddenDone = doneAll.length - done.length;
  const drop = (status: RenewalStatus) => {
    const row = rows.find((r) => r.key === dragKey);
    setDragKey(null);
    setOver(null);
    if (row && row.status !== status && canEdit) onChange(row, { status });
  };
  return (
    <div className="p-3">
      <div className="mb-3 flex gap-2 overflow-x-auto md:hidden" role="tablist" aria-label="Status">
        {RENEWAL_STATUSES.map((s) => {
          const n = (s.key === "DONE" ? done : byStatus(s.key)).length;
          return (
            <button key={s.key} type="button" role="tab" aria-selected={mobile === s.key} onClick={() => setMobile(s.key)} className={cn("shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold whitespace-nowrap", mobile === s.key ? "bg-[var(--brand-primary)] text-white" : "border border-default text-secondary")}>{s.label} {n}</button>
          );
        })}
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        {RENEWAL_STATUSES.map((s) => {
          const items = s.key === "DONE" ? done : byStatus(s.key);
          const isOver = over === s.key && dragKey !== null;
          return (
            <section
              key={s.key}
              aria-label={s.label}
              onDragOver={(e) => { if (canEdit && dragKey) { e.preventDefault(); setOver(s.key); } }}
              onDragLeave={() => setOver((o) => (o === s.key ? null : o))}
              onDrop={(e) => { e.preventDefault(); drop(s.key); }}
              className={cn("rounded-card bg-surface-sunken p-2.5 md:max-h-[72vh] md:min-h-[20rem] md:overflow-y-auto", s.key === mobile ? "block" : "hidden md:block", isOver && "ring-2 ring-[var(--brand-primary)]")}
            >
              <div className="mb-2.5 flex items-center justify-between px-1">
                <h3 className={cn("text-[13px] font-bold", s.key === "DONE" ? "text-[var(--success)]" : s.key === "SUBMITTED" ? "text-brand" : s.key === "IN_PROGRESS" ? "text-[var(--info)]" : "text-secondary")}>{s.label}</h3>
                <span className="tabular rounded-full bg-surface px-2 text-xs font-semibold text-muted">{items.length}</span>
              </div>
              <div className="space-y-2">
                {items.map((r) => {
                  const t = TIER_BY_KEY.get(r.tier)!;
                  return (
                    <article
                      key={r.key}
                      draggable={canEdit}
                      onDragStart={(e) => { setDragKey(r.key); e.dataTransfer.setData("text/plain", r.key); e.dataTransfer.effectAllowed = "move"; }}
                      onDragEnd={() => { setDragKey(null); setOver(null); }}
                      onClick={() => onOpen(r)}
                      className={cn("card cursor-pointer p-3 transition hover:border-strong", canEdit && "cursor-grab active:cursor-grabbing", dragKey === r.key && "opacity-50")}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-semibold text-primary">{r.subjectName}</p>
                          <p className="truncate text-xs text-muted">{r.document} · expires {fmt(r.expiry)}</p>
                        </div>
                        {canEdit && (
                          <span onClick={(e) => e.stopPropagation()}>
                            <RowMenu label="Change status" items={RENEWAL_STATUSES.filter((x) => x.key !== r.status).map((x) => ({ label: `Move to ${x.label}`, onSelect: () => onChange(r, { status: x.key }) }))} />
                          </span>
                        )}
                      </div>
                      <div className="mt-2"><Badge color={t.badge}>{runwayLabel(r.days)}</Badge></div>
                      {r.note && <p className="mt-2 line-clamp-2 border-l-2 border-[var(--brand-primary-border)] pl-2 text-xs text-secondary">{r.note}</p>}
                      <div className="mt-2.5" onClick={(e) => e.stopPropagation()}>
                        <OwnerCell ownerId={r.ownerId} ownerName={r.ownerName} owners={owners} currentUserId={currentUserId} disabled={!canEdit} onChange={(id) => onChange(r, { ownerId: id })} />
                      </div>
                    </article>
                  );
                })}
                {items.length === 0 && <p className="px-2 py-6 text-center text-xs text-subtle">{canEdit && dragKey ? "Drop here" : "Nothing here"}</p>}
                {s.key === "DONE" && hiddenDone > 0 && <p className="px-2 pt-1 text-center text-xs text-muted">{hiddenDone} older done in the List view</p>}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function RenewalDetail({ item, owners, currentUserId, canEdit, onChange, onClose }: { item: RenewalRow; owners: Owner[]; currentUserId: string; canEdit: boolean; onChange: (patch: RenewalPatch) => void; onClose: () => void }) {
  const t = TIER_BY_KEY.get(item.tier)!;
  const href = subjectHref(item);
  return (
    <div className="flex flex-1 flex-col gap-5">
      <div className="flex items-center gap-4 rounded-card border border-default bg-surface-subtle p-4">
        <SubjectAvatar item={item} size="xl" />
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-primary">{item.subjectName}</p>
          <p className="tabular text-sm text-muted">{subjectLine(item)}</p>
          <div className="mt-2">
            <Badge color={t.badge} dot>{t.label}</Badge>
          </div>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <span className="eyebrow">Runway</span>
          <span className="text-sm font-semibold text-primary">{runwayLabel(item.days)}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-surface-sunken">
          <div className={cn("h-full rounded-full", t.bar)} style={{ width: `${runwayPct(item.days)}%` }} />
        </div>
        <div className="mt-1 flex justify-between text-[11px] text-subtle">
          <span>Expired</span>
          <span>90 days</span>
        </div>
      </div>

      <dl className="divide-y divide-[var(--border)] rounded-card border border-default">
        <DetailRow icon={FileText} label="Document" value={item.document} />
        <DetailRow icon={CalendarDays} label="Expiry date" value={fmt(item.expiry)} />
        {item.kind === "employee" && <DetailRow icon={FileText} label="Scan on file" value={<ScanNote item={item} inline />} />}
        {item.kind === "employee" && <DetailRow icon={MapPin} label="Project" value={item.project ?? "Not deployed"} />}
        <DetailRow icon={Building2} label={item.kind === "employee" ? "Company" : item.kind === "vehicle" ? "Company" : "Supplier"} value={item.supplier ?? "—"} />
      </dl>

      {item.kind === "employee" && <DocumentOnFile item={item} />}
      {item.kind === "employee" && canEdit && <RenewPanel item={item} onDone={onClose} />}

      <div className="space-y-3 rounded-card border border-default p-4">
        <p className="eyebrow">Progress</p>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <StatusChip value={item.status} disabled={!canEdit} onChange={(s) => onChange({ status: s })} />
          <OwnerCell ownerId={item.ownerId} ownerName={item.ownerName} owners={owners} currentUserId={currentUserId} disabled={!canEdit} onChange={(id) => onChange({ ownerId: id })} />
        </div>
        <NoteCell value={item.note} disabled={!canEdit} onSave={(n) => onChange({ note: n })} />
      </div>

      <div className="mt-auto grid gap-2">
        {/* A worker's document is renewed in the Renew section above; a supplier's is done on the supplier's page. */}
        {item.kind !== "employee" && (
          <Link href={href} className="btn btn-primary w-full">
            <Upload className="h-4 w-4" aria-hidden />
            {UPDATE_LABEL[item.kind]}
          </Link>
        )}
        <Link href={href} className="btn btn-secondary w-full">
          <KindIcon kind={item.kind} className="h-4 w-4" />
          {VIEW_LABEL[item.kind]}
        </Link>
      </div>
    </div>
  );
}

function DetailRow({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Icon className="h-4 w-4 shrink-0 text-subtle" aria-hidden />
      <dt className="w-28 shrink-0 text-xs text-muted">{label}</dt>
      <dd className="min-w-0 flex-1 truncate text-sm font-medium text-primary">{value}</dd>
    </div>
  );
}

const WEEKS = 13;
type WeekKey = "overdue" | number;
const weekOf = (days: number): WeekKey | null => (days < 0 ? "overdue" : days < WEEKS * 7 ? Math.floor(days / 7) : null);
// The urgency colour of a week is that of its last day (the same cut-offs as the tier cards).
const weekTier = (w: WeekKey): RenewalTier => { if (w === "overdue") return "expired"; const d = w * 7 + 6; return d <= 7 ? "urgent" : d <= 30 ? "soon" : d <= 60 ? "planned" : "horizon"; };

/** "17–23 Oct" for the week that starts `w` weeks from today. */
function weekRange(w: number) {
  const start = new Date(); start.setDate(start.getDate() + w * 7);
  const end = new Date(start); end.setDate(end.getDate() + 6);
  const f = (d: Date, month: boolean) => d.toLocaleDateString("en-GB", month ? { day: "numeric", month: "short" } : { day: "numeric" });
  return start.getMonth() === end.getMonth() ? `${f(start, false)}–${f(end, true)}` : `${f(start, true)} – ${f(end, true)}`;
}

/**
 * The next 90 days, two ways. By week: a bar per week (overdue on its own at the left) that filters the list when
 * clicked. By document: one lane per document type with a dot for each renewal, so clusters stay readable. Both
 * follow the other filters, so they always describe what the list could show.
 */
function ExpiryChart({ items, week, onWeek, onSelect }: { items: RenewalItem[]; week: WeekKey | null; onWeek: (w: WeekKey | null) => void; onSelect: (i: RenewalItem) => void }) {
  const [view, setView] = useState<"week" | "doc">("week");
  const buckets = useMemo(() => {
    const out: { key: WeekKey; label: string; hint: string; items: RenewalItem[] }[] = [{ key: "overdue", label: "Overdue", hint: "Already expired", items: [] }];
    for (let w = 0; w < WEEKS; w++) out.push({ key: w, label: w === 0 ? "This week" : w === 1 ? "Next week" : `+${w}w`, hint: weekRange(w), items: [] });
    for (const i of items) { const k = weekOf(i.days); if (k !== null) out.find((b) => b.key === k)!.items.push(i); }
    return out;
  }, [items]);
  const max = Math.max(1, ...buckets.map((b) => b.items.length));
  const lanes = useMemo(() => [...new Set(items.map((i) => i.document))].sort().map((d) => ({ doc: d, items: items.filter((i) => i.document === d) })), [items]);
  return (
    <section className="card p-4 sm:p-5" aria-label="Expiry timeline">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-baseline gap-3">
          <h2 className="text-sm font-semibold text-primary">Expiry timeline</h2>
          <span className="text-xs text-muted">{view === "week" ? "Renewals per week, next 90 days" : "One lane per document type"}</span>
        </div>
        <div className="inline-flex overflow-hidden rounded-[10px] border border-default" role="group" aria-label="Timeline view">
          {([["week", "By week"], ["doc", "By document"]] as const).map(([k, l]) => (
            <button key={k} type="button" aria-pressed={view === k} onClick={() => setView(k)} className={cn("px-3 py-1 text-xs", view === k ? "bg-brand-soft font-semibold text-brand" : "text-secondary hover:bg-surface-hover")}>{l}</button>
          ))}
        </div>
      </div>
      {view === "week" ? (
        <div>
          <div className="flex h-28 items-end gap-1.5 sm:gap-2">
            {buckets.map((b) => {
              const n = b.items.length;
              const t = TIER_BY_KEY.get(weekTier(b.key))!;
              const on = week === b.key;
              return (
                <button key={String(b.key)} type="button" disabled={n === 0} onClick={() => onWeek(on ? null : b.key)} aria-pressed={on} aria-label={`${b.label}: ${n} renewal${n === 1 ? "" : "s"}`} title={`${b.hint} · ${n}`}
                  className={cn("group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1 rounded-md px-0.5 disabled:cursor-default", on && "bg-brand-soft")}>
                  <span className={cn("tabular text-[11px]", n ? "text-secondary" : "invisible")}>{n}</span>
                  <span className={cn("w-full max-w-11 rounded-t-md rounded-b-sm transition group-enabled:group-hover:opacity-80", n ? t.bar : "bg-surface-sunken")} style={{ height: n ? `${Math.max(12, (n / max) * 72)}px` : "3px" }} />
                </button>
              );
            })}
          </div>
          <div className="mt-1.5 flex gap-1.5 sm:gap-2">
            {buckets.map((b) => (
              <span key={String(b.key)} className={cn("min-w-0 flex-1 text-center text-[10.5px] sm:truncate", b.key === "overdue" ? "font-semibold text-[var(--error)]" : "text-subtle", b.key !== "overdue" && b.key % 4 !== 0 && "max-sm:invisible")}>{b.label}</span>
            ))}
          </div>
        </div>
      ) : (
        <div>
          <div className="mb-1 grid grid-cols-[6.5rem_1fr_1.5rem] gap-3 text-[11px] text-subtle sm:grid-cols-[8rem_1fr_1.5rem]">
            <span />
            <div className="relative h-4">
              {[[-30, "30d overdue"], [0, "Today"], [30, "30d"], [60, "60d"], [90, "90d"]].map(([d, l]) => (
                <span key={String(l)} className={cn("absolute -translate-x-1/2 whitespace-nowrap", d === 0 && "font-semibold text-secondary", d === -30 && "translate-x-0", d === 90 && "-translate-x-full")} style={{ left: `${((Number(d) + 30) / 120) * 100}%` }}>{l}</span>
              ))}
            </div>
            <span />
          </div>
          {lanes.map((l) => {
            // Renewals on the same day sit side by side instead of on top of each other.
            const sameDay = new Map<number, number>();
            return (
              <div key={l.doc} className="grid grid-cols-[6.5rem_1fr_1.5rem] items-center gap-3 border-t border-default py-2 sm:grid-cols-[8rem_1fr_1.5rem]">
                <span className="truncate text-sm text-secondary">{l.doc}</span>
                <div className="relative h-5 rounded-lg bg-gradient-to-r from-[var(--error-soft)] from-0% via-[var(--warning-soft)] via-35% to-[var(--surface-sunken)]">
                  <span aria-hidden className="absolute top-0 bottom-0 w-px bg-[var(--border-strong)]" style={{ left: `${(30 / 120) * 100}%` }} />
                  {l.items.map((item, i) => {
                    const t = TIER_BY_KEY.get(item.tier)!;
                    const d = Math.max(-30, Math.min(90, item.days));
                    const k = sameDay.get(d) ?? 0;
                    sameDay.set(d, k + 1);
                    return (
                      <button key={`${item.kind}-${item.subjectId}-${i}`} type="button" onClick={() => onSelect(item)} title={`${item.subjectName}: ${runwayLabel(item.days)}`} aria-label={`${item.subjectName}, ${item.document}, ${runwayLabel(item.days)}`}
                        className={cn("absolute top-1 h-3 w-3 -translate-x-1/2 rounded-full ring-2 ring-[var(--surface)] transition hover:z-10 hover:scale-150", t.bar)} style={{ left: `calc(${((d + 30) / 120) * 100}% + ${k * 9}px)` }} />
                    );
                  })}
                </div>
                <span className="tabular text-right text-sm font-semibold text-primary">{l.items.length}</span>
              </div>
            );
          })}
        </div>
      )}
      {week !== null && view === "week" && (
        <p className="mt-3 text-xs text-muted">Showing {week === "overdue" ? "overdue renewals" : `${buckets.find((b) => b.key === week)?.hint}`} in the list below. <button type="button" className="font-medium text-brand hover:underline" onClick={() => onWeek(null)}>Show all weeks</button></p>
      )}
    </section>
  );
}

/** Where the date on the record stands against the uploaded file: agrees, differs (with the file's date), has no date, or no file. */
function ScanNote({ item, inline = false }: { item: RenewalRow; inline?: boolean }) {
  if (item.kind !== "employee") return null;
  const v = scanVerdict(item.expiry, item.scan);
  const open = (id: string) => (
    <a href={`/api/documents/${id}`} target="_blank" rel="noreferrer" className="font-medium text-[var(--brand-primary)] hover:underline">open scan</a>
  );
  const wrap = (tone: string, children: React.ReactNode) => <span className={cn(inline ? "text-sm" : "mt-0.5 block text-[11px] font-normal", tone)}>{children}</span>;
  if (v.kind === "none") return wrap("text-subtle", "No scan on file");
  if (v.kind === "agrees") return wrap("text-muted", <>Scan agrees · {open(v.id)}</>);
  if (v.kind === "undated") return wrap("text-muted", <>Scan has no date · {open(v.id)}</>);
  return wrap("text-[var(--warning)]", <>Scan shows {fmt(v.scanExpiry)} · {open(v.id)}</>);
}

/* eslint-disable @next/next/no-img-element -- a stored scan served by the API, not a static asset */
/** The file behind this renewal, shown in place, so the date can be checked against the paper without leaving the panel. */
function DocumentOnFile({ item }: { item: RenewalRow }) {
  const scan = item.scan;
  if (!scan) return <p className="rounded-card border border-dashed border-default p-4 text-center text-sm text-muted">No {item.document.toLowerCase()} is on file for {item.subjectName}. Upload it below.</p>;
  const src = `/api/documents/${scan.id}`;
  const isPdf = scan.mime === "application/pdf";
  const isImage = /^image\/(jpeg|png|gif|webp)$/.test(scan.mime);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className="eyebrow">Document on file</span>
        <span className="flex items-center gap-3 text-xs">
          <a href={src} target="_blank" rel="noreferrer" className="font-medium text-[var(--brand-primary)] hover:underline">Open</a>
          <a href={src} download className="font-medium text-[var(--brand-primary)] hover:underline">Download</a>
        </span>
      </div>
      <div className="flex h-72 items-center justify-center overflow-hidden rounded-card border border-default bg-surface-sunken">
        {isPdf ? <iframe src={`${src}#toolbar=0&navpanes=0&view=FitH`} title={scan.filename} className="h-full w-full" />
          : isImage ? <img src={src} alt={scan.filename} className="max-h-full max-w-full object-contain" />
          : <p className="px-4 text-center text-sm text-muted">No preview for this file type. Use Download.</p>}
      </div>
      <p className="truncate text-xs text-muted">{scan.filename}</p>
    </div>
  );
}

/** Renews a worker's document without leaving the renewals queue: upload the new scan (its date is read and put on the record), or just enter the new expiry. */
function RenewPanel({ item, onDone }: { item: RenewalRow; onDone: () => void }) {
  const router = useRouter();
  const [date, setDate] = useState("");
  const [msg, setMsg] = useState<{ tone: "ok" | "warn"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  if (!item.docType || !item.field) return null;
  const finish = () => { router.refresh(); onDone(); };
  return (
    <div className="space-y-3 rounded-card border border-default p-4">
      <p className="eyebrow">Renew</p>
      <ScanUpload
        employeeId={item.subjectId}
        docType={item.docType}
        hasPhoto={item.hasPhoto}
        title={`Upload the new ${item.document.toLowerCase()}`}
        hint="Drop a file or click. The new expiry is read from it and put on the record."
        compact
        onDone={(o) => {
          if (o.applied.length > 0) { setMsg({ tone: "ok", text: `Saved. ${o.applied.map((a) => `${a.label}: ${fmt(a.value)}`).join(", ")}.` }); setTimeout(finish, 1200); }
          else setMsg({ tone: "warn", text: o.unread > 0 || o.conflicts.length === 0 ? "The file is saved, but no newer expiry could be read from it. Enter the new date below." : "The file is saved. Its date differs from the record; check it below." });
        }}
      />
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs text-muted">
          New expiry date
          <DatePicker value={date} onChange={setDate} ariaLabel={`New expiry for ${item.document}`} placeholder="choose a date" className="w-44" />
        </label>
        <button
          type="button"
          disabled={!date || pending}
          onClick={() => startTransition(async () => {
            const r = await setRenewalExpiryAction({ employeeId: item.subjectId, field: item.field!, expiry: date });
            if ("error" in r) setMsg({ tone: "warn", text: r.error });
            else { setMsg({ tone: "ok", text: `Saved. ${item.document} now expires ${fmt(`${date}T00:00:00Z`)}.` }); setTimeout(finish, 1200); }
          })}
          className="btn btn-primary btn-sm"
        >
          Save date
        </button>
      </div>
      {msg && <p role="status" className={cn("text-xs", msg.tone === "ok" ? "text-[var(--success)]" : "text-[var(--warning)]")}>{msg.text}</p>}
    </div>
  );
}
