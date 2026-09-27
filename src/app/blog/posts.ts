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
] as const;

export type Post = (typeof POSTS)[number];
