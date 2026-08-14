"use client";

import { useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "cmdk";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

export type SelectOption = { value: string; label: string; icon?: React.ReactNode };

export function Select({
  name,
  value: controlledValue,
  defaultValue,
  onChange,
  options,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  searchable = true,
  emptyText = "No results.",
  triggerClassName,
  disabled,
  required,
}: {
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  searchable?: boolean;
  emptyText?: string;
  triggerClassName?: string;
  disabled?: boolean;
  required?: boolean;
}) {
  const isControlled = controlledValue !== undefined;
  const [internalValue, setInternalValue] = useState(defaultValue ?? "");
  const value = isControlled ? controlledValue : internalValue;
  const [open, setOpen] = useState(false);

  const selected = options.find((o) => o.value === value);

  function handleSelect(v: string) {
    if (!isControlled) setInternalValue(v);
    onChange?.(v);
    setOpen(false);
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      {name && <input type="hidden" name={name} value={value} required={required} />}
      <Popover.Trigger asChild disabled={disabled}>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "input flex w-full items-center justify-between gap-2 text-left data-[state=open]:border-[var(--brand-primary)]",
            triggerClassName
          )}
        >
          <span className={cn("flex min-w-0 items-center gap-2 truncate", !value && "text-subtle")}>
            {selected?.icon}
            <span className="truncate">{selected ? selected.label : value || placeholder}</span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-subtle" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={4}
          className="rx-popover z-50 w-[var(--radix-popover-trigger-width)] overflow-hidden rounded-control border border-default bg-surface shadow-popover"
        >
          <Command loop>
            {searchable && (
              <CommandInput
                autoFocus
                placeholder={searchPlaceholder}
                className="w-full border-b border-default px-3 py-2 text-sm text-primary outline-none placeholder:text-subtle"
              />
            )}
            <CommandList className="max-h-64 overflow-y-auto p-1">
              <CommandEmpty className="px-3 py-6 text-center text-sm text-muted">
                {emptyText}
              </CommandEmpty>
              <CommandGroup>
                {options.map((o) => (
                  <CommandItem
                    key={o.value}
                    value={o.label}
                    onMouseDown={(e) => e.preventDefault()}
                    onSelect={() => handleSelect(o.value)}
                    className="flex cursor-pointer items-center gap-2 rounded-sm px-2.5 py-1.5 text-sm text-secondary outline-none data-[selected=true]:bg-surface-hover data-[selected=true]:text-primary"
                  >
                    {o.icon}
                    <span className="flex-1 truncate">{o.label}</span>
                    {o.value === value && <Check className="h-4 w-4 shrink-0 text-[var(--brand-primary)]" />}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
