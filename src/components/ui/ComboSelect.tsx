"use client";

import { useEffect, useRef, useState } from "react";
import { useFormReset } from "@/lib/useFormReset";
import { Select, type SelectOption } from "./Select";

const OTHER = "__other__";

/**
 * A searchable dropdown over a fixed list that always ends with "Other…".
 * Choosing it opens a text box, so a value that isn't in the list can still
 * be entered. What is submitted (under `name`) is the option's value, or
 * whatever was typed. A stored value that isn't in the list shows up in the
 * text box, so old free-text data is never lost.
 */
export function ComboSelect({
  name,
  options,
  value: controlled,
  defaultValue,
  onChange,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  otherLabel = "Other…",
  otherPlaceholder = "Type it here",
  disabled,
  required,
  searchable = true,
}: {
  name?: string;
  options: (string | SelectOption)[];
  value?: string;
  defaultValue?: string | null;
  onChange?: (v: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  otherLabel?: string;
  otherPlaceholder?: string;
  disabled?: boolean;
  required?: boolean;
  searchable?: boolean;
}) {
  const opts: SelectOption[] = options.map((o) => (typeof o === "string" ? { value: o, label: o } : o));
  const [inner, setInner] = useState(defaultValue ?? "");
  const val = controlled ?? inner;
  const inList = opts.some((o) => o.value === val);
  const [otherPicked, setOtherPicked] = useState(false);
  const showText = otherPicked || (val !== "" && !inList);
  const textRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  useFormReset(rootRef, () => {
    setInner(defaultValue ?? "");
    setOtherPicked(false);
  });

  useEffect(() => {
    if (otherPicked) textRef.current?.focus();
  }, [otherPicked]);

  function set(v: string) {
    setInner(v);
    onChange?.(v);
  }

  return (
    <div ref={rootRef} className="space-y-2">
      {name && <input type="hidden" name={name} value={val} />}
      <Select
        value={showText ? OTHER : val}
        onChange={(v) => {
          if (v === OTHER) {
            setOtherPicked(true);
            if (inList) set("");
          } else {
            setOtherPicked(false);
            set(v);
          }
        }}
        options={[...opts, { value: OTHER, label: otherLabel }]}
        placeholder={placeholder}
        searchPlaceholder={searchPlaceholder}
        searchable={searchable}
        disabled={disabled}
      />
      {showText && (
        <input
          ref={textRef}
          value={val}
          onChange={(e) => set(e.target.value)}
          placeholder={otherPlaceholder}
          disabled={disabled}
          required={required}
          className="input w-full"
        />
      )}
      {!showText && required && <input tabIndex={-1} aria-hidden className="sr-only" required value={val} onChange={() => {}} />}
    </div>
  );
}
