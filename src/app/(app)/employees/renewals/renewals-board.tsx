"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
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
  const [tier, setTier] = useState<RenewalTier | "all">("all");
  const [query, setQuery] = useState("");
  const [docType, setDocType] = useState("");
  const [kind, setKind] = useState<"" | "employee" | "supplier">("");
  const [selected, setSelected] = useState<RenewalItem | null>(null);

  const docTypes = useMemo(() => [...new Set(items.map((i) => i.document))].sort(), [items]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter(
      (i) =>
        (tier === "all" || i.tier === tier) &&
        (!docType || i.document === docType) &&
        (!kind || i.kind === kind) &&
        (!q ||
          [i.subjectName, i.subjectRef, i.document, i.project, i.supplier]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(q)))
    );
  }, [items, tier, query, docType, kind]);

  const filtersActive = tier !== "all" || !!query || !!docType || !!kind;

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
        <TimelineStrip items={items} onSelect={setSelected} />
      )}

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-default p-3">
          <div className="relative min-w-[12rem] flex-1 sm:max-w-sm">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-subtle" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, ID, project, supplier…"
              aria-label="Search renewals"
              className="input h-9 w-full py-0 pl-9 text-sm"
            />
          </div>
          <div className="w-44">
            <Select
              value={docType}
              onChange={setDocType}
              searchable={false}
              placeholder="All documents"
              options={[{ value: "", label: "All documents" }, ...docTypes.map((d) => ({ value: d, label: d }))]}
            />
          </div>
          <div className="w-40">
            <Select
              value={kind}
              onChange={(v) => setKind(v as typeof kind)}
              searchable={false}
              placeholder="Everyone"
              options={[
                { value: "", label: "Everyone" },
                { value: "employee", label: "Employees" },
                { value: "supplier", label: "Suppliers" },
              ]}
            />
          </div>
          {filtersActive && (
            <button
              type="button"
              onClick={() => {
                setTier("all");
                setQuery("");
                setDocType("");
                setKind("");
              }}
              className="inline-flex items-center gap-1 text-xs font-medium text-[var(--brand-primary)] hover:underline"
            >
              <X className="h-3.5 w-3.5" aria-hidden /> Clear filters
            </button>
          )}
          <span className="tabular ml-auto text-xs text-muted">
            {rows.length} of {items.length}
          </span>
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
                  <th className="px-4"><span className="sr-only">Open</span></th>
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

/**
 * The next 90 days as one strip: each item is a dot placed by its expiry, so
 * clusters (a batch of visas all lapsing the same fortnight) are visible at a
 * glance. Overdue items pile up at the left edge.
 */
function TimelineStrip({ items, onSelect }: { items: RenewalItem[]; onSelect: (i: RenewalItem) => void }) {
  const marks = [0, 7, 30, 60, 90];
  return (
    <section className="card p-4 sm:p-5" aria-label="Expiry timeline">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-primary">Expiry timeline</h2>
        <span className="text-xs text-muted">Today → 90 days</span>
      </div>
      <div className="relative h-14">
        <div className="absolute inset-x-0 top-6 h-1.5 rounded-full bg-gradient-to-r from-[var(--error)] via-[#f59e0b] to-[var(--border-strong)] opacity-30" />
        {marks.map((d) => (
          <div key={d} className="absolute top-0 flex h-full -translate-x-1/2 flex-col items-center" style={{ left: `${(d / 90) * 100}%` }}>
            <span className="h-3.5 w-px bg-[var(--border-strong)]" />
            <span className="mt-auto text-[10.5px] text-subtle">{d === 0 ? "Today" : `${d}d`}</span>
          </div>
        ))}
        {items.map((item, i) => {
          const t = TIER_BY_KEY.get(item.tier)!;
          const left = (Math.max(0, Math.min(90, item.days)) / 90) * 100;
          return (
            <button
              key={`${item.kind}-${item.subjectId}-${item.document}-${i}`}
              type="button"
              onClick={() => onSelect(item)}
              title={`${item.subjectName} — ${item.document} · ${runwayLabel(item.days)}`}
              aria-label={`${item.subjectName}, ${item.document}, ${runwayLabel(item.days)}`}
              className={cn(
                "absolute top-[18px] h-3.5 w-3.5 -translate-x-1/2 rounded-full ring-2 ring-[var(--surface)] transition hover:scale-150",
                t.bar
              )}
              style={{ left: `${left}%`, marginTop: `${(i % 3) * -3}px` }}
            />
          );
        })}
      </div>
    </section>
  );
}
