"use client";

import { useState } from "react";
import { Check, ChevronRight } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { cn } from "@/lib/cn";

export type StatusItem = {
  key: string;
  /** What the chip says, with its count: "24 need bank details". */
  label: string;
  tone: "danger" | "warn" | "info";
  /** The panel behind the chip. */
  title: string;
  description?: string;
  content: React.ReactNode;
};

const TONE: Record<StatusItem["tone"], string> = {
  danger: "border-[var(--error-border)] bg-[var(--error-soft)] text-[var(--error)]",
  warn: "border-[var(--warning-border)] bg-[var(--warning-soft)] text-[var(--warning)]",
  info: "border-[var(--info-border)] bg-[var(--info-soft)] text-[var(--info)]",
};

/**
 * Everything on a page that needs attention, as one row of counted chips instead of a banner per topic. A chip opens its
 * details in a side panel, so the page goes straight to the work. Optional progress steps and a one-line summary sit on
 * the left (payroll uses both). With nothing to show it says so, or renders nothing when `hideWhenClear` is set.
 */
export function StatusRow({
  items,
  steps,
  lead,
  leadTone = "go",
  clearText = "Nothing needs attention",
  hideWhenClear = false,
  label = "Needs attention",
}: {
  items: StatusItem[];
  steps?: { labels: string[]; current: number };
  lead?: string;
  leadTone?: "go" | "stop" | "wait" | "done";
  clearText?: string;
  hideWhenClear?: boolean;
  label?: string;
}) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const open = items.find((i) => i.key === openKey) ?? null;
  if (items.length === 0 && hideWhenClear && !steps && !lead) return null;
  return (
    <section className="card space-y-3 p-4" aria-label={label}>
      {(steps || lead) && (
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          {steps && (
            <ol className="flex items-center gap-1 text-xs" aria-label="Progress">
              {steps.labels.map((s, i) => {
                const done = i < steps.current;
                const active = i === steps.current;
                return (
                  <li key={s} className="flex items-center gap-1" aria-current={active ? "step" : undefined}>
                    <span className={cn("flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold", done ? "bg-[var(--success-soft)] text-[var(--success)]" : active ? "bg-[var(--brand-primary)] text-white" : "bg-surface-sunken text-muted")}>
                      {done ? <Check className="h-3 w-3" aria-hidden /> : i + 1}
                    </span>
                    <span className={cn("font-medium", done || active ? "text-primary" : "text-muted")}>{s}</span>
                    {i < steps.labels.length - 1 && <ChevronRight className="mx-0.5 h-3 w-3 text-subtle" aria-hidden />}
                  </li>
                );
              })}
            </ol>
          )}
          {lead && <p className={cn("text-sm font-medium", leadTone === "stop" ? "text-[var(--warning)]" : leadTone === "done" ? "text-[var(--success)]" : "text-primary")} role="status">{lead}</p>}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {items.length === 0 ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--success-border)] bg-[var(--success-soft)] px-3 py-1 text-xs font-semibold text-[var(--success)]"><Check className="h-3.5 w-3.5" aria-hidden /> {clearText}</span>
        ) : (
          items.map((i) => (
            <button key={i.key} type="button" onClick={() => setOpenKey(i.key)} className={cn("inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold transition hover:brightness-[0.97]", TONE[i.tone])}>
              {i.label}
              <ChevronRight className="h-3 w-3" aria-hidden />
            </button>
          ))
        )}
      </div>
      <Sheet open={!!open} onOpenChange={(v) => !v && setOpenKey(null)} title={open?.title ?? ""} description={open?.description}>
        {open?.content}
      </Sheet>
    </section>
  );
}
