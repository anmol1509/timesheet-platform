"use client";

import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/cn";

export function Checkbox({
  name,
  value,
  checked,
  defaultChecked,
  onCheckedChange,
  disabled,
  required,
  indeterminate,
  className,
  label,
  ariaLabel,
}: {
  name?: string;
  value?: string;
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  required?: boolean;
  indeterminate?: boolean;
  className?: string;
  /** Optional inline label; for full control over label markup/spacing, omit this and wrap the checkbox yourself. */
  label?: React.ReactNode;
  /** Accessible name for checkboxes with no visible label — e.g. table row selection. */
  ariaLabel?: string;
}) {
  const box = (
    <CheckboxPrimitive.Root
      name={name}
      value={value}
      checked={indeterminate ? "indeterminate" : checked}
      defaultChecked={defaultChecked}
      onCheckedChange={(state) => onCheckedChange?.(state === true)}
      disabled={disabled}
      required={required}
      aria-label={ariaLabel}
      className={cn(
        "flex h-4 w-4 shrink-0 items-center justify-center rounded-xs border border-strong bg-surface transition hover:border-[var(--brand-primary)] data-[state=checked]:border-[var(--brand-primary)] data-[state=checked]:bg-[var(--brand-primary)] data-[state=indeterminate]:border-[var(--brand-primary)] data-[state=indeterminate]:bg-[var(--brand-primary)] disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
    >
      <CheckboxPrimitive.Indicator className="text-white">
        {indeterminate ? <Minus className="h-3 w-3" /> : <Check className="h-3 w-3" />}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );

  if (!label) return box;

  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-secondary">
      {box}
      {label}
    </label>
  );
}
