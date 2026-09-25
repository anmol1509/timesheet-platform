"use client";

import { useRef, useState } from "react";
import { useFormReset } from "@/lib/useFormReset";
import { PhoneInput } from "./PhoneInput";
import { COUNTRIES } from "@/lib/countries";

/**
 * A phone number with a searchable country-code dropdown, for ordinary forms.
 * Submits one combined value ("+971501234567") under `name`; a bare country
 * code with no number submits as empty.
 */
export function PhoneField({ name, defaultValue, value: controlled, onChange, required, placeholder, id, disabled }: { name?: string; defaultValue?: string | null; value?: string; onChange?: (v: string) => void; required?: boolean; placeholder?: string; id?: string; disabled?: boolean }) {
  const [inner, setInner] = useState(defaultValue ?? "");
  const value = controlled ?? inner;
  const rootRef = useRef<HTMLDivElement>(null);
  useFormReset(rootRef, () => setInner(defaultValue ?? ""));
  const submitted = COUNTRIES.some((c) => c.dial === value) ? "" : value;
  return (
    <div ref={rootRef}>
      {name && <input type="hidden" name={name} value={submitted} />}
      <PhoneInput id={id} value={value} onChange={(v) => { setInner(v); onChange?.(v); }} placeholder={placeholder} disabled={disabled} />
      {required && <input tabIndex={-1} aria-hidden className="sr-only" required value={submitted} onChange={() => {}} />}
    </div>
  );
}
