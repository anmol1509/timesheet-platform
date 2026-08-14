"use client";

import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import { cn } from "@/lib/cn";

export type RadioOption = { value: string; label: string };

/** Traditional radio circles + labels, stacked or inline. */
export function RadioGroup({
  name,
  value,
  defaultValue,
  onChange,
  options,
  className,
  itemClassName,
  disabled,
}: {
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  options: RadioOption[];
  className?: string;
  itemClassName?: string;
  disabled?: boolean;
}) {
  return (
    <RadioGroupPrimitive.Root
      name={name}
      value={value}
      defaultValue={defaultValue}
      onValueChange={onChange}
      disabled={disabled}
      className={cn("flex flex-col gap-2", className)}
    >
      {options.map((o) => (
        <label
          key={o.value}
          className={cn("flex items-center gap-2 text-sm text-secondary", itemClassName)}
        >
          <RadioGroupPrimitive.Item
            value={o.value}
            className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-strong bg-surface outline-none transition data-[state=checked]:border-[var(--brand-primary)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RadioGroupPrimitive.Indicator className="h-2 w-2 rounded-full bg-[var(--brand-primary)]" />
          </RadioGroupPrimitive.Item>
          {o.label}
        </label>
      ))}
    </RadioGroupPrimitive.Root>
  );
}

/** Connected pill-button group — same a11y semantics as RadioGroup, styled as a segmented filter. */
export function SegmentedControl({
  name,
  value,
  defaultValue,
  onChange,
  options,
  className,
}: {
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  options: RadioOption[];
  className?: string;
}) {
  return (
    <RadioGroupPrimitive.Root
      name={name}
      value={value}
      defaultValue={defaultValue}
      onValueChange={onChange}
      className={cn(
        "inline-flex items-center gap-1 rounded-lg border border-default bg-surface-subtle p-1",
        className
      )}
    >
      {options.map((o) => (
        <RadioGroupPrimitive.Item
          key={o.value}
          value={o.value}
          className="rounded-md px-3 py-1.5 text-sm font-medium text-muted outline-none transition data-[state=checked]:bg-surface data-[state=checked]:text-primary data-[state=checked]:shadow-sm hover:text-secondary"
        >
          {o.label}
        </RadioGroupPrimitive.Item>
      ))}
    </RadioGroupPrimitive.Root>
  );
}
