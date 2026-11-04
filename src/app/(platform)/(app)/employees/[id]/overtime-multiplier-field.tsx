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
export function OvertimeMultiplierField({ defaultValue, defaultFixed, payStructure }: { defaultValue: string | number; defaultFixed?: string | number; payStructure: string }) {
  const [value, setValue] = useState<string>(String(defaultValue ?? "1.25") || "1.25");
  const [hourly, setHourly] = useState(0);
  const [mode, setMode] = useState<"MULTIPLIER" | "FIXED">(Number(defaultFixed) > 0 ? "FIXED" : "MULTIPLIER");
  const [fixed, setFixed] = useState<string>(Number(defaultFixed) > 0 ? String(defaultFixed) : "");
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
      <div role="radiogroup" aria-label="How overtime is paid" className="inline-flex rounded-lg border border-default bg-surface-subtle p-0.5 text-xs">
        {([["MULTIPLIER", "Times the normal rate"], ["FIXED", "Fixed AED per overtime hour"]] as const).map(([k, label]) => (
          <button key={k} type="button" role="radio" aria-checked={mode === k} onClick={() => setMode(k)}
            className={cn("rounded-md px-3 py-1.5 font-medium transition", mode === k ? "bg-surface text-primary shadow-sm" : "text-secondary hover:text-primary")}>
            {label}
          </button>
        ))}
      </div>
      <input type="hidden" name="otMode" value={mode} />
      {mode === "MULTIPLIER" ? (
        <>
          <NumberInput name="otMultiplier" value={value} onChange={(v) => setValue(v === "" ? "" : String(v))} min={1} step={0.01} className="w-full" />
          <div className="flex flex-wrap gap-1.5">
            {USUAL.map((u) => (
              <button key={u.value} type="button" onClick={() => setValue(String(u.value))}
                className={cn("rounded-full border px-2.5 py-1 text-xs transition", m === u.value ? "border-[var(--brand-primary)] bg-brand-soft text-primary" : "border-default text-secondary hover:bg-surface-subtle")}>
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
        </>
      ) : (
        <>
          <NumberInput name="otHourlyRate" value={fixed} onChange={(v) => setFixed(v === "" ? "" : String(v))} min={0} step={0.25} placeholder="e.g. 5.00" className="w-full" />
          {Number(fixed) > 0 ? (
            <p className="text-xs text-muted">Every overtime hour pays <span className="font-medium text-primary">AED {money(Number(fixed))}</span>{hourly > 0 ? <>, which is {(Number(fixed) / hourly).toFixed(2)}× the normal hour (AED {money(hourly)}).</> : "."}</p>
          ) : null}
          {Number(fixed) > 0 && hourly > 0 && Number(fixed) < hourly ? (
            <p className="text-xs text-[var(--warning)]">This is less than a normal hour (AED {money(hourly)}). Check it is the full amount for one overtime hour.</p>
          ) : null}
          {!(Number(fixed) > 0) && <p className="text-xs text-muted">The amount paid for each overtime hour, in AED. The multiplier is not used.</p>}
        </>
      )}
    </div>
  );
}
