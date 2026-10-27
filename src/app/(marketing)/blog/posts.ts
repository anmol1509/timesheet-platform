import type { ClusterSlug } from "./clusters";

export type Post = {
  slug: string;
  title: string;
  /** Shorter title for the <title> tag and share cards, when the headline passes about 60 characters. */
  seoTitle?: string;
  description: string;
  /** Publish date (ISO). */
  date: string;
  /** Last substantive edit (ISO); feeds the sitemap and Article dateModified. */
  updated?: string;
  /** Topic cluster the post belongs to, see clusters.ts. */
  cluster: ClusterSlug;
};

// Registry of published posts — the index page and the sitemap both read
// from this instead of each post's own page.tsx, so a new post only needs
// one line added here plus its own folder.
export const POSTS: readonly Post[] = [
  {
    slug: "wps-sif-rejection-reasons-uae",
    cluster: "payroll-wps",
    title: "Why Your WPS SIF File Gets Rejected (and How to Fix It)",
    description:
      "The most common reasons a UAE Wage Protection System salary file bounces back (IBAN mismatches, establishment ID errors and salary structure issues) and how to stop them recurring every month.",
    date: "2026-09-01",
  },
  {
    slug: "visa-emirates-id-expiry-compliance-checklist",
    cluster: "compliance",
    seoTitle: "Visa, Emirates ID & Labour Card Expiry Checklist (UAE)",
    title: "A Practical Checklist for Visa, Emirates ID and Labour Card Expiries",
    description:
      "How manpower suppliers in the UAE keep ahead of visa, Emirates ID, labour card and passport renewals across a large workforce, without finding out about a lapse from a fine.",
    date: "2026-08-15",
  },
  {
    slug: "eosb-gratuity-calculation-uae",
    cluster: "payroll-wps",
    title: "How End-of-Service Gratuity (EOSB) Is Calculated in the UAE",
    description:
      "The formula behind end-of-service gratuity under UAE labour law, what counts toward it and what doesn't, and why getting it wrong at scale is a payroll system problem, not a one-off mistake.",
    date: "2026-09-10",
  },
  {
    slug: "uae-overtime-rules-construction-workers",
    cluster: "payroll-wps",
    seoTitle: "UAE Overtime Rules for Construction Workers",
    title: "UAE Overtime Rules for Construction and Manpower Workers, Explained",
    description:
      "Daily and weekly working-hour limits, overtime rates, night-shift premiums and rest-day pay under UAE labour law. And how to apply them consistently across a large workforce.",
    date: "2026-09-18",
  },
  {
    slug: "labour-card-work-permit-visa-difference-uae",
    cluster: "compliance",
    seoTitle: "Labour Card vs Work Permit vs Visa in the UAE",
    title: "Labour Card vs Work Permit vs Visa: What's the Difference in the UAE?",
    description:
      "Three different documents, each tracked separately, each with its own expiry and its own consequence if it lapses. A plain-language guide for anyone managing a UAE workforce.",
    date: "2026-09-24",
  },
  {
    slug: "how-to-price-manpower-supply-uae-hourly-rate",
    cluster: "timesheets-billing",
    title: "How to Price Manpower Supply in the UAE: Building an Hourly Rate That Covers Your Costs",
    description:
      "Build an hourly rate for UAE manpower supply from salary, visa, camp, transport, gratuity, overhead and margin, with a worked example.",
    date: "2026-10-09",
  },
  {
    slug: "construction-timesheet-format-labour-supply-uae",
    cluster: "timesheets-billing",
    title: "Construction Timesheet Format for Labour Supply: What to Include, With a Layout You Can Copy",
    description:
      "The columns, attendance codes and sign-offs a client-ready labour supply timesheet needs in the UAE, and the mistakes that cause invoice disputes.",
    date: "2026-10-09",
  },
  {
    slug: "manpower-supply-software-uae-buyers-checklist",
    cluster: "operations-buying",
    title: "Manpower Supply Software in the UAE: 12 Questions to Ask Before You Buy",
    description:
      "A buyer's checklist for manpower and labour supply software in the UAE: WPS, timesheets, expiries, camps, client billing, portals, pricing and support.",
    date: "2026-10-09",
  },
  {
    slug: "stop-client-timesheet-disputes-labour-supply-invoices",
    cluster: "timesheets-billing",
    title: "How to Stop Client Timesheet Disputes on Labour Supply Invoices",
    description:
      "Why clients reject or short-pay labour supply invoices over hours, and the contract terms, sign-off steps and record-keeping that stop it happening.",
    date: "2026-10-14",
  },
  {
    slug: "labour-camp-occupancy-beds-checkins-cost-per-bed",
    cluster: "operations-buying",
    title: "Labour Camp Occupancy: Tracking Beds, Check-ins and Cost per Bed",
    description:
      "How to measure labour camp occupancy and cost per occupied bed, what records to keep, and the gaps that quietly inflate accommodation costs.",
    date: "2026-10-14",
  },
  {
    slug: "uae-gratuity-rules-eligibility",
    cluster: "payroll-wps",
    title: "UAE Gratuity Rules and Eligibility, Explained",
    description:
      "Who is entitled to end-of-service gratuity in the UAE: the one-year rule, what counts as basic salary, the cap, when it is paid and how free zones differ.",
    date: "2026-10-21",
  },
  {
    slug: "final-settlement-uae-labour-law",
    cluster: "payroll-wps",
    title: "Final Settlement in the UAE: What an Employee Is Owed",
    description:
      "What a final settlement in the UAE includes, from unpaid wages and gratuity to unused leave and notice pay, how to work it out and when it must be paid.",
    date: "2026-10-21",
  },
];



