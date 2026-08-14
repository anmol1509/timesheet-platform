"use client";

import { useMemo } from "react";
import { Select } from "./Select";
import { COUNTRIES } from "@/lib/countries";
import { cn } from "@/lib/cn";

// Longest dial code first, so +1268 (Antigua) wins over +1 (US) when splitting
// a stored number back into country + subscriber parts.
const BY_LENGTH = [...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);

/** UAE, since that's where this workforce is. */
const DEFAULT_DIAL = "+971";

// Several countries share a dial code (+1, +39, +7), so the option value has to
// be the ISO code — the dial code alone can't identify which flag to show.
const OPTIONS = COUNTRIES.map((c) => ({
  value: c.code,
  label: `${c.name} ${c.dial}`,
  icon: <span className={`fi fi-${c.code} rounded-[2px]`} aria-hidden />,
}));

/** Splits a stored E.164-ish number into its dial code and the rest. */
function split(value: string) {
  const digits = (value || "").replace(/[^\d+]/g, "");
  const normalized = digits.startsWith("00") ? `+${digits.slice(2)}` : digits;
  const match = BY_LENGTH.find((c) => normalized.startsWith(c.dial));
  if (match) {
    return { country: match.code, dial: match.dial, rest: normalized.slice(match.dial.length) };
  }
  return {
    country: COUNTRIES.find((c) => c.dial === DEFAULT_DIAL)?.code ?? "ae",
    dial: DEFAULT_DIAL,
    // A number with no recognisable country code is kept as typed, minus any
    // leading +, rather than being silently reinterpreted.
    rest: normalized.replace(/^\+/, ""),
  };
}

/**
 * Phone field with a searchable country dropdown showing each country's flag
 * and dial code. Stores one combined string ("+971556885010"), so nothing
 * downstream has to know the number was entered in two parts.
 */
export function PhoneInput({
  id,
  value,
  onChange,
  placeholder = "50 123 4567",
  disabled,
  className,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  const { country, dial, rest } = useMemo(() => split(value), [value]);

  function setCountry(code: string) {
    const next = COUNTRIES.find((c) => c.code === code);
    if (next) onChange(rest ? `${next.dial}${rest}` : next.dial);
  }

  function setNumber(input: string) {
    const cleaned = input.replace(/[^\d]/g, "");
    onChange(cleaned ? `${dial}${cleaned}` : "");
  }

  return (
    <div className={cn("flex gap-2", className)}>
      <div className="w-[7.5rem] shrink-0">
        <Select
          value={country}
          onChange={setCountry}
          options={OPTIONS}
          disabled={disabled}
          searchPlaceholder="Search country or code…"
          emptyText="No matching country."
          // The trigger is narrow, so it shows flag + dial code only; the full
          // country name lives in the dropdown list.
          renderTrigger={(selected) => (
            <span className="flex min-w-0 items-center gap-2">
              {selected?.icon}
              <span className="tabular truncate">{dial}</span>
            </span>
          )}
        />
      </div>
      <input
        id={id}
        type="tel"
        inputMode="tel"
        value={rest}
        disabled={disabled}
        onChange={(e) => setNumber(e.target.value)}
        placeholder={placeholder}
        className="input tabular w-full"
      />
    </div>
  );
}
