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
      className={cn(
        "flex h-4 w-4 shrink-0 items-center justify-center rounded border border-slate-300 bg-white outline-none transition data-[state=checked]:border-[#166534] data-[state=checked]:bg-[#166534] data-[state=indeterminate]:border-[#166534] data-[state=indeterminate]:bg-[#166534] disabled:cursor-not-allowed disabled:opacity-50",
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
    <label className="flex items-center gap-2 text-sm text-slate-600">
      {box}
      {label}
    </label>
  );
}
