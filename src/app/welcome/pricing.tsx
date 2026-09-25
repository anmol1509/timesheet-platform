"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { PLANS, demoHref } from "./content";
import s from "./welcome.module.css";

const ANNUAL_DISCOUNT = 0.8;

export function Pricing() {
  const [annual, setAnnual] = useState(true);

  return (
    <>
      <div className={s.sectionHead} style={{ marginBottom: 48 }}>
        <span className={s.eyebrow}>Pricing</span>
        <h2 id="pricing-title" className={s.h2}>
          Priced per active worker
        </h2>
        <p className={s.lead}>Pay only for the workers on your books each month. No setup fees on annual plans.</p>
        <div className={s.billing} role="group" aria-label="Billing period">
          <button type="button" aria-pressed={!annual} onClick={() => setAnnual(false)}>
            Monthly
          </button>
          <button type="button" aria-pressed={annual} onClick={() => setAnnual(true)}>
            Annual <span className={s.save}>Save 20%</span>
          </button>
        </div>
      </div>

      <div className={s.plans}>
        {PLANS.map((plan) => {
          const price = plan.monthly === null ? null : annual ? Math.round(plan.monthly * ANNUAL_DISCOUNT) : plan.monthly;
          return (
            <article key={plan.name} className={`${s.plan} ${plan.featured ? s.planFeatured : ""}`}>
              {plan.featured && <span className={s.popular}>Most popular</span>}
              <h3 className={s.planName}>{plan.name}</h3>
              <p className={s.planBlurb}>{plan.blurb}</p>
              <div className={s.price}>
                {price === null ? (
                  <b>Custom</b>
                ) : (
                  <>
                    <b>AED {price}</b>
                    <span>/ worker / month</span>
                  </>
                )}
              </div>
              <p className={s.priceNote}>
                {price === null ? "Volume pricing for 1,000+ workers" : annual ? "Billed annually" : "Billed monthly"}
              </p>
              <a
                href={demoHref}
                className={`${s.btn} ${s.btnBlock} ${plan.featured ? s.btnPrimary : s.btnSecondary}`}
              >
                {plan.cta}
              </a>
              <ul className={s.checkList}>
                {plan.features.map((f) => (
                  <li key={f}>
                    <Check size={16} className={s.yes} aria-hidden />
                    {f}
                  </li>
                ))}
              </ul>
            </article>
          );
        })}
      </div>
    </>
  );
}
