"use client";

import { useState } from "react";
import { gratuityBreakdown, yearsOfService } from "@/lib/gratuity";
import s from "../../../tools/calculator.module.css";
import { Field, NumberInput } from "../../../tools/calc-ui";

const toDate = (v: string) => (v ? new Date(`${v}T00:00:00.000Z`) : null);
const dirham = (n: number) => `${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} درهم`;

function describeService(years: number): string {
  const whole = Math.floor(years);
  const months = Math.floor((years - whole) * 12);
  const parts = [];
  if (whole) parts.push(whole === 1 ? "سنة واحدة" : whole === 2 ? "سنتين" : whole <= 10 ? `${whole} سنوات` : `${whole} سنة`);
  if (months) parts.push(months === 1 ? "شهر واحد" : months === 2 ? "شهرين" : months <= 10 ? `${months} أشهر` : `${months} شهراً`);
  return parts.join(" و") || "أقل من شهر";
}

/** The Arabic twin of the English calculator: the same formula, run in the browser, with Arabic wording. */
export function GratuityCalculatorAr() {
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
        <h2 className={s.panelTitle}>بياناتك</h2>
        <p className={s.panelHint}>القيم الظاهرة مجرد مثال. استبدلها ببيانات الموظف.</p>
        <div className={s.fields}>
          <Field id="basic" label="آخر راتب أساسي شهري (درهم)" hint="الراتب الأساسي فقط، دون بدل السكن أو المواصلات أو غيرها من البدلات.">
            <NumberInput id="basic" value={basic} onChange={setBasic} placeholder="مثال: 3000" />
          </Field>
          <div className={s.fieldPair}>
            <Field id="join" label="تاريخ الالتحاق">
              <input id="join" className={s.input} type="date" value={join} onChange={(e) => setJoin(e.target.value)} />
            </Field>
            <Field id="end" label="آخر يوم عمل" hint="اتركه فارغاً لاستخدام تاريخ اليوم.">
              <input id="end" className={s.input} type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
            </Field>
          </div>
        </div>
      </div>

      <div className={`${s.panel} ${s.result}`} aria-live="polite">
        <h2 className={s.panelTitle}>مكافأة نهاية الخدمة التقديرية</h2>
        {!ready && <p className={s.warn}>أدخل الراتب الأساسي وتاريخ الالتحاق لعرض النتيجة.</p>}
        {reversed && <p className={s.warn}>يجب أن يكون آخر يوم عمل بعد تاريخ الالتحاق.</p>}
        {b && (
          <>
            <p className={s.big} dir="ltr">{dirham(b.total)}</p>
            <p className={s.bigLabel}>عن مدة خدمة {describeService(years)}</p>
            {!b.eligible ? (
              <p className={s.note}>تُستحق المكافأة بعد إكمال سنة كاملة على الأقل من الخدمة المتصلة، ولذلك لا يُحتسب شيء حتى الآن.</p>
            ) : (
              <ul className={s.rows}>
                <li className={s.row}><span>أجر اليوم الأساسي (الراتب الأساسي ÷ 30)</span><strong dir="ltr">{dirham(b.dailyBasic)}</strong></li>
                <li className={s.row}>
                  <span>أول {b.firstYears.toFixed(2)} سنة × 21 يوماً</span><strong dir="ltr">{dirham(b.firstAmount)}</strong>
                </li>
                {b.beyondYears > 0 && (
                  <li className={s.row}>
                    <span>السنوات التالية {b.beyondYears.toFixed(2)} × 30 يوماً</span><strong dir="ltr">{dirham(b.beyondAmount)}</strong>
                  </li>
                )}
                <li className={s.row}><span>المجموع قبل الحد الأقصى</span><strong dir="ltr">{dirham(b.uncapped)}</strong></li>
                <li className={s.row}><span>الحد الأقصى (راتب سنتين)</span><strong dir="ltr">{dirham(b.cap)}</strong></li>
                <li className={`${s.row} ${s.rowTotal}`}><span>المكافأة المستحقة</span><strong dir="ltr">{dirham(b.total)}</strong></li>
              </ul>
            )}
            {b.capApplied && <p className={s.note}>انطبق الحد الأقصى، فيقتصر المبلغ على {dirham(b.cap)}.</p>}
          </>
        )}
        <p className={s.note}>
          تقدير للتخطيط وليس استشارة قانونية. قد تغيّر فترات الإجازة بدون راتب وشروط العقد وأنظمة المناطق الحرة التسوية النهائية.
        </p>
      </div>
    </div>
  );
}
