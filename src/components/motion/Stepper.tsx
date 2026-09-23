"use client";

import { Check } from "lucide-react";
import { m } from "motion/react";
import { cn } from "@/lib/cn";
import { DURATION, EASE } from "@/lib/motion";

export type StepStatus = "done" | "current" | "upcoming" | "error";

export type StepItem = { key: string; label: string; status: StepStatus };

/**
 * Numbered step row for multi-step forms/flows (Add Employee, NOC, Workmen
 * Comp import, Check-In). Purely presentational — the caller owns the active
 * step and click-to-jump logic (steps already completed should usually be
 * clickable; steps ahead usually should not be, until validated).
 */
export function Stepper({
  steps,
  onStepClick,
  className,
}: {
  steps: StepItem[];
  onStepClick?: (key: string) => void;
  className?: string;
}) {
  return (
    <ol className={cn("flex flex-wrap items-center gap-x-1 gap-y-2", className)}>
      {steps.map((step, i) => {
        const clickable = !!onStepClick && step.status !== "upcoming";
        return (
          <li key={step.key} className="flex items-center">
            {i > 0 && (
              <span
                className={cn(
                  "mx-1.5 h-px w-4 shrink-0 sm:w-6",
                  step.status === "upcoming" ? "bg-[var(--border)]" : "bg-[var(--brand-primary)]"
                )}
                aria-hidden
              />
            )}
            <button
              type="button"
              disabled={!clickable}
              onClick={() => clickable && onStepClick?.(step.key)}
              aria-current={step.status === "current" ? "step" : undefined}
              className={cn(
                "flex items-center gap-2 rounded-control px-1.5 py-1 text-sm font-medium transition disabled:cursor-default",
                clickable && "cursor-pointer hover:bg-surface-hover"
              )}
            >
              <span className="relative flex h-6 w-6 shrink-0 items-center justify-center">
                {step.status === "done" ? (
                  <m.span
                    key="done"
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: DURATION, ease: EASE }}
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--brand-primary)] text-white"
                  >
                    <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                  </m.span>
                ) : (
                  <span
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-full border text-xs tabular",
                      step.status === "current" &&
                        "border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white",
                      step.status === "upcoming" && "border-[var(--border-strong)] text-subtle",
                      step.status === "error" &&
                        "border-[var(--error)] bg-[var(--error-soft)] text-[var(--error)]"
                    )}
                  >
                    {i + 1}
                  </span>
                )}
              </span>
              <span
                className={cn(
                  "hidden sm:inline",
                  step.status === "upcoming" ? "text-subtle" : "text-primary"
                )}
              >
                {step.label}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

/** Slide transition for the active step's content — pairs with Stepper. */
export function StepPanel({
  stepKey,
  direction,
  children,
}: {
  stepKey: string;
  /** 1 = advancing (slide from right), -1 = going back (slide from left). */
  direction: 1 | -1;
  children: React.ReactNode;
}) {
  return (
    <m.div
      key={stepKey}
      initial={{ opacity: 0, x: direction * 16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: direction * -16 }}
      transition={{ duration: DURATION, ease: EASE }}
    >
      {children}
    </m.div>
  );
}
