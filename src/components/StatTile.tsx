import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowUpRight } from "lucide-react";

export function StatTile({
  label,
  value,
  icon: Icon,
  hint,
  tone = "default",
  hero = false,
  href,
}: {
  label: string;
  value: React.ReactNode;
  icon?: LucideIcon;
  hint?: string;
  tone?: "default" | "warning";
  /** Dark gradient hero treatment — reserve for a single standout tile per screen. */
  hero?: boolean;
  /** When set, the whole tile links there — used to jump to the page the number is drawn from. */
  href?: string;
}) {
  if (hero) {
    const content = (
      <>
        <div className="flex items-start justify-between">
          <span className="text-xs font-medium tracking-wide text-blue-100 uppercase">
            {label}
          </span>
          <span className="flex h-7 w-7 items-center justify-center rounded-full border border-white/30">
            <ArrowUpRight className="h-3.5 w-3.5" />
          </span>
        </div>
        <div className="mt-2 text-3xl font-semibold">{value}</div>
        {hint && (
          <p className="mt-3 inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-medium">
            {hint}
          </p>
        )}
      </>
    );
    const className =
      "block rounded-3xl border border-transparent bg-gradient-to-br from-blue-600 to-[var(--brand-navy)] p-5 text-white shadow-sm" +
      (href ? " transition hover:shadow-md hover:brightness-110" : "");
    return href ? (
      <Link href={href} className={className}>
        {content}
      </Link>
    ) : (
      <div className={className}>{content}</div>
    );
  }

  const content = (
    <>
      <div className="flex items-start justify-between">
        <span className="text-xs font-medium tracking-wide text-slate-500 uppercase">
          {label}
        </span>
        {Icon && (
          <Icon
            className={`h-4 w-4 ${tone === "warning" ? "text-amber-500" : "text-slate-400"}`}
          />
        )}
      </div>
      <div className="mt-2 text-2xl font-semibold text-slate-900">{value}</div>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </>
  );
  const className =
    `block rounded-3xl border p-5 ${
      tone === "warning" ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-white"
    }` + (href ? " transition hover:border-slate-300 hover:shadow-md" : "");
  return href ? (
    <Link href={href} className={className}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}
