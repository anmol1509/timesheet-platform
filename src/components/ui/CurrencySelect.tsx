"use client";

import { Select } from "./Select";
import { CURRENCIES } from "@/lib/currencies";

const OPTIONS = CURRENCIES.map((c) => ({ value: c.code, label: `${c.code} — ${c.name}` }));

/** Searchable currency picker; stores the ISO code ("AED"). An older free-text value still shows until changed. */
export function CurrencySelect(props: { name?: string; value?: string; defaultValue?: string; onChange?: (v: string) => void; placeholder?: string; disabled?: boolean; required?: boolean }) {
  return <Select {...props} options={OPTIONS} placeholder={props.placeholder ?? "Select currency…"} searchPlaceholder="Search currency…" emptyText="No matching currency." />;
}
