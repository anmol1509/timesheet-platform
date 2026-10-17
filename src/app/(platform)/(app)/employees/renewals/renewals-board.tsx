"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  AlertOctagon,
  AlertTriangle,
  Building2,
  CalendarClock,
  CalendarDays,
  ChevronRight,
  Clock,
  FileText,
  MapPin,
  Search,
  ShieldCheck,
  Upload,
  UserRound,
  X,
} from "lucide-react";
import { EmployeeAvatar } from "@/components/Avatar";
import { Badge } from "@/components/Badge";
import { SlideOver } from "@/components/motion";
import { Select } from "@/components/ui/Select";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { cn } from "@/lib/cn";
import type { RenewalItem, RenewalTier } from "@/lib/renewals";

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
  return item.kind === "employee" ? `/employees/${item.subjectId}` : `/suppliers/${item.subjectId}`;
}

function SubjectAvatar({ item, size = "md" }: { item: RenewalItem; size?: "md" | "xl" }) {
  if (item.kind === "employee") {
    return <EmployeeAvatar employeeId={item.subjectId} name={item.subjectName} hasPhoto={item.hasPhoto} size={size} />;
  }
  return (
    <span className={cn("flex shrink-0 items-center justify-center rounded-full bg-surface-sunken text-muted ring-2 ring-[var(--surface)]", size === "xl" ? "h-16 w-16" : "h-9 w-9")}>
      <Building2 className={size === "xl" ? "h-7 w-7" : "h-4 w-4"} aria-hidden />
    </span>
  );
}

export function RenewalsBoard({ items, counts }: { items: RenewalItem[]; counts: Record<RenewalTier, number> }) {
  // The filters live in the address, so a filtered list can be shared or reloaded.
  const params = useSearchParams();
  const list = (k: string) => (params.get(k) ?? "").split("|").filter(Boolean);
  const [tier, setTier] = useState<RenewalTier | "all">((TIERS.some((t) => t.key === params.get("tier")) ? params.get("tier") : "all") as RenewalTier | "all");
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [docs, setDocs] = useState<string[]>(list("doc"));
  const [suppliers, setSuppliers] = useState<string[]>(list("supplier"));
  const [projects, setProjects] = useState<string[]>(list("project"));
  const [kind, setKind] = useState<"" | "employee" | "supplier">(params.get("who") === "employee" || params.get("who") === "supplier" ? (params.get("who") as "employee" | "supplier") : "");
  const [sort, setSort] = useState<"soonest" | "name" | "document">((["soonest", "name", "document"].includes(params.get("sort") ?? "") ? params.get("sort") : "soonest") as "soonest" | "name" | "document");
  const wp = params.get("week");
  const [week, setWeek] = useState<WeekKey | null>(wp === "overdue" ? "overdue" : wp !== null && /^\d+$/.test(wp) && Number(wp) < WEEKS ? Number(wp) : null);
  const [selected, setSelected] = useState<RenewalItem | null>(null);
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
        (!q || [i.subjectName, i.subjectRef, i.document, i.project, i.supplier].filter(Boolean).some((v) => String(v).toLowerCase().includes(q)))
    );
    return sort === "soonest" ? out : [...out].sort((a, b) => (sort === "name" ? a.subjectName.localeCompare(b.subjectName) : a.document.localeCompare(b.document) || a.days - b.days));
  }, [items, tier, query, docs, suppliers, projects, kind, sort]);
  const rows = useMemo(() => (week === null ? rowsNoWeek : rowsNoWeek.filter((i) => weekOf(i.days) === week)), [rowsNoWeek, week]);
  const filtersActive = week !== null || tier !== "all" || !!query || docs.length > 0 || suppliers.length > 0 || projects.length > 0 || !!kind;
  const clear = () => { setWeek(null); setTier("all"); setQuery(""); setDocs([]); setSuppliers([]); setProjects([]); setKind(""); };
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {TIERS.map((t) => {
          const active = tier === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTier(active ? "all" : t.key)}
              aria-pressed={active}
              className={cn(
                "group rounded-card border p-4 text-left shadow-card transition hover:-translate-y-px hover:shadow-md",
                t.card,
                active && "ring-2 ring-[var(--brand-primary)] ring-offset-2 ring-offset-[var(--canvas)]"
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
          <p className="mb-2.5 text-xs font-medium text-muted">Composition — {items.length} renewals due within 90 days</p>
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

      {items.length > 0 && (
        <ExpiryChart items={rowsNoWeek} week={week} onWeek={setWeek} onSelect={setSelected} />
      )}

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-default p-3">
          <div className="relative min-w-[12rem] flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-subtle" aria-hidden />
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name or ID" aria-label="Search renewals" className="input h-9 w-full py-0 pl-9 text-sm" />
          </div>
          <div className="w-44"><MultiSelect values={docs} onChange={setDocs} options={docOptions} placeholder="All documents" noun="documents" /></div>
          <div className="w-44"><MultiSelect values={suppliers} onChange={setSuppliers} options={supplierOptions} placeholder="All suppliers" noun="suppliers" /></div>
          <div className="w-44"><MultiSelect values={projects} onChange={setProjects} options={projectOptions} placeholder="All projects" noun="projects" /></div>
          <div className="w-36">
            <Select value={kind} onChange={(v) => setKind(v as typeof kind)} searchable={false} placeholder="Everyone" options={[{ value: "", label: "Everyone" }, { value: "employee", label: "Employees" }, { value: "supplier", label: "Suppliers" }]} />
          </div>
          <div className="w-40">
            <Select value={sort} onChange={(v) => setSort(v as typeof sort)} searchable={false} options={[{ value: "soonest", label: "Soonest first" }, { value: "name", label: "Name A–Z" }, { value: "document", label: "By document" }]} />
          </div>
          {filtersActive && (
            <button type="button" onClick={clear} className="inline-flex items-center gap-1 text-xs font-medium text-[var(--brand-primary)] hover:underline"><X className="h-3.5 w-3.5" aria-hidden /> Clear filters</button>
          )}
          <span className="tabular ml-auto text-xs text-muted">{rows.length} of {items.length}</span>
        </div>
        {rows.length === 0 ? (
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
            <table className="w-full min-w-[52rem] text-sm">
              <thead className="border-b border-default text-left text-xs uppercase">
                <tr>
                  <th className="px-4">Employee / Supplier</th>
                  <th className="px-4">Document</th>
                  <th className="px-4">Expires</th>
                  <th className="w-56 px-4">Runway</th>
                  <th className="px-4">Deployment</th>
                  <th className="relative px-4"><span className="sr-only">Open</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {rows.map((item) => {
                  const t = TIER_BY_KEY.get(item.tier)!;
                  return (
                    <tr
                      key={`${item.kind}-${item.subjectId}-${item.document}`}
                      onClick={() => setSelected(item)}
                      className="cursor-pointer transition-colors hover:bg-surface-subtle"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <SubjectAvatar item={item} />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-primary">{item.subjectName}</p>
                            <p className="tabular truncate text-xs text-subtle">
                              {item.kind === "supplier" ? `Supplier · ${item.subjectRef}` : item.subjectRef}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-2 text-secondary">
                          <FileText className="h-4 w-4 text-subtle" aria-hidden />
                          {item.document}
                        </span>
                      </td>
                      <td className="tabular px-4 py-3 text-secondary">{fmt(item.expiry)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-surface-sunken">
                            <div className={cn("h-full rounded-full", t.bar)} style={{ width: `${runwayPct(item.days)}%` }} />
                          </div>
                          <Badge color={t.badge}>{runwayLabel(item.days)}</Badge>
                        </div>
                      </td>
                      <td className="max-w-[14rem] truncate px-4 py-3 text-muted">{item.project || item.supplier || "—"}</td>
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
        width="28rem"
      >
        {selected && <RenewalDetail item={selected} />}
      </SlideOver>
    </div>
  );
}

function RenewalDetail({ item }: { item: RenewalItem }) {
  const t = TIER_BY_KEY.get(item.tier)!;
  const href = subjectHref(item);
  return (
    <div className="flex flex-1 flex-col gap-5">
      <div className="flex items-center gap-4 rounded-card border border-default bg-surface-subtle p-4">
        <SubjectAvatar item={item} size="xl" />
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-primary">{item.subjectName}</p>
          <p className="tabular text-sm text-muted">{item.kind === "supplier" ? `Supplier · ${item.subjectRef}` : item.subjectRef}</p>
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
        {item.kind === "employee" && <DetailRow icon={MapPin} label="Project" value={item.project ?? "Not deployed"} />}
        <DetailRow icon={Building2} label={item.kind === "employee" ? "Company" : "Supplier"} value={item.supplier ?? "—"} />
      </dl>

      <div className="mt-auto grid gap-2">
        <Link href={href} className="btn btn-primary w-full">
          <Upload className="h-4 w-4" aria-hidden />
          {item.kind === "employee" ? "Renew & upload document" : "Update supplier documents"}
        </Link>
        <Link href={href} className="btn btn-secondary w-full">
          {item.kind === "employee" ? <UserRound className="h-4 w-4" aria-hidden /> : <Building2 className="h-4 w-4" aria-hidden />}
          {item.kind === "employee" ? "View employee" : "View supplier"}
        </Link>
      </div>
    </div>
  );
}

function DetailRow({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
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
