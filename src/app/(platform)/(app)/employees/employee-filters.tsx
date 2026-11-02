"use client";

import { FilterPanel, type FilterField } from "@/components/data-table/FilterPanel";

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

/** The Employees page's filters: the choices come from the server with how many workers each has, and picking one reloads the list. */
const STATUS_OPTIONS = [
  { value: "vacation", label: "On vacation" },
  { value: "absconding", label: "Absconding" },
  { value: "terminated", label: "Terminated" },
];

export function EmployeeFilters({ options, values, onChange, status, onStatus }: { options: FilterOptions; values: FilterValues; onChange: (key: FilterKey, value: string) => void; status: string; onStatus: (value: string) => void }) {
  const fields: FilterField[] = FIELDS.map((f) => ({ key: f.key, label: f.label, all: f.all, options: options[f.from].map((o) => ({ value: o.value, label: `${o.label} (${o.count})` })) }));
  fields.push({ key: "status", label: "Status", all: "All statuses", options: STATUS_OPTIONS });
  return <FilterPanel fields={fields} values={{ ...values, status }} onChange={(k, v) => (k === "status" ? onStatus(v) : onChange(k as FilterKey, v))} />;
}
