"use client";

import { Select } from "./Select";
import { citiesFor } from "@/lib/cities";

/**
 * Searchable emirate/city picker for the chosen country (UAE when none is chosen).
 * For a country with no list it falls back to a plain text box, so nothing is ever blocked.
 */
export function CitySelect({ name, country, value, defaultValue, onChange, placeholder = "Select emirate / city…", disabled }: { name?: string; country?: string | null; value?: string; defaultValue?: string; onChange?: (v: string) => void; placeholder?: string; disabled?: boolean }) {
  const cities = citiesFor(country);
  if (!cities) {
    return <input name={name} value={value} defaultValue={defaultValue} onChange={(e) => onChange?.(e.target.value)} disabled={disabled} placeholder="City" className="input w-full" />;
  }
  const options = cities.map((c) => ({ value: c, label: c }));
  return <Select key={country ?? "uae"} name={name} value={value} defaultValue={defaultValue} onChange={onChange} options={options} placeholder={placeholder} searchPlaceholder="Search city…" emptyText="No matching city." disabled={disabled} />;
}
