"use client";

import { useState } from "react";
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
  features: Feature[];
  cta: string;
  custom?: boolean;
};

const yes = (text: string): Feature => ({ text, included: true });
const no = (text: string): Feature => ({ text, included: false });

/** One place for the numbers, so the cards and the page's FAQ/description stay in step. */
export const PLANS: Plan[] = [
  {
    name: "Basic",
    blurb: "For suppliers getting their timesheets, payroll and paperwork out of spreadsheets.",
    price: { monthly: 500, yearly: 5500 },
    setupFee: 5000,
    features: [
      yes("Up to 200 members"),
      yes("Timesheets, attendance and client billing"),
      yes("Payroll with WPS file"),
      yes("Camps, transport and documents"),
      yes("Employee portal"),
      yes("Role-based permissions and audit log"),
      yes("Hosting and database included"),
      yes("Email support"),
      yes("Limited AI credits"),
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
    features: [
      yes("Up to 500 members"),
      yes("Everything in Basic"),
      yes("Supplier portal"),
      yes("Dedicated account manager"),
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
              <article className={`${styles.card} ${p.custom ? styles.cardCustom : ""}`}>
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

        <p className={styles.note}>
          * The setup fee is one-time, charged once when you start. Prices are in UAE dirhams. Beyond the members a plan includes, each additional member is AED 2.5.
        </p>
      </div>
    </section>
  );
}
