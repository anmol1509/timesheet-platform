// Registry of free calculators at /tools/<slug>. The hub, the sitemap, the
// footer and the Resources menu all read from this, so a new tool is one entry
// here plus its own folder.
export const TOOLS = [
  {
    slug: "gratuity-calculator-uae",
    label: "UAE gratuity calculator",
    title: "UAE Gratuity Calculator (Dubai, Abu Dhabi)",
    description:
      "Free UAE gratuity and end-of-service calculator for Dubai, Abu Dhabi and the other emirates. Enter basic salary and dates for the amount under Decree-Law 33 of 2021.",
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
  {
    slug: "wps-sif-file-checker",
    label: "WPS SIF file checker",
    title: "WPS SIF File Checker (Free, UAE)",
    description:
      "Free WPS SIF file checker for UAE payroll. Paste or upload a salary file and see totals, IBAN, date and format problems before your bank rejects it.",
    updated: "2026-10-21",
  },
  {
    slug: "uae-iban-validator",
    label: "UAE IBAN validator",
    title: "UAE IBAN Validator (Free Checker)",
    description:
      "Check a UAE IBAN instantly: length, AE format and check digits, with the exact mistake if it is wrong. Validate a whole list of IBANs for a payroll file at once.",
    updated: "2026-10-21",
  },
  {
    slug: "construction-timesheet-template",
    label: "Labour supply timesheet template",
    title: "Labour Supply Timesheet Template (Excel & PDF)",
    description:
      "Free construction and labour supply timesheet template for the UAE, in Excel and PDF: roster, attendance codes, trade summary, VAT and sign-off blocks.",
    updated: "2026-10-21",
  },
  {
    slug: "free-online-time-clock",
    label: "Free online time clock",
    title: "Free Online Time Clock (Clock In & Out)",
    description:
      "Free online time clock: clock in and out from any browser, see hours by day and download them as a CSV. Saved on your device only, no sign-up.",
    updated: "2026-10-28",
  },
] as const;

export type Tool = (typeof TOOLS)[number];
