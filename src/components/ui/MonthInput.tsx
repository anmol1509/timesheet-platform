"use client";

import { useRef, useState } from "react";
import { useFormReset } from "@/lib/useFormReset";
import { Select } from "./Select";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** Month + year picker that submits "YYYY-MM", the same value `type="month"` gave. */
export function MonthInput({ name, value: controlled, defaultValue, onChange, required, disabled, fromYear, toYear, className }: { name?: string; value?: string; defaultValue?: string | null; onChange?: (v: string) => void; required?: boolean; disabled?: boolean; fromYear?: number; toYear?: number; className?: string }) {
  const [inner, setInner] = useState(defaultValue ?? "");
  const val = controlled ?? inner;
  const rootRef = useRef<HTMLDivElement>(null);
  useFormReset(rootRef, () => setInner(defaultValue ?? ""));
  const [y, m] = val.split("-");
  const now = new Date().getFullYear();
  const years = Array.from({ length: (toYear ?? now + 2) - (fromYear ?? now - 8) + 1 }, (_, i) => String((toYear ?? now + 2) - i));
  const emit = (year: string, month: string) => {
    const next = year && month ? `${year}-${month}` : "";
    setInner(next);
    onChange?.(next);
  };
  return (
    <div ref={rootRef} className={`flex gap-2 ${className ?? ""}`}>
      {name && <input type="hidden" name={name} value={val} />}
      <div className="min-w-0 flex-[3]"><Select value={m ?? ""} onChange={(v) => emit(y || String(now), v)} searchable={false} disabled={disabled} placeholder="Month" options={MONTHS.map((n, i) => ({ value: String(i + 1).padStart(2, "0"), label: n }))} /></div>
      <div className="min-w-0 flex-[2]"><Select value={y ?? ""} onChange={(v) => emit(v, m || "01")} searchable={false} disabled={disabled} placeholder="Year" options={years.map((yr) => ({ value: yr, label: yr }))} /></div>
      {required && !val && <input tabIndex={-1} aria-hidden className="sr-only" required value="" onChange={() => {}} />}
    </div>
  );
}
