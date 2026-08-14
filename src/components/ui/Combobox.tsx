"use client";

import { useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Command, CommandList, CommandGroup, CommandItem, CommandEmpty } from "cmdk";
import { cn } from "@/lib/cn";

export type ComboboxOption = { value: string; label: string; description?: string };

/**
 * Free-text input with a filtered suggestion dropdown — replaces native
 * `<input list=datalist>`. Unlike Select, any typed value is accepted;
 * picking a suggestion just fills the text (and optionally reports the
 * matched option so callers can auto-fill sibling fields).
 */
export function Combobox({
  name,
  value: controlledValue,
  defaultValue = "",
  onChange,
  onSelectOption,
  options,
  placeholder = "Type to search…",
  emptyText = "No matches — you can still type a new value.",
  className,
  disabled,
  required,
}: {
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  onSelectOption?: (option: ComboboxOption) => void;
  options: ComboboxOption[];
  placeholder?: string;
  emptyText?: string;
  className?: string;
  disabled?: boolean;
  required?: boolean;
}) {
  const isControlled = controlledValue !== undefined;
  const [internalValue, setInternalValue] = useState(defaultValue);
  const value = isControlled ? controlledValue! : internalValue;
  const [open, setOpen] = useState(false);

  function setValue(v: string) {
    if (!isControlled) setInternalValue(v);
    onChange?.(v);
  }

  const filtered = value.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(value.trim().toLowerCase()))
    : options;

  return (
    <Popover.Root open={open && filtered.length > 0} onOpenChange={setOpen}>
      <Popover.Anchor asChild>
        <input
          name={name}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          autoComplete="off"
          className={cn(
            "input w-full",
            className
          )}
        />
      </Popover.Anchor>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={4}
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="rx-popover z-50 w-[var(--radix-popover-trigger-width)] overflow-hidden rounded-lg border border-default bg-surface shadow-lg"
        >
          <Command shouldFilter={false}>
            <CommandList className="max-h-56 overflow-y-auto p-1">
              {filtered.length === 0 && (
                <CommandEmpty className="px-3 py-4 text-center text-sm text-muted">
                  {emptyText}
                </CommandEmpty>
              )}
              <CommandGroup>
                {filtered.slice(0, 50).map((o) => (
                  <CommandItem
                    key={o.value}
                    value={o.value}
                    onMouseDown={(e) => e.preventDefault()}
                    onSelect={() => {
                      setValue(o.label);
                      onSelectOption?.(o);
                      setOpen(false);
                    }}
                    className="flex cursor-pointer flex-col items-start rounded-md px-2.5 py-2 text-sm text-secondary outline-none data-[selected=true]:bg-surface-hover"
                  >
                    <span className="truncate">{o.label}</span>
                    {o.description && (
                      <span className="text-xs text-subtle">{o.description}</span>
                    )}
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
