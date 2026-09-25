"use client";

import { useRef, useState } from "react";
import { useFormReset } from "@/lib/useFormReset";
import { PhoneInput } from "./PhoneInput";
import { COUNTRIES } from "@/lib/countries";
import { dialForCountry } from "@/lib/cities";

const isBareDial = (v: string) => COUNTRIES.some((c) => c.dial === v);

/**
 * A phone number with a searchable country-code dropdown, for ordinary forms.
 * Submits one combined value ("+971501234567") under `name`; a bare country
 * code with no number submits as empty.
 *
 * Pass `country` (the form's Country field) and an empty number starts with,
 * and follows, that country's dial code. Once a number is typed, or the code is
 * picked by hand, it stays as entered.
 */
export function PhoneField({ name, defaultValue, value: controlled, onChange, required, placeholder, id, disabled, country }: {
  /** Country whose dial code an empty field starts with and follows. */
  country?: string | null;
  name?: string;
  defaultValue?: string | null;
  value?: string;
  onChange?: (v: string) => void;
  required?: boolean;
  placeholder?: string;
  id?: string;
  disabled?: boolean;
}) {
  const [inner, setInner] = useState(defaultValue ?? "");
  const [touched, setTouched] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  useFormReset(rootRef, () => {
    setInner(defaultValue ?? "");
    setTouched(false);
  });
  const countryDial = dialForCountry(country);
  const stored = controlled ?? inner;
  const empty = stored === "" || isBareDial(stored);
  const value = !touched && empty && countryDial ? countryDial : stored;
  const submitted = isBareDial(value) ? "" : value;
  return (
    <div ref={rootRef}>
      {name && <input type="hidden" name={name} value={submitted} />}
      <PhoneInput
        id={id}
        value={value}
        defaultDial={countryDial ?? undefined}
        onChange={(v) => {
          setTouched(true);
          setInner(v);
          onChange?.(v);
        }}
        placeholder={placeholder}
        disabled={disabled}
      />
      {required && <input tabIndex={-1} aria-hidden className="sr-only" required value={submitted} onChange={() => {}} />}
    </div>
  );
}
