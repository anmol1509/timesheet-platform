// Registry of free calculators at /tools/<slug>. The hub, the sitemap, the
// footer and the Resources menu all read from this, so a new tool is one entry
// here plus its own folder.
export const TOOLS = [
  {
    slug: "gratuity-calculator-uae",
    label: "UAE gratuity calculator",
    title: "UAE Gratuity Calculator (End of Service)",
    description:
      "Free UAE end-of-service gratuity calculator. Enter basic salary and service dates for the amount under Federal Decree-Law 33 of 2021, with the working shown.",
    updated: "2026-10-14",
  },
  {
    slug: "manpower-hourly-rate-calculator",
    label: "Manpower hourly rate calculator",
    title: "Manpower Supply Hourly Rate Calculator (UAE)",
    description:
      "Free calculator for the hourly rate to charge for UAE manpower supply: salary, visa, camp, transport, gratuity, overhead and margin, spread over billable hours.",
    updated: "2026-10-14",
  },
] as const;

export type Tool = (typeof TOOLS)[number];
