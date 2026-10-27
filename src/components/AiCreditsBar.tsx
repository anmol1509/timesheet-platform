"use client";

import Link from "next/link";
import { useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Plus, Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";
import type { CreditStatus } from "@/lib/aiCredits";
import { TopUpDialog } from "@/components/TopUpDialog";

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");
const daysTo = (d: Date) => Math.max(0, Math.ceil((new Date(d).getTime() - Date.now()) / 86_400_000));
const reset = (d: Date) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Asia/Dubai" });

/**
 * The AI credits left this month, in the header. Administrators see the number and a bar; clicking it opens a short summary
 * with "Top up credits" and a link to the full page. Everyone else only sees a note when AI has been paused because the credits are used up.
 */
export function AiCreditsBar({ status, isAdmin }: { status: CreditStatus; isAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  const [topUp, setTopUp] = useState(false);
  const [top, setTop] = useState<{ label: string; credits: number }[] | null>(null);

  if (!isAdmin) {
    if (status.level !== "out") return null;
    return (
      <span className="hidden items-center gap-1.5 rounded-full border border-[var(--error-border)] bg-[var(--error-soft)] px-2.5 py-1 text-xs font-medium text-[var(--error)] sm:inline-flex" title="This month's AI credits are used up. AI is paused until they reset; everything can still be done by hand.">
        <Sparkles className="h-3.5 w-3.5" aria-hidden /> AI paused
      </span>
    );
  }

  const out = status.level === "out";
  const warn = status.level === "warn";
  const tone = out ? "bg-[var(--error)]" : warn ? "bg-[var(--warning)]" : "bg-[var(--brand-primary)]";
  const ink = out ? "text-[var(--error)]" : warn ? "text-[var(--warning)]" : "text-[var(--brand-primary)]";
  const label = out ? "AI paused" : `${fmt(status.remaining)} credits`;

  const onOpen = (next: boolean) => {
    setOpen(next);
    if (next && top === null) {
      fetch("/api/ai-credits/summary", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : { top: [] }))
        .then((j) => setTop(Array.isArray(j.top) ? j.top : []))
        .catch(() => setTop([]));
    }
  };

  return (
    <>
      <Popover.Root open={open} onOpenChange={onOpen}>
        <Popover.Trigger asChild>
          <button type="button" aria-label={`${fmt(status.remaining)} AI credits left this month. Open details`} className={cn("hidden items-center gap-2 rounded-full border bg-surface px-3 py-1 text-xs font-semibold text-secondary transition hover:text-primary sm:inline-flex", open ? "border-[var(--brand-primary)] shadow-[0_0_0_3px_var(--brand-primary-soft)]" : "border-default")}>
            <Sparkles className={cn("h-3.5 w-3.5", ink)} aria-hidden />
            <span className="tabular whitespace-nowrap">{label}</span>
            <span className="h-1.5 w-14 overflow-hidden rounded-full bg-surface-sunken" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={status.pct} aria-label="AI credits used this month">
              <span className={cn("block h-full rounded-full", tone)} style={{ width: `${Math.max(100 - status.pct, 100 - status.pct > 0 ? 4 : 0)}%` }} />
            </span>
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content align="end" sideOffset={8} className="z-50 w-[22rem] max-w-[calc(100vw-1.5rem)] space-y-3 rounded-2xl border border-default bg-surface p-4 shadow-modal outline-none">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-primary">AI credits</h2>
              <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", out ? "bg-[var(--error-soft)] text-[var(--error)]" : warn ? "bg-[var(--warning-soft)] text-[var(--warning)]" : "bg-[var(--success-soft)] text-[var(--success)]")}>{out ? "Used up" : warn ? "Running low" : "Healthy"}</span>
            </div>
            <div>
              <p className="tabular text-3xl font-bold tracking-tight text-primary">{fmt(status.remaining)} <span className="text-sm font-medium text-muted">left of {fmt(status.total)}</span></p>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-sunken"><div className={cn("h-full rounded-full", tone)} style={{ width: `${Math.max(status.pct, status.pct > 0 ? 2 : 0)}%` }} /></div>
              <p className="mt-2 text-xs text-secondary">{fmt(status.used)} used this month · Resets {reset(status.resetsAt)} (in {daysTo(status.resetsAt)} {daysTo(status.resetsAt) === 1 ? "day" : "days"})</p>
            </div>
            <div className="border-t border-default pt-3">
              <p className="mb-1 text-xs text-muted">Used most by</p>
              {top === null ? <p className="py-1 text-xs text-muted">Loading…</p> : top.length === 0 ? <p className="py-1 text-xs text-muted">Nothing used yet this month.</p> : (
                <ul className="space-y-1 text-sm">{top.map((t) => <li key={t.label} className="flex justify-between gap-3"><span className="truncate text-secondary">{t.label}</span><span className="tabular font-semibold text-primary">{fmt(t.credits)}</span></li>)}</ul>
              )}
            </div>
            <div className="flex gap-2 border-t border-default pt-3">
              <button type="button" className="btn btn-primary btn-sm flex-1 justify-center" onClick={() => { setOpen(false); setTopUp(true); }}><Plus className="h-3.5 w-3.5" aria-hidden /> Top up credits</button>
              <Link href="/settings/ai" className="btn btn-secondary btn-sm" onClick={() => setOpen(false)}>See full usage</Link>
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      <TopUpDialog open={topUp} onOpenChange={setTopUp} total={status.total} />
    </>
  );
}
