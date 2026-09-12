"use client";

import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "@/lib/cn";

/**
 * On/off toggle for a boolean that takes effect on its own — "active",
 * "locked", "internal use". Prefer this over Checkbox when the control *is*
 * the setting; keep Checkbox for selecting rows and for multi-select lists
 * inside a form the user still has to submit.
 *
 * The focus ring comes from the global `button:focus-visible` rule — Radix
 * renders the root as a real button.
 */
export function Switch({
  name,
  value,
  checked,
  defaultChecked,
  onCheckedChange,
  disabled,
  required,
  className,
  label,
  description,
  ariaLabel,
}: {
  name?: string;
  value?: string;
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  /** Optional inline label; omit it and wrap the switch yourself when a screen needs the control on the right. */
  label?: React.ReactNode;
  /** Secondary line under the label — what turning this on actually does. */
  description?: React.ReactNode;
  /** Accessible name for switches with no visible label — e.g. a toggle in a table row. */
  ariaLabel?: string;
}) {
  const control = (
    <SwitchPrimitive.Root
      name={name}
      value={value}
      checked={checked}
      defaultChecked={defaultChecked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      required={required}
      aria-label={ariaLabel}
      className={cn(
        "inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-strong bg-surface-sunken transition-colors",
        "data-[state=checked]:border-[var(--brand-primary)] data-[state=checked]:bg-[var(--brand-primary)]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          "pointer-events-none block h-3.5 w-3.5 translate-x-0.5 rounded-full bg-white ring-1 ring-black/5",
          "transition-transform data-[state=checked]:translate-x-[18px]"
        )}
      />
    </SwitchPrimitive.Root>
  );

  if (!label && !description) return control;

  return (
    <label
      className={cn(
        "flex items-start gap-2.5 text-sm",
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
      )}
    >
      {control}
      <span className="min-w-0">
        {label && <span className="block text-secondary">{label}</span>}
        {description && <span className="mt-0.5 block text-xs text-muted">{description}</span>}
      </span>
    </label>
  );
}
