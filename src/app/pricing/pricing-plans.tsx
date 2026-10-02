"use client";

import { useMemo, useState } from "react";
import { Check, X } from "lucide-react";
import { BookDemoButton } from "@/components/BookDemoButton";
import { Reveal } from "@/app/welcome/motion";
import s from "@/app/welcome/welcome.module.css";
import styles from "./pricing.module.css";

type Feature = { text: string; included?: boolean };

type Plan = {
  name: string;
  blurb: string;
  /** AED per month / per year; null = "Let's talk". */
  price: { monthly: number; yearly: number } | null;
  setupFee?: number;
  /** Members included in the monthly price; the estimator charges EXTRA_MEMBER_FEE beyond it. */
  memberLimit?: number;
  features: Feature[];
  cta: string;
  custom?: boolean;
  popular?: boolean;
};

export const EXTRA_MEMBER_FEE = 2.5;

const yes = (text: string): Feature => ({ text, included: true });
const no = (text: string): Feature => ({ text, included: false });

/** One place for the numbers, so the cards and the page's FAQ/description stay in step. */
export const PLANS: Plan[] = [
  {
    name: "Basic",
    blurb: "For suppliers getting their timesheets, payroll and paperwork out of spreadsheets.",
    price: { monthly: 500, yearly: 5500 },
    setupFee: 5000,
    memberLimit: 200,
    features: [
      yes("Up to 200 members, 1 company or branch"),
      yes("Timesheets, attendance and client billing"),
      yes("Payroll with WPS file"),
      yes("Camps, beds and transport"),
      yes("Document expiry alerts by email"),
      yes("Excel import with 30-day undo"),
      yes("Salary certificates and letters from templates"),
      yes("Data health score"),
      yes("Employee portal"),
      yes("Role-based permissions and audit log"),
      yes("Hosting and database included"),
      yes("Email support, reply within 2 business days"),
      yes("AI credits: 1,000 to start, then 300 a month"),
      yes("Data migration help"),
      yes("AED 2.5 per additional member beyond 200"),
      no("Supplier portal"),
      no("Dedicated account manager"),
    ],
    cta: "Get started",
  },
  {
    name: "Pro",
    blurb: "For a growing roster that works with suppliers and wants a named contact.",
    price: { monthly: 1000, yearly: 11000 },
    setupFee: 5000,
    memberLimit: 500,
    popular: true,
    features: [
      yes("Up to 500 members, up to 3 companies or branches"),
      yes("Everything in Basic"),
      yes("Supplier portal"),
      yes("Dedicated account manager"),
      yes("Email support, reply within 1 business day"),
      yes("AI credits: 2,500 to start, then 1,000 a month"),
      yes("Kickoff call and quarterly review call"),
      yes("AED 2.5 per additional member beyond 500"),
    ],
    cta: "Get started",
  },
  {
    name: "Custom",
    blurb: "If these plans don't fit, we'll build one that does, bigger or smaller.",
    price: null,
    features: [
      yes("Rosters beyond 500 members"),
      yes("Several companies or branches"),
      yes("Onboarding and data import planned with you"),
      yes("A quote built around your operation"),
    ],
    cta: "Book a call",
    custom: true,
  },
];

const aed = (n: number) => n.toLocaleString("en-AE");

export function PricingPlans() {
  const [yearly, setYearly] = useState(false);

  return (
    <section className={styles.wrap} aria-labelledby="pricing-title">
      <div className={s.container}>
        <Reveal as="div" className={styles.head} y={16}>
          <h1 id="pricing-title" className={styles.title}>
            Choose your right plan
          </h1>
          <p className={styles.sub}>
            Simple pricing around the size of your workforce. Need more or less? We&apos;ll shape a plan around you.
          </p>
        </Reveal>

        <div className={styles.toggle} role="group" aria-label="Billing period">
          <button type="button" className={`${styles.toggleBtn} ${!yearly ? styles.toggleOn : ""}`} aria-pressed={!yearly} onClick={() => setYearly(false)}>
            Monthly
          </button>
          <button type="button" className={`${styles.toggleBtn} ${yearly ? styles.toggleOn : ""}`} aria-pressed={yearly} onClick={() => setYearly(true)}>
            Annually (1 month free)
          </button>
        </div>

        <div className={styles.grid}>
          {PLANS.map((p, i) => (
            <Reveal key={p.name} as="div" className={styles.cell} y={24} delay={0.08 * i} amount={0.15}>
              <article className={`${styles.card} ${p.custom ? styles.cardCustom : ""} ${p.popular ? styles.cardPopular : ""}`}>
                {p.popular && <span className={styles.badge}>Most popular</span>}
                <span className={`${styles.pill} ${p.custom ? styles.pillLight : ""}`}>{p.name}</span>
                <p className={styles.blurb}>{p.blurb}</p>

                {p.price === null ? (
                  <p className={styles.talk}>Let&apos;s talk!</p>
                ) : (
                  <>
                    <div className={styles.priceRow}>
                      <span className={styles.currency}>AED</span>
                      <span className={styles.price}>{aed(yearly ? p.price.yearly : p.price.monthly)}</span>
                      <span className={styles.per}>{yearly ? "/year" : "/month"}</span>
                    </div>
                    <ul className={styles.fees}>
                      {p.setupFee != null && (
                        <li>
                          + <strong>AED {aed(p.setupFee)}</strong> setup fee*
                        </li>
                      )}
                      {yearly && <li>Billed once a year, 12 months for the price of 11</li>}
                    </ul>
                  </>
                )}

                <hr className={styles.rule} />
                <ul className={styles.list}>
                  {p.features.map((f) => (
                    <li key={f.text} className={f.included === false ? styles.off : undefined}>
                      {f.included === false ? <X size={18} strokeWidth={2.25} aria-hidden /> : <Check size={18} strokeWidth={2.25} aria-hidden />}
                      <span>
                        {f.included === false && <span className="sr-only">Not included: </span>}
                        {f.text}
                      </span>
                    </li>
                  ))}
                </ul>
                <hr className={styles.rule} />

                <BookDemoButton className={`${styles.cta} ${p.custom ? styles.ctaDark : ""}`}>{p.cta}</BookDemoButton>
              </article>
            </Reveal>
          ))}
        </div>

        <Estimator />

        <p className={styles.note}>
          * The setup fee is one-time, charged once when you start. Prices are in UAE dirhams. Beyond the members a plan includes, each additional member is AED 2.5.
        </p>
      </div>
    </section>
  );
}

const PAID = PLANS.filter((p): p is Plan & { price: { monthly: number; yearly: number }; memberLimit: number } => p.price !== null && p.memberLimit != null);

function monthlyCost(plan: (typeof PAID)[number], members: number) {
  const extra = Math.max(0, members - plan.memberLimit);
  return { base: plan.price.monthly, extra, extraCost: extra * EXTRA_MEMBER_FEE, total: plan.price.monthly + extra * EXTRA_MEMBER_FEE };
}

function Estimator() {
  const [members, setMembers] = useState(250);
  const rows = useMemo(() => PAID.map((p) => ({ plan: p, ...monthlyCost(p, members) })), [members]);
  const cheapest = Math.min(...rows.map((r) => r.total));
  const cheaperCount = rows.filter((r) => r.total === cheapest).length;
  const clamp = (n: number) => Math.max(1, Math.min(5000, Math.round(n) || 1));

  return (
    <div className={styles.est}>
      <div className={styles.estHead}>
        <h2 className={styles.estTitle}>Estimate your monthly cost</h2>
        <p className={styles.estSub}>Move the slider or type how many members you have.</p>
        <div className={styles.estInputs}>
          <input
            type="range"
            min={10}
            max={1000}
            step={10}
            value={Math.min(1000, Math.max(10, members))}
            onChange={(e) => setMembers(clamp(Number(e.target.value)))}
            className={styles.range}
            aria-label="Number of members"
          />
          <label className={styles.estNumber}>
            <input type="number" min={1} max={5000} value={members} onChange={(e) => setMembers(clamp(Number(e.target.value)))} aria-label="Members" />
            <span>members</span>
          </label>
        </div>
      </div>

      <div className={styles.estGrid}>
        {rows.map((r) => {
          const best = r.total === cheapest && cheaperCount === 1;
          return (
            <div key={r.plan.name} className={`${styles.estCard} ${best ? styles.estBest : ""}`}>
              <div className={styles.estTop}>
                <span className={styles.estName}>{r.plan.name}</span>
                {best && <span className={styles.estTag}>Lower monthly cost</span>}
              </div>
              <p className={styles.estTotal}>
                <span>AED</span> {r.total.toLocaleString("en-AE")}
                <small>/month</small>
              </p>
              <p className={styles.estMath}>
                AED {r.base.toLocaleString("en-AE")} plan
                {r.extra > 0 ? ` + ${r.extra.toLocaleString("en-AE")} extra members × AED ${EXTRA_MEMBER_FEE} = AED ${r.extraCost.toLocaleString("en-AE")}` : ` (covers up to ${r.plan.memberLimit} members)`}
              </p>
            </div>
          );
        })}
      </div>
      <p className={styles.estFoot}>
        {members > 1000
          ? "With this many members, talk to us about a Custom plan. "
          : cheaperCount > 1
            ? "Both plans cost the same here; Pro adds the supplier portal and a dedicated account manager. "
            : ""}
        Plus a one-time AED 5,000 setup fee on either plan. Estimates only.
      </p>
    </div>
  );
}
