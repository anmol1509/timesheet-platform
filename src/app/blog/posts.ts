// Registry of published posts — the index page and the sitemap both read
// from this instead of each post's own page.tsx, so a new post only needs
// one line added here plus its own folder.
export const POSTS = [
  {
    slug: "wps-sif-rejection-reasons-uae",
    title: "Why Your WPS SIF File Gets Rejected (and How to Fix It)",
    description:
      "The most common reasons a UAE Wage Protection System salary file bounces back — IBAN mismatches, establishment ID errors, and salary structure issues — and how to stop them recurring every month.",
    date: "2026-09-01",
  },
  {
    slug: "visa-emirates-id-expiry-compliance-checklist",
    title: "A Practical Checklist for Visa, Emirates ID and Labour Card Expiries",
    description:
      "How manpower suppliers in the UAE keep ahead of visa, Emirates ID, labour card and passport renewals across a large workforce, without finding out about a lapse from a fine.",
    date: "2026-08-15",
  },
  {
    slug: "eosb-gratuity-calculation-uae",
    title: "How End-of-Service Gratuity (EOSB) Is Calculated in the UAE",
    description:
      "The formula behind end-of-service gratuity under UAE labour law, what counts toward it and what doesn't, and why getting it wrong at scale is a payroll system problem, not a one-off mistake.",
    date: "2026-09-10",
  },
  {
    slug: "uae-overtime-rules-construction-workers",
    title: "UAE Overtime Rules for Construction and Manpower Workers, Explained",
    description:
      "Daily and weekly working-hour limits, overtime rates, night-shift premiums and rest-day pay under UAE labour law — and how to apply them consistently across a large workforce.",
    date: "2026-09-18",
  },
  {
    slug: "labour-card-work-permit-visa-difference-uae",
    title: "Labour Card vs Work Permit vs Visa: What's the Difference in the UAE?",
    description:
      "Three different documents, each tracked separately, each with its own expiry and its own consequence if it lapses — a plain-language guide for anyone managing a UAE workforce.",
    date: "2026-09-24",
  },
] as const;

export type Post = (typeof POSTS)[number];
