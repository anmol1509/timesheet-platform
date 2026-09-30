import Link from "next/link";
import { Check } from "lucide-react";
import { getSetupSteps } from "@/lib/getStarted";
import { cn } from "@/lib/cn";
import { cookies } from "next/headers";
import { setGetStartedHidden } from "./getStartedActions";
import { CollapsibleSteps } from "./CollapsibleSteps";

const HIDE_COOKIE = "hide_get_started";

/** Setup progress for a company that hasn't finished moving in. Renders nothing once every step is done. */
export async function GetStarted({ branchId, compact = false }: { branchId: string; compact?: boolean }) {
  const hidden = (await cookies()).get(HIDE_COOKIE)?.value === "1";
  // On the dashboard the card folds instead of disappearing (a card hidden
  // with the old button now simply opens folded); Import Data can still hide it.
  const jar = await cookies();
  const folded = jar.get("gs_collapsed")?.value === "1" || (compact && hidden);
  const steps = await getSetupSteps(branchId);
  const done = steps.filter((s) => s.done).length;
  if (done === steps.length) return null;
  const next = steps.find((s) => !s.done)!;
  const pct = Math.round((done / steps.length) * 100);

  const list = (
    <ol className={cn("divide-y divide-[var(--border)]", compact && "hidden sm:block")}>
      {steps.map((s, i) => (
        <li key={s.key} className="flex items-center gap-3 px-5 py-3">
          <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold", s.done ? "bg-[var(--success-soft)] text-[var(--success)] ring-1 ring-[var(--success-border)]" : s === next ? "bg-brand-soft text-[var(--brand-primary)] ring-1 ring-[var(--brand-primary-border)]" : "bg-surface-sunken text-muted")}>
            {s.done ? <Check className="h-3.5 w-3.5" aria-hidden /> : i + 1}
          </span>
          <div className="min-w-0 flex-1">
            <p className={cn("text-sm font-medium", s.done ? "text-muted" : "text-primary")}>{s.title}</p>
            <p className="truncate text-xs text-muted">{s.detail}</p>
          </div>
          {!s.done && (
            <Link href={s.href} className={cn("btn btn-sm shrink-0", s === next ? "btn-primary" : "btn-secondary")}>
              {s.action}
            </Link>
          )}
        </li>
      ))}
    </ol>
  );

  return (
    <section className="card overflow-hidden" aria-label="Get started">
      {compact ? (
        <CollapsibleSteps
          defaultCollapsed={folded}
          summary={
            <>
              <div>
                <h2 className="text-sm font-semibold text-primary">Get started</h2>
                <p className="mt-0.5 text-xs text-muted">{done} of {steps.length} done &middot; next: {next.title.toLowerCase()}</p>
              </div>
              <div className="ml-auto flex w-full items-center gap-3 sm:w-64">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-sunken" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
                  <div className="h-full rounded-full bg-[var(--brand-primary)]" style={{ width: `${Math.max(pct, 3)}%` }} />
                </div>
                <span className="tabular text-xs font-medium text-secondary">{pct}%</span>
              </div>
            </>
          }
        >
          {list}
        </CollapsibleSteps>
      ) : (
        <>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-default bg-surface-subtle px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-primary">Get started</h2>
          <p className="mt-0.5 text-xs text-muted">{done} of {steps.length} done &middot; next: {next.title.toLowerCase()}</p>
        </div>
        <div className="flex w-full items-center gap-3 sm:w-auto">
          <div className="flex w-full items-center gap-3 sm:w-64">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-sunken" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
            <div className="h-full rounded-full bg-[var(--brand-primary)]" style={{ width: `${Math.max(pct, 3)}%` }} />
          </div>
          <span className="tabular text-xs font-medium text-secondary">{pct}%</span>
          </div>
          <form action={setGetStartedHidden.bind(null, compact ? true : !hidden)}>
            <button type="submit" className="btn btn-sm btn-secondary shrink-0 whitespace-nowrap" >
              {hidden ? "Show on dashboard" : "Hide from dashboard"}
            </button>
          </form>
        </div>
      </div>
          {list}
        </>
      )}
    </section>
  );
}
