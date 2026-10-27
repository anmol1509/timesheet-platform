import Link from "next/link";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";
import type { CreditStatus } from "@/lib/aiCredits";

/**
 * The AI credits left this month, as a small bar in the header. Administrators always see it and it opens the usage page;
 * everyone else only sees a note when AI has been paused because the credits are used up.
 */
export function AiCreditsBar({ status, isAdmin }: { status: CreditStatus; isAdmin: boolean }) {
  if (!isAdmin) {
    if (status.level !== "out") return null;
    return (
      <span className="hidden items-center gap-1.5 rounded-full border border-[var(--error-border)] bg-[var(--error-soft)] px-2.5 py-1 text-xs font-medium text-[var(--error)] sm:inline-flex" title="This month's AI credits are used up. AI is paused until they reset; everything can still be done by hand.">
        <Sparkles className="h-3.5 w-3.5" aria-hidden /> AI paused
      </span>
    );
  }
  const left = 100 - status.pct;
  const tone = status.level === "out" ? "bg-[var(--error)]" : status.level === "warn" ? "bg-[var(--warning)]" : "bg-[var(--brand-primary)]";
  const label = status.level === "out" ? "AI paused" : `AI ${left}% left`;
  return (
    <Link
      href="/settings/ai"
      className="hidden items-center gap-2 rounded-full border border-default bg-surface px-3 py-1 text-xs font-medium text-secondary transition hover:border-[var(--border-strong,var(--border))] hover:text-primary sm:inline-flex"
      title={`${Math.round(status.remaining).toLocaleString("en-US")} of ${Math.round(status.total).toLocaleString("en-US")} AI credits left this month. Resets ${status.resetsAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Asia/Dubai" })}.`}
    >
      <Sparkles className={cn("h-3.5 w-3.5", status.level === "out" ? "text-[var(--error)]" : status.level === "warn" ? "text-[var(--warning)]" : "text-[var(--brand-primary)]")} aria-hidden />
      <span className="tabular whitespace-nowrap">{label}</span>
      <span className="h-1.5 w-14 overflow-hidden rounded-full bg-surface-sunken" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={status.pct} aria-label="AI credits used this month">
        <span className={cn("block h-full rounded-full", tone)} style={{ width: `${Math.max(status.pct, status.pct > 0 ? 4 : 0)}%` }} />
      </span>
    </Link>
  );
}
