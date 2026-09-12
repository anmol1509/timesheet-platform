"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/cn";

/** Decimal places implied by a step, so +/- on step 0.01 doesn't drift into 3.0000000004. */
function decimalsOf(step: number) {
  const s = String(step);
  const dot = s.indexOf(".");
  return dot === -1 ? 0 : s.length - dot - 1;
}

function clamp(n: number, min?: number, max?: number) {
  if (min !== undefined && n < min) return min;
  if (max !== undefined && n > max) return max;
  return n;
}

/**
 * Number field with stepper buttons, for quantities, hours and rates.
 *
 * Works uncontrolled (`name` + `defaultValue`) as well as controlled, because
 * most number fields in this app are plain form inputs read server-side out of
 * FormData — the stepper still has to keep its own state so the buttons can
 * move the displayed value.
 *
 * Keeps `type="number"` underneath rather than reimplementing numeric entry:
 * typing, arrow keys and browser validation all keep working, and the buttons
 * are an addition rather than a replacement.
 */
export function NumberInput({
  name,
  value,
  defaultValue,
  onChange,
  min,
  max,
  step = 1,
  disabled,
  required,
  placeholder,
  className,
  inputClassName,
  ariaLabel,
}: {
  name?: string;
  value?: number | "";
  defaultValue?: number | "";
  onChange?: (value: number | "") => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  ariaLabel?: string;
}) {
  const [internal, setInternal] = useState<number | "">(defaultValue ?? "");
  const controlled = value !== undefined;
  const current = controlled ? value : internal;

  function commit(next: number | "") {
    if (!controlled) setInternal(next);
    onChange?.(next);
  }

  function nudge(direction: 1 | -1) {
    const base = current === "" ? (min ?? 0) : current;
    const raw = base + direction * step;
    commit(Number(clamp(raw, min, max).toFixed(decimalsOf(step))));
  }

  const atMin = current !== "" && min !== undefined && current <= min;
  const atMax = current !== "" && max !== undefined && current >= max;

  return (
    <div className={cn("flex items-stretch", className)}>
      <StepButton
        side="left"
        onClick={() => nudge(-1)}
        disabled={disabled || atMin}
        label="Decrease"
      >
        <Minus className="h-3.5 w-3.5" aria-hidden />
      </StepButton>
      <input
        type="number"
        name={name}
        value={current}
        onChange={(e) => commit(e.target.value === "" ? "" : Number(e.target.value))}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        required={required}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className={cn(
          "input w-full rounded-none border-x-0 text-center tabular",
          // The spinners would sit next to our own buttons saying the same thing.
          "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
          inputClassName
        )}
      />
      <StepButton
        side="right"
        onClick={() => nudge(1)}
        disabled={disabled || atMax}
        label="Increase"
      >
        <Plus className="h-3.5 w-3.5" aria-hidden />
      </StepButton>
    </div>
  );
}

function StepButton({
  side,
  onClick,
  disabled,
  label,
  children,
}: {
  side: "left" | "right";
  onClick: () => void;
  disabled?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        "flex w-8 shrink-0 items-center justify-center border border-strong bg-surface-subtle text-secondary transition",
        "hover:bg-surface-hover hover:text-primary disabled:cursor-not-allowed disabled:opacity-40",
        side === "left"
          ? "rounded-l-control rounded-r-none"
          : "rounded-r-control rounded-l-none"
      )}
    >
      {children}
    </button>
  );
}
