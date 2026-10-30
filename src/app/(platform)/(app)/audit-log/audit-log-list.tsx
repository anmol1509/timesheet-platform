"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowRight, ChevronDown, ExternalLink, Layers, Undo2, X } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { Pagination } from "@/components/Pagination";
import { Button } from "@/components/ui/Button";
import { DatePicker } from "@/components/ui/DatePicker";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/Dialog";
import { Select } from "@/components/ui/Select";
import { useToastActions } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { auditVerb, entityMeta } from "@/lib/auditPresentation";
import { auditFields, auditSentence } from "@/lib/auditSentence";
import { auditQueryString, type AuditQuery } from "@/lib/auditQuery";
import { previewRevertAction, revertAuditEntryAction, type RevertPreview } from "./actions";

type Entry = {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  changes: Record<string, unknown> | null;
  userName: string;
  name: string | null;
  createdAt: string;
  source: string | null;
  batchId: string | null;
  batchLabel: string | null;
  revertOfId: string | null;
  revertedAt: string | null;
  revertedByName: string | null;
};

const ACTION_TONE: Record<string, string> = {
  CREATE: "bg-[var(--success-soft)] text-[var(--success)]",
  UPDATE: "bg-[var(--info-soft)] text-[var(--info)]",
  DELETE: "bg-[var(--error-soft)] text-[var(--error)]",
};
const SOURCE_BADGE: Record<string, string> = { REVERT: "Put back", IMPORT: "Import", API: "API", SYSTEM: "System" };

const uaeDay = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
const dayLabel = (iso: string, todayKey: string, yesterdayKey: string) => {
  const k = uaeDay(new Date(iso));
  if (k === todayKey) return "Today";
  if (k === yesterdayKey) return "Yesterday";
  return new Date(iso).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Dubai" });
};
const time = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Dubai" });

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

/** Confirms an edit is being put back: shows what each field is now and what it will become, and which ones stay. */
function RevertDialog({ entry, onClose }: { entry: Entry | null; onClose: () => void }) {
  const router = useRouter();
  const toast = useToastActions();
  const [preview, setPreview] = useState<RevertPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  useEffect(() => {
    setPreview(null); setError(null); setDone(false);
    if (!entry) return;
    let live = true;
    previewRevertAction(entry.id).then((r) => { if (live) setPreview(r); }).catch(() => { if (live) setPreview({ error: "Couldn't check this entry. Try again." }); });
    return () => { live = false; };
  }, [entry]);

  const fields = preview && "fields" in preview ? preview.fields : [];
  const canGo = !!preview && "fields" in preview && !preview.problem && fields.some((f) => f.status === "ok");

  function go() {
    if (!entry) return;
    setError(null);
    startTransition(async () => {
      const r = await revertAuditEntryAction(entry.id);
      if (!r.ok) { setError(r.error); return; }
      setDone(true);
      toast.success(r.restored === 1 ? "Put back" : `${r.restored} fields put back`, r.skipped ? `${r.skipped} could not go back and were left as they are.` : "A new entry in the log records this.");
      setTimeout(() => { onClose(); router.refresh(); }, 900);
    });
  }

  return (
    <Dialog open={!!entry} onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent title="Put this change back?" description={entry ? `${entry.userName} ${auditSentence(entry, entry.name, { canSeePay: true })}` : undefined} className="max-w-xl">
        {!preview && <p className="mt-4 text-sm text-muted">Checking what the record holds now…</p>}
        {preview && "error" in preview && <p role="alert" className="mt-4 text-sm text-[var(--error)]">{preview.error}</p>}
        {preview && "fields" in preview && (
          <div className="mt-4 space-y-3">
            <div className="overflow-x-auto rounded-lg border border-default">
              <table className="w-full text-sm">
                <thead className="bg-surface-subtle text-left text-xs text-muted"><tr><th className="px-3 py-2 font-medium">Field</th><th className="px-3 py-2 font-medium">Now</th><th className="px-3 py-2 font-medium">Goes back to</th></tr></thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {fields.map((f) => (
                    <tr key={f.key} className={cn(f.status !== "ok" && "text-muted")}>
                      <td className="px-3 py-2">{f.label.charAt(0).toUpperCase() + f.label.slice(1)}</td>
                      <td className="px-3 py-2">{f.now}</td>
                      <td className="px-3 py-2">{f.status === "ok" ? <span className="font-medium text-primary">{f.back}</span> : <span className="text-xs">Stays as it is. {f.reason}</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {preview.problem && <p role="alert" className="text-sm text-[var(--warning)]">{preview.problem}</p>}
            {!preview.problem && <p className="text-xs text-subtle">Only fields that still hold what this change wrote are put back, so nobody else&rsquo;s later edit is overwritten. This is recorded in the log.</p>}
          </div>
        )}
        {error && <p role="alert" className="mt-3 text-sm text-[var(--error)]">{error}</p>}
        <DialogFooter>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={pending}>Cancel</button>
          <Button onClick={go} disabled={!canGo} loading={pending} success={done} successLabel="Put back"><Undo2 className="h-4 w-4" aria-hidden />Put it back</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type Item = { kind: "one"; e: Entry } | { kind: "batch"; id: string; label: string; user: string; items: Entry[] };

/** Entries written by one bulk action sit next to each other; they read as one line that opens into the individual ones. */
function group(entries: Entry[]): Item[] {
  const out: Item[] = [];
  for (const e of entries) {
    const last = out[out.length - 1];
    if (e.batchId && last?.kind === "batch" && last.id === e.batchId) { last.items.push(e); continue; }
    if (e.batchId && last?.kind === "one" && last.e.batchId === e.batchId) { out[out.length - 1] = { kind: "batch", id: e.batchId, label: e.batchLabel ?? "Bulk action", user: e.userName, items: [last.e, e] }; continue; }
    out.push({ kind: "one", e });
  }
  return out;
}

export function AuditLogList({
  entries, canSeePay, canRevert, revertTypes, query, page, pageSize, total, filtered, users, modules,
}: {
  entries: Entry[]; canSeePay: boolean; canRevert: boolean; revertTypes: string[]; query: AuditQuery; page: number; pageSize: number; total: number; filtered: boolean;
  users: { id: string; name: string }[]; modules: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState<string | null>(null);
  const [reverting, setReverting] = useState<Entry | null>(null);
  const [text, setText] = useState(query.q ?? "");

  function go(patch: Partial<Record<keyof AuditQuery, string | undefined>>, toPage = 1) {
    const qs = new URLSearchParams(auditQueryString({ ...query, ...patch } as AuditQuery));
    for (const [k, v] of Object.entries(patch)) if (!v) qs.delete(k);
    if (toPage > 1) qs.set("page", String(toPage));
    router.replace(qs.size ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  // Search as you type, but not on every key.
  useEffect(() => {
    if ((query.q ?? "") === text.trim()) return;
    const t = setTimeout(() => go({ q: text.trim() || undefined }), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);
  useEffect(() => { setText(query.q ?? ""); }, [query.q]);

  const todayKey = uaeDay(new Date());
  const yesterdayKey = uaeDay(new Date(Date.now() - 86_400_000));
  const days = useMemo(() => {
    const g = new Map<string, Item[]>();
    const items = group(entries);
    for (const it of items) {
      const iso = it.kind === "one" ? it.e.createdAt : it.items[0].createdAt;
      const label = dayLabel(iso, todayKey, yesterdayKey);
      g.set(label, [...(g.get(label) ?? []), it]);
    }
    return g;
  }, [entries, todayKey, yesterdayKey]);

  const quick = (daysBack: number | "all") => {
    if (daysBack === "all") return go({ from: undefined, to: undefined });
    const from = uaeDay(new Date(Date.now() - daysBack * 86_400_000));
    go({ from, to: undefined });
  };
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const one = query.entityType && query.entityId;

  function EntryRow({ e, nested = false }: { e: Entry; nested?: boolean }) {
    const meta = entityMeta(e.entityType);
    const isOpen = open === e.id;
    const href = meta.href?.(e.entityId);
    const canPutBack = canRevert && e.action === "UPDATE" && !e.revertedAt && e.source !== "REVERT" && revertTypes.includes(e.entityType);
    return (
      <li>
        <button type="button" onClick={() => setOpen(isOpen ? null : e.id)} aria-expanded={isOpen} className={cn("flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-surface-hover", nested && "pl-14")}>
          {!nested && <Avatar name={e.userName} url={null} className="h-8 w-8 shrink-0 text-xs" />}
          <span className="min-w-0 flex-1">
            <span className="block text-sm text-primary"><span className="font-medium">{e.userName}</span> {auditSentence(e, e.name, { canSeePay })}</span>
            <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
              <span className="truncate">{meta.module} · {meta.label}</span>
              {e.source && SOURCE_BADGE[e.source] && <span className="rounded-full bg-surface-sunken px-1.5 py-px text-[10.5px] font-medium text-secondary">{SOURCE_BADGE[e.source]}</span>}
              {e.revertedAt && <span className="rounded-full bg-[var(--warning-soft)] px-1.5 py-px text-[10.5px] font-medium text-[var(--warning)]">Put back by {e.revertedByName ?? "someone"}</span>}
            </span>
          </span>
          <span className={cn("hidden rounded-full px-2 py-0.5 text-xs font-medium sm:inline", ACTION_TONE[e.action] ?? ACTION_TONE.UPDATE)}>{auditVerb(e.action)}</span>
          <time className="tabular w-14 shrink-0 text-right text-xs text-muted" dateTime={e.createdAt}>{time(e.createdAt)}</time>
          <ChevronDown className={cn("h-4 w-4 shrink-0 text-subtle transition-transform", isOpen && "rotate-180")} aria-hidden />
        </button>
        {isOpen && (
          <div className={cn("space-y-3 border-t border-default bg-surface-subtle px-4 py-3 pl-[3.75rem]", nested && "pl-[4.5rem]")}>
            <Diff entry={e} canSeePay={canSeePay} />
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted">
              <span>{new Date(e.createdAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "medium", timeZone: "Asia/Dubai" })} (UAE time)</span>
              {href && e.action !== "DELETE" && <Link href={href} className="inline-flex items-center gap-1 text-[var(--brand-primary)] hover:underline"><ExternalLink className="h-3 w-3" aria-hidden />Open {meta.label.toLowerCase()}</Link>}
              {e.action !== "VIEW" && !one && <button type="button" onClick={() => go({ entityType: e.entityType, entityId: e.entityId })} className="text-[var(--brand-primary)] hover:underline">History of this record</button>}
              {e.revertedAt && <span>Put back by {e.revertedByName} on {new Date(e.revertedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Dubai" })}</span>}
              {canPutBack && <button type="button" onClick={() => setReverting(e)} className="btn btn-secondary btn-sm ml-auto gap-1.5"><Undo2 className="h-3.5 w-3.5" aria-hidden />Put this change back</button>}
            </div>
          </div>
        )}
      </li>
    );
  }

  return (
    <div className="space-y-4">
      {one && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--brand-primary-border)] bg-brand-soft px-3 py-2 text-sm">
          <span className="font-medium text-primary">History of one {entityMeta(query.entityType!).label.toLowerCase()}</span>
          <button type="button" onClick={() => go({ entityType: undefined, entityId: undefined })} className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-[var(--brand-primary)] hover:underline"><X className="h-3 w-3" aria-hidden />Show everything</button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Search a person, record or value…" aria-label="Search" className="input w-full max-w-xs" />
        <div className="w-44"><Select value={query.user ?? ""} onChange={(v) => go({ user: v || undefined })} options={[{ value: "", label: "Everyone" }, ...users.map((u) => ({ value: u.id, label: u.name }))]} /></div>
        <div className="w-44"><Select value={query.action ?? ""} onChange={(v) => go({ action: v || undefined })} searchable={false} options={[{ value: "", label: "Any action" }, { value: "CREATE", label: "Added" }, { value: "UPDATE", label: "Changed" }, { value: "DELETE", label: "Deleted" }, { value: "VIEW", label: "Opened" }]} /></div>
        <div className="w-44"><Select value={query.source ?? ""} onChange={(v) => go({ source: v || undefined })} searchable={false} options={[{ value: "", label: "Any source" }, { value: "SCREEN", label: "Screen" }, { value: "REVERT", label: "Put back" }, { value: "IMPORT", label: "Import" }, { value: "API", label: "API" }, { value: "SYSTEM", label: "System" }]} /></div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <DatePicker value={query.from ?? ""} onChange={(v) => go({ from: v || undefined })} className="w-36" ariaLabel="From date" />
          <span className="text-xs text-muted">to</span>
          <DatePicker value={query.to ?? ""} onChange={(v) => go({ to: v || undefined })} className="w-36" ariaLabel="To date" />
          <div className="inline-flex rounded-lg bg-surface-sunken p-0.5" role="group" aria-label="Quick range">
            {([["Today", 0], ["7 days", 7], ["30 days", 30], ["All", "all"]] as const).map(([label, d]) => (
              <button key={label} type="button" onClick={() => quick(d)} className="min-h-8 rounded-md px-2.5 py-1 text-sm text-muted transition hover:bg-surface hover:text-primary">{label}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Area">
        {["", ...modules].map((m) => (
          <button key={m || "all"} type="button" onClick={() => go({ module: m || undefined })} aria-pressed={(query.module ?? "") === m}
            className={cn("rounded-full border px-3 py-1 text-sm transition", (query.module ?? "") === m ? "border-[var(--brand-primary)] bg-brand-soft font-medium text-[var(--brand-primary)]" : "border-default text-secondary hover:bg-surface-hover")}>
            {m === "" ? "All areas" : m}
          </button>
        ))}
        {filtered && <button type="button" onClick={() => router.replace(pathname, { scroll: false })} className="ml-1 inline-flex items-center gap-1 text-xs font-medium text-[var(--brand-primary)] hover:underline"><X className="h-3 w-3" aria-hidden />Clear filters</button>}
        <span className="tabular ml-auto text-xs text-muted">{total.toLocaleString("en-GB")} {total === 1 ? "entry" : "entries"}</span>
      </div>

      {entries.length === 0 ? (
        <div className="card px-4 py-12 text-center text-sm text-muted">{filtered ? "Nothing matches those filters." : "No audit entries yet."}</div>
      ) : (
        <div className="space-y-5">
          {[...days.entries()].map(([label, list]) => (
            <section key={label} aria-label={label}>
              <h2 className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">{label}</h2>
              <ul className="card divide-y divide-[var(--border)] overflow-hidden">
                {list.map((it) =>
                  it.kind === "one" ? (
                    <EntryRow key={it.e.id} e={it.e} />
                  ) : (
                    <li key={it.id}>
                      <button type="button" onClick={() => setOpen(open === `b:${it.id}` ? null : `b:${it.id}`)} aria-expanded={open === `b:${it.id}`} className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-surface-hover">
                        <Avatar name={it.user} url={null} className="h-8 w-8 shrink-0 text-xs" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm text-primary"><span className="font-medium">{it.user}</span> {it.label}</span>
                          <span className="flex items-center gap-1.5 text-xs text-muted"><Layers className="h-3 w-3" aria-hidden />{it.items.length} entries in one action</span>
                        </span>
                        <time className="tabular w-14 shrink-0 text-right text-xs text-muted" dateTime={it.items[0].createdAt}>{time(it.items[0].createdAt)}</time>
                        <ChevronDown className={cn("h-4 w-4 shrink-0 text-subtle transition-transform", open === `b:${it.id}` && "rotate-180")} aria-hidden />
                      </button>
                      {open === `b:${it.id}` && <ul className="divide-y divide-[var(--border)] border-t border-default bg-surface-subtle">{it.items.map((e) => <EntryRow key={e.id} e={e} nested />)}</ul>}
                    </li>
                  )
                )}
              </ul>
            </section>
          ))}
          <Pagination page={Math.min(page, pageCount)} pageCount={pageCount} onPageChange={(p) => go({}, p)} totalItems={total} pageSize={pageSize} />
        </div>
      )}

      <RevertDialog entry={reverting} onClose={() => setReverting(null)} />
    </div>
  );
}
