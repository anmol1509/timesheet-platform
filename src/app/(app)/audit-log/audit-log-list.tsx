"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, ChevronDown, ExternalLink } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { Pagination } from "@/components/Pagination";
import { cn } from "@/lib/cn";
import { AUDIT_MODULES, auditVerb, entityMeta } from "@/lib/auditPresentation";
import { auditFields, auditSentence } from "@/lib/auditSentence";
import { Select } from "@/components/ui/Select";

const PAGE_SIZE = 30;

type Entry = {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  changes: Record<string, unknown> | null;
  userName: string;
  name: string | null;
  createdAt: string;
};

const ACTION_TONE: Record<string, string> = {
  CREATE: "bg-[var(--success-soft)] text-[var(--success)]",
  UPDATE: "bg-[var(--info-soft)] text-[var(--info)]",
  DELETE: "bg-[var(--error-soft)] text-[var(--error)]",
};

const RANGES = [
  { key: "today", label: "Today", days: 0 },
  { key: "7", label: "7 days", days: 7 },
  { key: "30", label: "30 days", days: 30 },
  { key: "all", label: "All", days: -1 },
] as const;

function dayLabel(d: Date, todayKey: string, yesterdayKey: string) {
  const k = d.toDateString();
  if (k === todayKey) return "Today";
  if (k === yesterdayKey) return "Yesterday";
  return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
}

function Diff({ entry, canSeePay }: { entry: Entry; canSeePay: boolean }) {
  const { shown, hiddenPay } = auditFields(entry, { canSeePay });
  if (shown.length === 0) return <p className="text-xs text-muted">{hiddenPay > 0 ? "The details of this change are pay figures, which you need payroll access to see." : "No field details were recorded for this change."}</p>;
  return (
    <div className="space-y-1.5">
      <dl className="grid gap-x-4 gap-y-1.5 text-xs sm:grid-cols-[minmax(8rem,12rem)_1fr]">
        {shown.map((f) => (
          <div key={f.key} className="contents">
            <dt className="text-muted">{f.label.charAt(0).toUpperCase() + f.label.slice(1)}</dt>
            <dd className="min-w-0 break-words">
              {f.from !== null ? (
                <span className="inline-flex flex-wrap items-center gap-1.5">
                  <span className="rounded bg-[var(--error-soft)] px-1.5 py-0.5 text-[var(--error)] line-through decoration-[var(--error)]/40">{f.from}</span>
                  <ArrowRight className="h-3 w-3 text-subtle" aria-hidden />
                  <span className="rounded bg-[var(--success-soft)] px-1.5 py-0.5 font-medium text-[var(--success)]">{f.to}</span>
                </span>
              ) : (
                <span className="text-primary">{f.to}</span>
              )}
            </dd>
          </div>
        ))}
      </dl>
      {hiddenPay > 0 && <p className="text-xs text-subtle">{hiddenPay} pay figure{hiddenPay === 1 ? "" : "s"} not shown (needs payroll access).</p>}
    </div>
  );
}

export function AuditLogList({ entries, now, canSeePay }: { entries: Entry[]; now: string; canSeePay: boolean }) {
  const [query, setQuery] = useState("");
  const [moduleFilter, setModuleFilter] = useState("all");
  const [user, setUser] = useState("all");
  const [action, setAction] = useState("all");
  const [range, setRange] = useState<(typeof RANGES)[number]["key"]>("all");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(null);

  const users = useMemo(() => [...new Set(entries.map((e) => e.userName))].sort(), [entries]);
  const nowDate = useMemo(() => new Date(now), [now]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const r = RANGES.find((x) => x.key === range)!;
    const start = new Date(nowDate);
    start.setHours(0, 0, 0, 0);
    if (r.days > 0) start.setDate(start.getDate() - r.days);
    return entries.filter((e) => {
      const meta = entityMeta(e.entityType);
      if (moduleFilter !== "all" && meta.module !== moduleFilter) return false;
      if (user !== "all" && e.userName !== user) return false;
      if (action !== "all" && e.action !== action) return false;
      if (r.days >= 0 && new Date(e.createdAt) < start) return false;
      if (q && !`${e.userName} ${auditSentence(e, e.name, { canSeePay })} ${meta.label} ${e.entityId}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [entries, moduleFilter, user, action, range, query, nowDate, canSeePay]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const todayKey = nowDate.toDateString();
  const yesterday = new Date(nowDate);
  yesterday.setDate(yesterday.getDate() - 1);
  const groups = new Map<string, Entry[]>();
  for (const e of rows) {
    const label = dayLabel(new Date(e.createdAt), todayKey, yesterday.toDateString());
    groups.set(label, [...(groups.get(label) ?? []), e]);
  }

  const reset = () => setPage(1);
  const modules = AUDIT_MODULES.filter((m) => entries.some((e) => entityMeta(e.entityType).module === m));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input value={query} onChange={(e) => { setQuery(e.target.value); reset(); }} placeholder="Search a person, employee, client or field…" aria-label="Search" className="input w-full max-w-xs" />
        <Select value={user} onChange={(v) => { setUser(v); reset(); }} options={[{ value: "all", label: "Everyone" }, ...users.map((u) => ({ value: u, label: u }))]} />
        <Select value={action} onChange={(v) => { setAction(v); reset(); }} searchable={false} options={[{ value: "all", label: "Any action" }, { value: "CREATE", label: "Created" }, { value: "UPDATE", label: "Updated" }, { value: "DELETE", label: "Deleted" }]} />
        <div className="ml-auto inline-flex rounded-lg bg-surface-sunken p-0.5" role="group" aria-label="Time range">
          {RANGES.map((r) => (
            <button key={r.key} type="button" onClick={() => { setRange(r.key); reset(); }} aria-pressed={range === r.key}
              className={cn("min-h-8 rounded-md px-2.5 py-1 text-sm transition", range === r.key ? "bg-surface font-medium text-primary shadow-sm" : "text-muted hover:text-primary")}>{r.label}</button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Module">
        {["all", ...modules].map((m) => (
          <button key={m} type="button" onClick={() => { setModuleFilter(m); reset(); }} aria-pressed={moduleFilter === m}
            className={cn("rounded-full border px-3 py-1 text-sm transition", moduleFilter === m ? "border-[var(--brand-primary)] bg-brand-soft font-medium text-[var(--brand-primary)]" : "border-default text-secondary hover:bg-surface-hover")}>
            {m === "all" ? "All modules" : m}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="card px-4 py-12 text-center text-sm text-muted">Nothing matches those filters.</p>
      ) : (
        <div className="space-y-5">
          {[...groups.entries()].map(([label, list]) => (
            <section key={label} aria-label={label}>
              <h2 className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">{label}<span className="tabular ml-2 font-normal normal-case text-subtle">{list.length} change{list.length === 1 ? "" : "s"}</span></h2>
              <ul className="card divide-y divide-[var(--border)] overflow-hidden">
                {list.map((e) => {
                  const meta = entityMeta(e.entityType);
                  const isOpen = open === e.id;
                  const href = meta.href?.(e.entityId);
                                  return (
                    <li key={e.id}>
                      <button type="button" onClick={() => setOpen(isOpen ? null : e.id)} aria-expanded={isOpen} className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-surface-hover">
                        <Avatar name={e.userName} url={null} className="h-8 w-8 shrink-0 text-xs" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm text-primary">
                            <span className="font-medium">{e.userName}</span> {auditSentence(e, e.name, { canSeePay })}
                          </span>
                          <span className="block truncate text-xs text-muted">{meta.module} · {meta.label}</span>
                        </span>
                        <span className={cn("hidden rounded-full px-2 py-0.5 text-xs font-medium sm:inline", ACTION_TONE[e.action] ?? ACTION_TONE.UPDATE)}>{auditVerb(e.action)}</span>
                        <time className="tabular w-14 shrink-0 text-right text-xs text-muted" dateTime={e.createdAt}>{new Date(e.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</time>
                        <ChevronDown className={cn("h-4 w-4 shrink-0 text-subtle transition-transform", isOpen && "rotate-180")} aria-hidden />
                      </button>
                      {isOpen && (
                        <div className="space-y-3 border-t border-default bg-surface-subtle px-4 py-3 pl-[3.75rem]">
                          <Diff entry={e} canSeePay={canSeePay} />
                          <div className="flex items-center gap-4 text-xs text-muted">
                            <span>{new Date(e.createdAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "medium" })}</span>
                            {href && e.action !== "DELETE" && <Link href={href} className="inline-flex items-center gap-1 text-[var(--brand-primary)] hover:underline"><ExternalLink className="h-3 w-3" aria-hidden />Open record</Link>}
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
          <Pagination page={safePage} pageCount={pageCount} onPageChange={setPage} totalItems={filtered.length} pageSize={PAGE_SIZE} />
        </div>
      )}
    </div>
  );
}
