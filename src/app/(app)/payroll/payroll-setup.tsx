import Link from "next/link";
import { Check, Circle } from "lucide-react";
import { Hint } from "@/components/Hint";
import type { GlossaryKey } from "@/lib/payrollGlossary";
import { cn } from "@/lib/cn";

export type SetupStep = { key: string; title: string; why: string; done: boolean; detail?: string; href?: string; action?: string; hint?: GlossaryKey };

/** First-time setup, in order: what payroll needs before the first run works, with the next undone step highlighted. */
export function PayrollSetup({ steps }: { steps: SetupStep[] }) {
  const done = steps.filter((s) => s.done).length;
  if (done === steps.length) return null;
  const next = steps.find((s) => !s.done)!;
  return (
    <section className="card p-5" aria-label="Payroll setup">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-primary">Set up payroll</h2>
          <p className="text-xs text-muted">{done} of {steps.length} steps done. Do them in order; each takes a minute or two.</p>
        </div>
        <div className="h-1.5 w-40 overflow-hidden rounded-full bg-[var(--surface-sunken)]" aria-hidden><div className="h-full rounded-full bg-[var(--brand-primary)]" style={{ width: `${(done / steps.length) * 100}%` }} /></div>
      </div>
      <ol className="mt-4 space-y-3">
        {steps.map((s, i) => {
          const isNext = s.key === next.key;
          return (
            <li key={s.key} className={cn("flex gap-3 rounded-md p-2", isNext && "bg-[var(--info-soft)]")}>
              <span className={cn("mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold", s.done ? "bg-[var(--success-soft)] text-[var(--success)]" : isNext ? "bg-[var(--brand-primary)] text-white" : "bg-surface-sunken text-muted")}>
                {s.done ? <Check className="h-3.5 w-3.5" aria-hidden /> : isNext ? i + 1 : <Circle className="h-3 w-3" aria-hidden />}
              </span>
              <div className="min-w-0 flex-1">
                <p className={cn("text-sm font-medium", s.done ? "text-muted line-through decoration-[var(--border)]" : "text-primary")}>{s.title}{s.hint && <Hint term={s.hint} />}</p>
                {!s.done && <p className="text-xs text-secondary">{s.why}</p>}
                {s.detail && !s.done && <p className="text-xs text-[var(--warning)]">{s.detail}</p>}
              </div>
              {!s.done && s.href && <Link href={s.href} className={cn("shrink-0 self-center text-xs font-medium hover:underline", isNext ? "btn btn-primary h-8 px-3 no-underline hover:no-underline" : "text-[var(--brand-primary)]")}>{s.action ?? "Open"}</Link>}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
