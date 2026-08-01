"use client";

import { Select } from "./Select";
import { COUNTRIES } from "@/lib/countries";

// Value/label are the country NAME (not ISO code) so it round-trips with
// existing free-text data already stored in the DB (e.g. "India").
const OPTIONS = COUNTRIES.map((c) => ({
  value: c.name,
  label: c.name,
  icon: <span className={`fi fi-${c.code} rounded-[2px]`} aria-hidden />,
}));

export function CountrySelect({
  name,
  value,
  defaultValue,
  onChange,
  placeholder = "Select country…",
  disabled,
  required,
}: {
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
}) {
  return (
    <Select
      name={name}
      value={value}
      defaultValue={defaultValue}
      onChange={onChange}
      options={OPTIONS}
      placeholder={placeholder}
      searchPlaceholder="Search countries…"
      emptyText="No matching country."
      disabled={disabled}
      required={required}
    />
  );
}
