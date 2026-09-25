"use client";

import { ComboSelect } from "./ComboSelect";
import { CURRENCIES } from "@/lib/currencies";

const OPTIONS = CURRENCIES.map((c) => ({ value: c.code, label: `${c.code} — ${c.name}` }));

/** Searchable currency picker; stores the ISO code ("AED"), with "Other…" for a code not listed. */
export function CurrencySelect(props: { name?: string; value?: string; defaultValue?: string; onChange?: (v: string) => void; placeholder?: string; disabled?: boolean; required?: boolean }) {
  return <ComboSelect {...props} options={OPTIONS} placeholder={props.placeholder ?? "Select currency…"} searchPlaceholder="Search currency…" otherPlaceholder="Currency code, e.g. CHF" />;
}
