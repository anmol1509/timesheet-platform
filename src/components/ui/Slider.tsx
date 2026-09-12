"use client";

import * as SliderPrimitive from "@radix-ui/react-slider";
import { cn } from "@/lib/cn";

/**
 * Single-thumb slider for a bounded number the user judges by feel rather
 * than types — a skill level, a percentage, a horizon in days. For an exact
 * figure someone reads off a document (hours, rates, quantities) keep the
 * number input: a slider makes precise entry harder, not easier.
 *
 * Radix's API is multi-thumb (number[]); this wraps the scalar case, which is
 * every use in the app. The thumb picks up the global `[tabindex]`
 * focus-visible ring.
 */
export function Slider({
  value,
  defaultValue,
  onChange,
  onCommit,
  min = 0,
  max = 100,
  step = 1,
  disabled,
  className,
  label,
  valueLabel,
  ariaLabel,
}: {
  value?: number;
  defaultValue?: number;
  onChange?: (value: number) => void;
  /** Fires once on release — use for the value you persist, so dragging doesn't write on every tick. */
  onCommit?: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  className?: string;
  /** Caption above the track, left-aligned. */
  label?: React.ReactNode;
  /** Live read-out above the track, right-aligned — e.g. "Skilled · 70%". */
  valueLabel?: React.ReactNode;
  ariaLabel?: string;
}) {
  return (
    <div className={className}>
      {(label || valueLabel) && (
        <span className="mb-2.5 flex items-center justify-between text-xs font-medium text-muted">
          <span>{label}</span>
          {valueLabel && <span className="text-secondary">{valueLabel}</span>}
        </span>
      )}
      <SliderPrimitive.Root
        value={value === undefined ? undefined : [value]}
        defaultValue={defaultValue === undefined ? undefined : [defaultValue]}
        onValueChange={([next]) => onChange?.(next)}
        onValueCommit={([next]) => onCommit?.(next)}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        className={cn(
          "relative flex h-4 w-full touch-none items-center select-none",
          disabled && "cursor-not-allowed opacity-50"
        )}
      >
        <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-surface-sunken">
          <SliderPrimitive.Range className="absolute h-full bg-[var(--brand-primary)]" />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb
          aria-label={ariaLabel}
          className={cn(
            "block h-4 w-4 rounded-full border-2 border-[var(--brand-primary)] bg-white shadow-sm transition",
            !disabled && "cursor-grab hover:scale-110 active:cursor-grabbing"
          )}
        />
      </SliderPrimitive.Root>
    </div>
  );
}
