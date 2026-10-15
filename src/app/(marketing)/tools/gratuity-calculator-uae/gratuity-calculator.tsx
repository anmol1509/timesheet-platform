"use client";

import { useState } from "react";
import { gratuityBreakdown, yearsOfService } from "@/lib/gratuity";
import s from "../calculator.module.css";
import { Field, NumberInput, aed } from "../calc-ui";

const toDate = (v: string) => (v ? new Date(`${v}T00:00:00.000Z`) : null);

function describeService(years: number): string {
  const whole = Math.floor(years);
  const months = Math.floor((years - whole) * 12);
  const parts = [];
  if (whole) parts.push(`${whole} year${whole === 1 ? "" : "s"}`);
  if (months) parts.push(`${months} month${months === 1 ? "" : "s"}`);
  return parts.join(" ") || "under a month";
}

/** Runs entirely in the browser: nothing typed here is sent anywhere. Starts with
 * example figures so the page shows a worked result before anyone types. */
export function GratuityCalculator() {
  const [basic, setBasic] = useState("3000");
  const [join, setJoin] = useState("2020-03-01");
  const [end, setEnd] = useState("2026-03-01");

  const basicN = parseFloat(basic);
  const joinD = toDate(join);
  const endD = toDate(end) ?? new Date();
  const ready = basicN > 0 && joinD !== null;
  const reversed = ready && joinD !== null && endD.getTime() <= joinD.getTime();
  const years = ready && joinD && !reversed ? yearsOfService(joinD, endD) : 0;
  const b = ready && !reversed ? gratuityBreakdown(basicN, years) : null;

  return (
    <div className={s.layout}>
      <div className={s.panel}>
        <h2 className={s.panelTitle}>Your figures</h2>
        <p className={s.panelHint}>Example values are filled in. Replace them with the employee&rsquo;s.</p>
        <div className={s.fields}>
          <Field id="basic" label="Last basic monthly salary (AED)" hint="Basic only. Leave out housing, transport and other allowances.">
            <NumberInput id="basic" value={basic} onChange={setBasic} placeholder="e.g. 3000" />
          </Field>
          <div className={s.fieldPair}>
            <Field id="join" label="Joining date">
              <input id="join" className={s.input} type="date" value={join} onChange={(e) => setJoin(e.target.value)} />
            </Field>
            <Field id="end" label="Last working day" hint="Leave blank to use today.">
              <input id="end" className={s.input} type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
            </Field>
          </div>
        </div>
      </div>

      <div className={`${s.panel} ${s.result}`} aria-live="polite">
        <h2 className={s.panelTitle}>Estimated gratuity</h2>
        {!ready && <p className={s.warn}>Enter the basic salary and joining date to see the result.</p>}
        {reversed && <p className={s.warn}>The last working day must be after the joining date.</p>}
        {b && (
          <>
            <p className={s.big}>{aed(b.total)}</p>
            <p className={s.bigLabel}>for {describeService(years)} of service</p>
            {!b.eligible ? (
              <p className={s.note}>
                Gratuity is due after at least one full year of continuous service, so nothing accrues yet.
              </p>
            ) : (
              <ul className={s.rows}>
                <li className={s.row}><span>Daily basic wage (basic ÷ 30)</span><strong>{aed(b.dailyBasic)}</strong></li>
                <li className={s.row}>
                  <span>First {b.firstYears.toFixed(2)} years × 21 days</span><strong>{aed(b.firstAmount)}</strong>
                </li>
                {b.beyondYears > 0 && (
                  <li className={s.row}>
                    <span>Next {b.beyondYears.toFixed(2)} years × 30 days</span><strong>{aed(b.beyondAmount)}</strong>
                  </li>
                )}
                <li className={s.row}><span>Total before cap</span><strong>{aed(b.uncapped)}</strong></li>
                <li className={s.row}><span>Cap (2 years&rsquo; basic)</span><strong>{aed(b.cap)}</strong></li>
                <li className={`${s.row} ${s.rowTotal}`}><span>Gratuity payable</span><strong>{aed(b.total)}</strong></li>
              </ul>
            )}
            {b.capApplied && <p className={s.note}>The two-year cap applies, so the amount is limited to {aed(b.cap)}.</p>}
          </>
        )}
        <p className={s.note}>
          An estimate for planning, not legal advice. Unpaid leave periods, contract terms and free-zone rules can change the final settlement.
        </p>
      </div>
    </div>
  );
}
