"use client";

import { Check } from "lucide-react";
import { BookDemoButton } from "@/components/BookDemoButton";
import { Reveal } from "@/app/welcome/motion";
import s from "@/app/welcome/welcome.module.css";
import styles from "./pricing.module.css";

type Plan = {
  name: string;
  blurb: string;
  /** Monthly price in AED; null = "Let's talk". */
  price: number | null;
  setupFee?: number;
  /** Lines under the price, e.g. hosting. */
  fees?: React.ReactNode[];
  features: string[];
  cta: string;
  custom?: boolean;
};

/** One place for the numbers, so the cards and the page's FAQ/description stay in step. */
export const PLANS: Plan[] = [
  {
    name: "Basic",
    blurb: "For suppliers getting their timesheets, payroll and paperwork out of spreadsheets.",
    price: 500,
    setupFee: 5000,
    fees: ["Hosting & database charges billed separately"],
    features: [
      "Up to 200 members",
      "Timesheets, attendance and client billing",
      "Payroll with WPS file",
      "Camps, transport and documents",
      "Employee and supplier portals",
      "Role-based permissions and audit log",
      "AED 2.5 per additional member beyond 200",
    ],
    cta: "Get started",
  },
  {
    name: "Pro",
    blurb: "For a growing roster that wants hosting and database taken care of.",
    price: 1000,
    setupFee: 5000,
    fees: ["Hosting & database charges included"],
    features: [
      "Up to 500 members",
      "Everything in Basic",
      "AED 2.5 per additional member beyond 500",
    ],
    cta: "Get started",
  },
  {
    name: "Custom",
    blurb: "If these plans don't fit, we'll build one that does, bigger or smaller.",
    price: null,
    features: [
      "Rosters beyond 500 members",
      "Several companies or branches",
      "Onboarding and data import planned with you",
      "A quote built around your operation",
    ],
    cta: "Book a call",
    custom: true,
  },
];

const aed = (n: number) => n.toLocaleString("en-AE");

export function PricingPlans() {
  return (
    <section className={styles.wrap} aria-labelledby="pricing-title">
      <div className={s.container}>
        <Reveal as="div" className={styles.head} y={16}>
          <h1 id="pricing-title" className={styles.title}>
            Choose your right plan
          </h1>
          <p className={styles.sub}>
            Simple pricing around the size of your workforce. Every plan includes the full platform. Need more or less? We&apos;ll shape one around you.
          </p>
        </Reveal>

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
                      <span className={styles.price}>{aed(p.price)}</span>
                      <span className={styles.per}>/month</span>
                    </div>
                    <ul className={styles.fees}>
                      {p.setupFee != null && (
                        <li>
                          <strong>AED {aed(p.setupFee)}</strong> one-time setup fee
                        </li>
                      )}
                      {p.fees?.map((f, k) => <li key={k}>{f}</li>)}
                    </ul>
                  </>
                )}

                <hr className={styles.rule} />
                <ul className={styles.list}>
                  {p.features.map((f) => (
                    <li key={f}>
                      <Check size={18} strokeWidth={2.25} aria-hidden />
                      <span>{f}</span>
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
          Prices are in UAE dirhams. Beyond the members a plan includes, each additional member is AED 2.5.
        </p>
      </div>
    </section>
  );
}
