"use client";

import { useState } from "react";
import { NumberInput } from "@/components/ui/NumberInput";
import { Select } from "@/components/ui/Select";
import { absenceCap, absenceDayAmount, extraDaysCharged, round2, type PayProfile } from "@/lib/payroll";

export type AbsenceValues = {
  freeDays: number;
  method: string;
  perDay: number;
  percent: number;
};

type Props = {
  monthly: AbsenceValues;
  hourly: AbsenceValues;
  base: string;
  divisor: string;
  capPercent: number | null;
  extraAfterDays: number | null;
  extraPercent: number;
};

const aed = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const METHODS = [
  { value: "FIXED", label: "A fixed AED amount per day" },
  { value: "PERCENT", label: "A percentage of the day's pay" },
];

/**
 * How days off are charged, for an own company's two kinds of worker. Each kind has its own free days, method and amount; the pay
 * a day is worked out from and the monthly limit are shared. A worked example under each group shows what the settings mean.
 */
export function AbsenceRuleFields(p: Props) {
  const [monthly, setMonthly] = useState(p.monthly);
  const [hourly, setHourly] = useState(p.hourly);
  const [base, setBase] = useState(p.base === "BASIC" ? "BASIC" : "GROSS");
  const [divisor, setDivisor] = useState(p.divisor === "MONTH" ? "MONTH" : "30");
  const [cap, setCap] = useState<string>(p.capPercent ? String(p.capPercent) : "");
  const capNum = Number(cap) > 0 ? Number(cap) : null;
  const [extraAfter, setExtraAfter] = useState<string>(p.extraAfterDays == null ? "" : String(p.extraAfterDays));
  const [extraPct, setExtraPct] = useState<number>(p.extraPercent);
  const extraOn = extraAfter !== "" && Number(extraAfter) >= 0;

  const profile = (v: AbsenceValues, hourlyW = false): PayProfile => ({
    payStructure: "ITEMISED", basic: 1500, housing: 500, food: 0, transport: 0, other: 0, flat: 0, hourly: 10, paysOvertime: false, otMultiplier: 1.25,
    absenceFreeDays: v.freeDays, absencePerDay: v.perDay, absenceMethod: v.method === "PERCENT" ? "PERCENT" : "FIXED", absencePercent: v.percent,
    absenceBase: base === "BASIC" ? "BASIC" : "GROSS", absenceDivisor: divisor === "MONTH" ? "MONTH" : "30", absenceCapPercent: capNum,
    absenceExtraAfterDays: !hourlyW && extraOn ? Number(extraAfter) : null, absenceExtraPercent: extraPct,
  });

  // Examples: a monthly worker on 1,500 basic + 500 allowances with 5 days off in a 31-day month; an hourly worker on AED 10 an hour, 8 hours a day, 5 days off.
  const example = (v: AbsenceValues, hourlyWorker: boolean) => {
    const charged = Math.max(0, 5 - v.freeDays);
    const pr = profile(v, hourlyWorker);
    const day = absenceDayAmount(pr, hourlyWorker ? { basic: 0, monthlyFixed: 0, daysInMonth: 31, hourlyDayPay: 80 } : { basic: 1500, monthlyFixed: 2000, daysInMonth: 31 });
    const pay = hourlyWorker ? 208 * 10 : 2000;
    const cappedTo = absenceCap(pr, pay);
    const extraDays = hourlyWorker ? 0 : extraDaysCharged(pr, 5, charged);
    const raw = round2(charged * day + extraDays * day * (extraPct / 100));
    const who = hourlyWorker ? "an hourly worker on AED 10 an hour (8-hour days)" : "a worker on AED 1,500 basic + AED 500 allowances";
    return `Example: ${who}, 5 days off in a month: ${v.freeDays} free, ${charged} charged at AED ${aed(day)}${extraDays ? `, ${extraDays} of them with an extra ${extraPct}%` : ""} = AED ${aed(raw)}${cappedTo !== null && raw > cappedTo ? `, held to the limit of AED ${aed(cappedTo)}` : ""}.`;
  };

  const group = (title: string, v: AbsenceValues, set: (v: AbsenceValues) => void, names: { free: string; method: string; perDay: string; percent: string }, hourlyWorker: boolean) => (
    <div className="space-y-3 rounded-card border border-default p-4 sm:col-span-2">
      <p className="text-sm font-semibold text-primary">{title}</p>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">Days off each month with no deduction</span>
          <NumberInput name={names.free} value={v.freeDays} onChange={(n) => set({ ...v, freeDays: n === "" ? 0 : n })} min={0} max={31} step={1} className="w-full" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">After that, a day off costs</span>
          <Select name={names.method} value={v.method} onChange={(m) => set({ ...v, method: m })} searchable={false} options={METHODS} />
        </label>
        {v.method === "PERCENT" ? (
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">Percent of the day&apos;s pay (100 = the whole day)</span>
            <NumberInput name={names.percent} value={v.percent} onChange={(n) => set({ ...v, percent: n === "" ? 0 : n })} min={0} max={500} step={0.01} className="w-full" />
          </label>
        ) : (
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">AED per day off</span>
            <NumberInput name={names.perDay} value={v.perDay} onChange={(n) => set({ ...v, perDay: n === "" ? 0 : n })} min={0} step={0.01} className="w-full" />
          </label>
        )}
      </div>
      {/* the figure of the method that is not shown still travels with the form, so switching back loses nothing */}
      {v.method === "PERCENT" ? <input type="hidden" name={names.perDay} value={v.perDay} /> : <input type="hidden" name={names.percent} value={v.percent} />}
      {!hourlyWorker && v.method === "PERCENT" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">A day&apos;s pay is worked out from</span>
            <Select name="absentBase" value={base} onChange={setBase} searchable={false} options={[{ value: "GROSS", label: "Basic plus allowances" }, { value: "BASIC", label: "Basic only" }]} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">…divided by</span>
            <Select name="absentDivisor" value={divisor} onChange={setDivisor} searchable={false} options={[{ value: "30", label: "30 days" }, { value: "MONTH", label: "The days in that month" }]} />
          </label>
        </div>
      )}
      {!hourlyWorker && v.method !== "PERCENT" && (<><input type="hidden" name="absentBase" value={base} /><input type="hidden" name="absentDivisor" value={divisor} /></>)}
      {hourlyWorker && v.method === "PERCENT" && <p className="text-xs text-muted">For an hourly worker a day&apos;s pay is their standard hours in a day times their hourly rate.</p>}
      {!hourlyWorker && (
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">Extra charge once more than this many days are off (blank = none)</span>
            <NumberInput name="absentExtraAfterDays" value={extraAfter} onChange={(n) => setExtraAfter(n === "" ? "" : String(n))} min={0} max={31} step={1} className="w-full" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">Each further day off costs an extra (percent of its charge, 100 = double)</span>
            <NumberInput name="absentExtraPercent" value={extraPct} onChange={(n) => setExtraPct(n === "" ? 0 : n)} min={0} max={1000} step={0.01} className="w-full" disabled={!extraOn} />
            {!extraOn && <input type="hidden" name="absentExtraPercent" value={extraPct} />}
          </label>
        </div>
      )}
      <p className="text-xs text-muted">{example(v, hourlyWorker)}</p>
    </div>
  );

  return (
    <>
      {group("Payroll: days off, monthly-salary workers", monthly, setMonthly, { free: "absentFreeDays", method: "absentMethod", perDay: "absentDeductionPerDay", percent: "absentPercent" }, false)}
      {group("Payroll: days off, hourly workers", hourly, setHourly, { free: "absentFreeDaysHourly", method: "absentMethodHourly", perDay: "absentDeductionPerDayHourly", percent: "absentPercentHourly" }, true)}
      <label className="block sm:col-span-2">
        <span className="mb-1 block text-xs font-medium text-muted">Most that days off may take in a month, as a percent of the worker&apos;s pay (blank = no limit)</span>
        <NumberInput name="absentCapPercent" value={cap} onChange={(n) => setCap(n === "" ? "" : String(n))} min={0} max={100} step={0.5} className="w-full sm:w-64" />
        <span className="mt-1 block text-xs text-muted">UAE labour rules limit fines and total deductions: confirm the limit with your HR or legal adviser before setting one.</span>
      </label>
    </>
  );
}
