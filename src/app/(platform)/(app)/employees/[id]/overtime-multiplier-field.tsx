"use client";

import { useEffect, useRef, useState } from "react";
import { NumberInput } from "@/components/ui/NumberInput";
import { cn } from "@/lib/cn";

/** The multiplier is how many times the normal hourly rate one overtime hour pays; 1.25 is the usual figure. */
const USUAL = [
  { value: 1.25, label: "Normal overtime 1.25×" },
  { value: 1.5, label: "Rest day or holiday 1.5×" },
];

/**
 * The overtime multiplier with its meaning beside it: quick picks for the usual figures and a line that works out what one
 * overtime hour pays from the pay figures typed in the same form, so a rate typed in by mistake (4.17 instead of 1.25) shows.
 */
export function OvertimeMultiplierField({ defaultValue, payStructure }: { defaultValue: string | number; payStructure: string }) {
  const [value, setValue] = useState<string>(String(defaultValue ?? "1.25") || "1.25");
  const [hourly, setHourly] = useState(0);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const form = root.current?.closest("form");
    if (!form) return;
    const read = (name: string) => {
      const el = form.elements.namedItem(name) as HTMLInputElement | null;
      return Number(el?.value) || 0;
    };
    const work = () => {
      const hours = read("dailyHours") || 8;
      const rate = payStructure === "HOURLY" ? read("hourlyRate") : (payStructure === "FLAT" ? read("flatMonthlyRate") : read("basicSalary")) / 30 / hours;
      setHourly(Number.isFinite(rate) ? rate : 0);
    };
    work();
    form.addEventListener("input", work);
    return () => form.removeEventListener("input", work);
  }, [payStructure]);

  const m = Number(value);
  const bad = !Number.isFinite(m) || m < 1 || m > 3;
  const money = (n: number) => n.toFixed(2);

  return (
    <div ref={root} className="space-y-2">
      <NumberInput name="otMultiplier" value={value} onChange={(v) => setValue(v === "" ? "" : String(v))} min={1} step={0.05} className="w-full" />
      <div className="flex flex-wrap gap-1.5">
        {USUAL.map((u) => (
          <button
            key={u.value}
            type="button"
            onClick={() => setValue(String(u.value))}
            className={cn("rounded-full border px-2.5 py-1 text-xs transition", m === u.value ? "border-[var(--brand-primary)] bg-brand-soft text-primary" : "border-default text-secondary hover:bg-surface-subtle")}
          >
            {u.label}
          </button>
        ))}
      </div>
      {bad && <p className="text-xs text-[var(--error)]">This is a multiplier, not an hourly rate. It must be between 1 and 3; 1.25 is the usual figure for overtime.</p>}
      {hourly > 0 ? (
        <p className="text-xs text-muted">Normal hour: AED {money(hourly)}. One overtime hour pays <span className={cn("font-medium", bad ? "text-[var(--error)]" : "text-primary")}>AED {money(hourly * (Number.isFinite(m) ? m : 0))}</span> ({money(hourly)} × {Number.isFinite(m) ? m : 0}).</p>
      ) : !bad ? (
        <p className="text-xs text-muted">How many times the normal hourly rate one overtime hour pays. 1.25 is usual.</p>
      ) : null}
    </div>
  );
}
