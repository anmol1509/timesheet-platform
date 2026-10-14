"use client";

import { useState } from "react";
import { hourlyRate } from "@/lib/ratePricing";
import s from "../calculator.module.css";
import { Field, NumberInput, aed } from "../calc-ui";

const COSTS = [
  { key: "salaryAndAllowances", label: "Salary and allowances", hint: "Basic plus housing, food, transport and other fixed allowances.", start: "1500" },
  { key: "visaAndPermits", label: "Visa, ID, labour card and insurance", hint: "Per month: total cost ÷ months the documents last.", start: "120" },
  { key: "accommodation", label: "Accommodation", hint: "Camp cost ÷ beds you actually fill.", start: "200" },
  { key: "transport", label: "Transport", hint: "Buses, drivers and fuel, per worker.", start: "150" },
  { key: "foodAndConsumables", label: "Food, gas and consumables", start: "100" },
  { key: "gratuityProvision", label: "End-of-service gratuity provision", start: "100" },
  { key: "leaveAndTicketProvision", label: "Annual leave and air ticket provision", start: "100" },
] as const;

type CostKey = (typeof COSTS)[number]["key"];

/** Runs entirely in the browser. Starts with the worked example from the pricing guide. */
export function RateCalculator() {
  const [costs, setCosts] = useState<Record<CostKey, string>>(
    () => Object.fromEntries(COSTS.map((c) => [c.key, c.start])) as Record<CostKey, string>,
  );
  const [overhead, setOverhead] = useState("10");
  const [margin, setMargin] = useState("15");
  const [paidHours, setPaidHours] = useState("208");
  const [unbilled, setUnbilled] = useState("8");

  const n = (v: string) => parseFloat(v) || 0;
  const r = hourlyRate({
    ...(Object.fromEntries(COSTS.map((c) => [c.key, n(costs[c.key])])) as Record<CostKey, number>),
    overheadPct: n(overhead),
    marginPct: n(margin),
    paidHours: n(paidHours),
    unbilledPct: n(unbilled),
  });
  const lost = r.rate > 0 ? r.rate - r.rateOnPaidHours : 0;

  return (
    <div className={s.layout}>
      <div className={s.panel}>
        <h2 className={s.panelTitle}>Monthly cost per worker</h2>
        <p className={s.panelHint}>Example values are filled in. Replace them with your own costs, in AED.</p>
        <div className={s.fields}>
          {COSTS.map((c) => (
            <Field key={c.key} id={c.key} label={c.label} hint={"hint" in c ? c.hint : undefined}>
              <NumberInput id={c.key} value={costs[c.key]} onChange={(v) => setCosts((p) => ({ ...p, [c.key]: v }))} />
            </Field>
          ))}
          <div className={s.fieldPair}>
            <Field id="overhead" label="Overhead (% of direct cost)">
              <NumberInput id="overhead" value={overhead} onChange={setOverhead} />
            </Field>
            <Field id="margin" label="Margin (% of total cost)">
              <NumberInput id="margin" value={margin} onChange={setMargin} />
            </Field>
          </div>
          <div className={s.fieldPair}>
            <Field id="hours" label="Paid hours per month" hint="26 days × 8 hours = 208.">
              <NumberInput id="hours" value={paidHours} onChange={setPaidHours} />
            </Field>
            <Field id="unbilled" label="Unbilled hours (%)" hint="Absence, unpaid holidays, waiting time.">
              <NumberInput id="unbilled" value={unbilled} onChange={setUnbilled} />
            </Field>
          </div>
        </div>
      </div>

      <div className={`${s.panel} ${s.result}`} aria-live="polite">
        <h2 className={s.panelTitle}>Rate to charge</h2>
        {r.rate > 0 ? (
          <>
            <p className={s.big}>{aed(r.rate)}</p>
            <p className={s.bigLabel}>per billable hour</p>
            <ul className={s.rows}>
              <li className={s.row}><span>Direct cost</span><strong>{aed(r.direct)}</strong></li>
              <li className={s.row}><span>Overhead</span><strong>{aed(r.overhead)}</strong></li>
              <li className={s.row}><span>Total cost</span><strong>{aed(r.totalCost)}</strong></li>
              <li className={s.row}><span>Margin</span><strong>{aed(r.margin)}</strong></li>
              <li className={`${s.row} ${s.rowTotal}`}><span>Monthly price per worker</span><strong>{aed(r.monthlyPrice)}</strong></li>
              <li className={s.row}><span>Billable hours per month</span><strong>{r.billableHours.toFixed(1)}</strong></li>
            </ul>
            {lost > 0.005 && (
              <p className={s.note}>
                If every paid hour were billed the rate would be {aed(r.rateOnPaidHours)}. Unbilled hours add {aed(lost)} to the rate on every hour you do bill.
              </p>
            )}
          </>
        ) : (
          <p className={s.warn}>Enter at least one cost and the paid hours per month to see a rate.</p>
        )}
        <p className={s.note}>An estimate to sanity-check a quote. Your real costs, payment terms and client mix will move it.</p>
      </div>
    </div>
  );
}
