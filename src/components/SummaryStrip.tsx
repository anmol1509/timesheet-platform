import Link from "next/link";
import { cn } from "@/lib/cn";

export type SummaryCell = { label: string; value: string; sub?: string; tone?: "default" | "warning" | "danger"; href?: string };

const TONE = { default: "text-primary", warning: "text-[var(--warning)]", danger: "text-[var(--error)]" } as const;

/**
 * Four figures in one card, divided, so a list page can lead with the list. Use KpiStrip when each figure
 * deserves its own destination card; use this when they are just the context for the table below.
 */
export function SummaryStrip({ cells }: { cells: SummaryCell[] }) {
  return (
    <div className="card grid grid-cols-2 divide-default lg:grid-cols-4 lg:divide-x">
      {cells.map((c, i) => {
        const inner = (
          <>
            <p className="text-[12.5px] text-muted">{c.label}</p>
            <p className={cn("tabular mt-0.5 text-xl font-semibold tracking-tight sm:text-2xl lg:truncate", TONE[c.tone ?? "default"])}>{c.value}</p>
            {c.sub && <p className="text-xs text-subtle">{c.sub}</p>}
          </>
        );
        const cls = cn("min-w-0 px-4 py-3.5 sm:px-5", i >= 2 && "border-t border-default lg:border-t-0", i % 2 === 1 && "border-l border-default lg:border-l-0");
        return c.href ? <Link key={c.label} href={c.href} className={cn(cls, "hover:bg-surface-hover")}>{inner}</Link> : <div key={c.label} className={cls}>{inner}</div>;
      })}
    </div>
  );
}
