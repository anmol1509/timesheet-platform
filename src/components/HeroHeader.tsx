import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

export type HeroPill = { label: string; value: string; /** Amber: something here needs attention. */ warn?: boolean };

/**
 * The banner a working page leads with: what this is, one line on its state, and a few figures as pills, with the
 * page's main actions on the right. Used by Approvals and Letters so the pages that are about doing something
 * share one look.
 */
export function HeroHeader({ icon: Icon, title, subtitle, pills = [], actions, className, eyebrow, aside, children }: { icon: LucideIcon; title: string; subtitle: React.ReactNode; pills?: HeroPill[]; actions?: React.ReactNode; className?: string; /** Small label above the title. */ eyebrow?: string; /** Decoration on the right, hidden on small screens. */ aside?: React.ReactNode; /** Extra content under the subtitle, e.g. a row of reassurances. */ children?: React.ReactNode }) {
  return (
    <header className={cn("relative overflow-hidden rounded-[var(--radius-overlay,20px)] px-5 py-5 text-white sm:px-7 sm:py-6", className)} style={{ background: "linear-gradient(135deg,#43359f 0%,#5b49d8 55%,#7a4fe3 100%)" }}>
      <span aria-hidden className="pointer-events-none absolute -top-16 -right-10 h-64 w-64 rounded-full bg-white/[0.07]" />
      <span aria-hidden className="pointer-events-none absolute -bottom-24 right-32 h-52 w-52 rounded-full bg-white/5" />
      <div className="relative flex flex-wrap items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15"><Icon className="h-5 w-5" aria-hidden /></span>
        <div className="min-w-0 flex-1">
          {eyebrow && <p className="text-[11px] font-semibold tracking-[0.14em] text-white/70 uppercase">{eyebrow}</p>}
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          <p className="text-sm text-white/80">{subtitle}</p>
          {children && <div className="mt-3">{children}</div>}
        </div>
        {aside && <div aria-hidden className="hidden shrink-0 lg:block">{aside}</div>}
        {actions && <div className="flex w-full flex-wrap gap-2 sm:w-auto">{actions}</div>}
      </div>
      {pills.length > 0 && (
        <dl className="relative mt-4 flex flex-wrap gap-2">
          {pills.map((c) => (
            <div key={c.label} className={cn("flex items-baseline gap-2 rounded-full border px-3 py-1", c.warn ? "border-amber-200/60 bg-amber-300/25" : "border-white/20 bg-white/10")}>
              <dt className="text-xs text-white/75">{c.label}</dt>
              <dd className="tabular text-sm font-semibold">{c.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </header>
  );
}

/** A button for use inside the banner: `solid` is the main one, the rest sit quietly on the gradient. */
export const heroButton = (solid?: boolean) =>
  cn("inline-flex h-9 items-center gap-1.5 rounded-[11px] px-3.5 text-sm font-semibold transition", solid ? "bg-white text-[#43359f] hover:bg-white/90" : "border border-white/25 bg-white/15 text-white hover:bg-white/25");
