"use client";

import * as Popover from "@radix-ui/react-popover";
import { SlidersHorizontal, X } from "lucide-react";
import { Select } from "@/components/ui/Select";

export type FilterKey = "supplier" | "sponsor" | "trade" | "nationality";
type Option = { value: string; label: string; count: number };
export type FilterOptions = Record<"suppliers" | "sponsors" | "trades" | "nationalities", Option[]>;
export type FilterValues = Record<FilterKey, string>;

const FIELDS: { key: FilterKey; label: string; all: string; from: keyof FilterOptions }[] = [
  { key: "supplier", label: "Supplier", all: "All suppliers", from: "suppliers" },
  { key: "sponsor", label: "Sponsor", all: "All sponsors", from: "sponsors" },
  { key: "trade", label: "Trade", all: "All trades", from: "trades" },
  { key: "nationality", label: "Nationality", all: "All nationalities", from: "nationalities" },
];

/**
 * One "Filters" button that opens a small panel with the four choices, so the table's toolbar keeps its single row. What is
 * switched on shows as tags beside the button, each with its own clear.
 */
export function EmployeeFilters({ options, values, onChange }: { options: FilterOptions; values: FilterValues; onChange: (key: FilterKey, value: string) => void }) {
  const active = FIELDS.filter((f) => values[f.key]);
  const labelOf = (f: (typeof FIELDS)[number]) => options[f.from].find((o) => o.value === values[f.key])?.label ?? values[f.key].replace(/^[sn]:/, "");

  return (
    <>
      <Popover.Root>
        <Popover.Trigger asChild>
          <button
            type="button"
            className="inline-flex h-9 items-center gap-1.5 rounded-control border border-strong bg-surface px-3 text-[13px] font-medium text-secondary shadow-xs transition hover:border-[#c3c8d4] hover:bg-surface-hover hover:text-primary"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
            Filters
            {active.length > 0 && <span className="tabular rounded-full bg-[var(--brand-primary)] px-1.5 text-[11px] leading-4 font-semibold text-white">{active.length}</span>}
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content align="start" sideOffset={6} className="rx-popover z-50 w-80 space-y-4 rounded-card border border-default bg-surface p-4 shadow-popover">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-primary">Filter employees</h3>
              {active.length > 0 && (
                <button type="button" className="text-xs font-medium text-[var(--brand-primary)] hover:underline" onClick={() => active.forEach((f) => onChange(f.key, ""))}>
                  Clear all
                </button>
              )}
            </div>
            {FIELDS.map((f) => (
              <label key={f.key} className="block">
                <span className="mb-1 block text-xs font-medium text-muted">{f.label}</span>
                <Select
                  value={values[f.key]}
                  onChange={(v) => onChange(f.key, v)}
                  placeholder={f.all}
                  searchable
                  options={[{ value: "", label: f.all }, ...options[f.from].map((o) => ({ value: o.value, label: `${o.label} (${o.count})` }))]}
                />
              </label>
            ))}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      {active.map((f) => (
        <span key={f.key} className="inline-flex h-9 max-w-[16rem] items-center gap-1 rounded-control bg-brand-soft py-1 pr-1 pl-2.5 text-xs font-medium text-[var(--brand-primary)]">
          <span className="truncate">{f.label}: {labelOf(f)}</span>
          <button type="button" aria-label={`Clear ${f.label} filter`} onClick={() => onChange(f.key, "")} className="rounded-xs p-0.5 transition hover:bg-white/70">
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
    </>
  );
}
