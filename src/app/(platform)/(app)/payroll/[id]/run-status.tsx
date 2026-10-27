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

const STEPS = ["Review", "Submit", "Approve", "Pay"];

/**
 * Everything about the run that needs attention, as one row: where the run is, what to do now, and a chip for each thing
 * to look at (bank details, checks, last month, advances…). A chip opens its details in a side panel, so the page goes
 * straight from the figures to the workers instead of stacking a banner per topic above them.
 */
export function RunStatus({ step, lead, leadTone, items }: { step: 0 | 1 | 2 | 3 | 4; lead: string; leadTone: "go" | "stop" | "wait" | "done"; items: StatusItem[] }) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const open = items.find((i) => i.key === openKey) ?? null;
  return (
    <section className="card space-y-3 p-4" aria-label="Where this run stands">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <ol className="flex items-center gap-1 text-xs" aria-label="Payroll run progress">
          {STEPS.map((s, i) => {
            const done = i < step;
            const active = i === step;
            return (
              <li key={s} className="flex items-center gap-1" aria-current={active ? "step" : undefined}>
                <span className={cn("flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold", done ? "bg-[var(--success-soft)] text-[var(--success)]" : active ? "bg-[var(--brand-primary)] text-white" : "bg-surface-sunken text-muted")}>
                  {done ? <Check className="h-3 w-3" aria-hidden /> : i + 1}
                </span>
                <span className={cn("font-medium", done || active ? "text-primary" : "text-muted")}>{s}</span>
                {i < STEPS.length - 1 && <ChevronRight className="mx-0.5 h-3 w-3 text-subtle" aria-hidden />}
              </li>
            );
          })}
        </ol>
        <p className={cn("text-sm font-medium", leadTone === "stop" ? "text-[var(--warning)]" : leadTone === "done" ? "text-[var(--success)]" : "text-primary")} role="status">{lead}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {items.length === 0 ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--success-border)] bg-[var(--success-soft)] px-3 py-1 text-xs font-semibold text-[var(--success)]"><Check className="h-3.5 w-3.5" aria-hidden /> Nothing needs attention</span>
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
