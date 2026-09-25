"use client";

import { useState } from "react";
import { ComboSelect } from "./ComboSelect";
import { citiesFor } from "@/lib/cities";

/**
 * Searchable emirate/city picker for the chosen country (UAE when none is chosen),
 * with "Other…" for anything not listed. Changing the country swaps the list and clears the
 * city, since the old one no longer applies. A country with no list is a plain text box.
 */
export function CitySelect({ name, country, value, defaultValue, onChange, placeholder = "Select emirate / city…", disabled }: { name?: string; country?: string | null; value?: string; defaultValue?: string; onChange?: (v: string) => void; placeholder?: string; disabled?: boolean }) {
  const [initialCountry] = useState(country ?? null);
  // The stored city only belongs to the country it was saved with.
  const startValue = (country ?? null) === initialCountry ? defaultValue : "";
  const cities = citiesFor(country);
  if (!cities) {
    return <input key={country ?? "none"} name={name} value={value} defaultValue={startValue} onChange={(e) => onChange?.(e.target.value)} disabled={disabled} placeholder="City" className="input w-full" />;
  }
  return <ComboSelect key={country ?? "uae"} name={name} options={cities} value={value} defaultValue={startValue} onChange={onChange} placeholder={placeholder} searchPlaceholder="Search city…" otherPlaceholder="Type the city" disabled={disabled} />;
}
