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
    <div className="card grid grid-cols-2 divide-border lg:grid-cols-4 lg:divide-x">
      {cells.map((c, i) => {
        const inner = (
          <>
            <p className="text-[12.5px] text-muted">{c.label}</p>
            <p className={cn("tabular mt-0.5 truncate text-2xl font-semibold tracking-tight", TONE[c.tone ?? "default"])}>{c.value}</p>
            {c.sub && <p className="text-xs text-subtle">{c.sub}</p>}
          </>
        );
        const cls = cn("px-5 py-3.5", i >= 2 && "border-t border-border lg:border-t-0", i % 2 === 1 && "border-l border-border lg:border-l-0");
        return c.href ? <Link key={c.label} href={c.href} className={cn(cls, "hover:bg-surface-hover")}>{inner}</Link> : <div key={c.label} className={cls}>{inner}</div>;
      })}
    </div>
  );
}
