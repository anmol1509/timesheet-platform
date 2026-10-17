"use client";

import * as Popover from "@radix-ui/react-popover";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "cmdk";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

export type MultiOption = { value: string; label: string; /** Shown indented, for a child of the option above it. */ indent?: boolean };

/**
 * Pick any number from a long list: type to narrow it, tick as many as you like, and the list stays open.
 * Built for lists too long to show as chips (every supplier, every project).
 */
export function MultiSelect({ values, onChange, options, placeholder, noun, triggerClassName }: {
  values: string[];
  onChange: (values: string[]) => void;
  options: MultiOption[];
  placeholder: string;
  /** Plural noun for the trigger summary, e.g. "suppliers". */
  noun: string;
  triggerClassName?: string;
}) {
  const chosen = new Set(values);
  const toggle = (v: string) => onChange(chosen.has(v) ? values.filter((x) => x !== v) : [...values, v]);
  const summary = values.length === 0 ? placeholder : values.length === 1 ? (options.find((o) => o.value === values[0])?.label ?? "1 selected") : `${values.length} ${noun}`;
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button type="button" className={cn("input flex w-full items-center justify-between gap-2 text-left data-[state=open]:border-[var(--brand-primary)]", triggerClassName)}>
          <span className={cn("truncate", values.length === 0 && "text-subtle")}>{summary}</span>
          <ChevronDown className="h-4 w-4 shrink-0 text-subtle" aria-hidden />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="start" sideOffset={4} className="rx-popover z-50 w-[min(24rem,var(--radix-popover-content-available-width))] overflow-hidden rounded-control border border-default bg-surface shadow-popover">
          <Command loop>
            <CommandInput autoFocus placeholder={`Search ${noun}…`} className="w-full border-b border-default px-3 py-2 text-sm text-primary outline-none placeholder:text-subtle" />
            <CommandList className="max-h-72 overflow-y-auto p-1">
              <CommandEmpty className="px-3 py-6 text-center text-sm text-muted">Nothing matches.</CommandEmpty>
              <CommandGroup>
                {options.map((o) => (
                  <CommandItem
                    key={o.value}
                    value={o.label}
                    onSelect={() => toggle(o.value)}
                    className={cn("flex cursor-pointer items-center gap-2 rounded-sm px-2.5 py-1.5 text-sm text-secondary outline-none data-[selected=true]:bg-surface-hover data-[selected=true]:text-primary", o.indent && "pl-6")}
                  >
                    <span className={cn("flex h-4 w-4 shrink-0 items-center justify-center rounded border", chosen.has(o.value) ? "border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white" : "border-default")}>
                      {chosen.has(o.value) && <Check className="h-3 w-3" aria-hidden />}
                    </span>
                    <span className="flex-1 truncate">{o.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
            {values.length > 0 && (
              <button type="button" onClick={() => onChange([])} className="w-full border-t border-default px-3 py-2 text-left text-xs font-medium text-[var(--brand-primary)] hover:bg-surface-hover">
                Clear ({values.length})
              </button>
            )}
          </Command>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
