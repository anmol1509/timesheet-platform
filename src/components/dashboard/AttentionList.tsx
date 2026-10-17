import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/Badge";
import { cn } from "@/lib/cn";

export type AttentionItem = {
  key: string;
  tone: "red" | "amber" | "blue";
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  sub: string;
  href: string;
  action: string;
  tag?: string;
};

const TONE = {
  red: "bg-[var(--error-soft)] text-[var(--error)]",
  amber: "bg-[var(--warning-soft)] text-[var(--warning)]",
  blue: "bg-[var(--info-soft)] text-[var(--info)]",
} as const;

export function AttentionRow({ item }: { item: AttentionItem }) {
  const Icon = item.icon;
  return (
    <li className="flex items-center gap-3 px-5 py-3">
      <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", TONE[item.tone])}>
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-primary">{item.title}</span>
          {item.tag && <Badge color={item.tone === "red" ? "red" : "amber"}>{item.tag}</Badge>}
        </span>
        <span className="block truncate text-xs text-muted">{item.sub}</span>
      </span>
      <Link href={item.href} className="btn btn-secondary btn-sm shrink-0">{item.action}</Link>
    </li>
  );
}

/**
 * A short, ranked "what needs doing" list: the first few rows, the rest behind
 * a "Show more". Items arrive already sorted, most urgent first. With nothing
 * to do it says so in one line instead of taking up a card.
 */
export function AttentionPanel({ items, title = "Needs attention", max = 5, emptyLabel }: { items: AttentionItem[]; title?: string; max?: number; emptyLabel?: string }) {
  if (items.length === 0) {
    if (!emptyLabel) return null;
    return (
      <div className="flex items-center gap-2 rounded-card border border-default bg-surface px-5 py-3 text-sm text-secondary shadow-xs">
        <CheckCircle2 className="h-4 w-4 text-[var(--success)]" aria-hidden />
        {emptyLabel}
      </div>
    );
  }
  const shown = items.slice(0, max);
  const rest = items.slice(max);
  return (
    <section className="card overflow-hidden">
      <div className="card-header">
        <h2 className="text-[15px] font-semibold tracking-tight text-primary">{title}</h2>
        <span className="text-xs text-muted">{items.length} item{items.length === 1 ? "" : "s"} · most urgent first</span>
      </div>
      <ul className="divide-y divide-[var(--border)]">{shown.map((i) => <AttentionRow key={i.key} item={i} />)}</ul>
      {rest.length > 0 && (
        <details className="group border-t border-default">
          <summary className="cursor-pointer px-5 py-3 text-sm font-medium text-[var(--brand-primary)] hover:underline group-open:hidden">Show {rest.length} more</summary>
          <ul className="divide-y divide-[var(--border)]">{rest.map((i) => <AttentionRow key={i.key} item={i} />)}</ul>
        </details>
      )}
    </section>
  );
}
