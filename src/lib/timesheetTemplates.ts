/**
 * The ready-made layouts a timesheet can be generated in. Plain data so the
 * generate screens and the templates tab share one list.
 */
export const TIMESHEET_TEMPLATES = [
  {
    key: "standard",
    name: "Standard letterhead",
    tagline: "Day-by-day grid, grouped by project",
    description: "Your letterhead, one row per worker and a column for every day, grouped by project with subtotals, then the rate summary, deductions, VAT and payment notes. The layout most contractors already issue and accept.",
    bestFor: "Clients who check attendance day by day",
    formats: ["pdf", "xlsx"],
    orientation: "Landscape",
  },
  {
    key: "summary",
    name: "Worker summary",
    tagline: "One line per worker: days, hours, amount",
    description: "Worker ID, name and trade with days worked, total hours, absences, rate and amount, plus totals, deductions and VAT. Short and easy to approve.",
    bestFor: "Clients who only want the monthly totals per person",
    formats: ["pdf", "xlsx"],
    orientation: "Portrait",
  },
  {
    key: "trade",
    name: "Trade-wise billing summary",
    tagline: "One line per trade: headcount, hours, rate, amount",
    description: "Hours and amounts added up by trade and rate, with headcount, then deductions, VAT and the total. Matches how most invoices are priced.",
    bestFor: "Billing departments and invoice attachments",
    formats: ["pdf", "xlsx"],
    orientation: "Portrait",
  },
  {
    key: "signoff",
    name: "Site sign-off sheet",
    tagline: "Hours per worker with signature boxes",
    description: "Each worker's total hours and days with a blank column for the site engineer, and prepared / verified / approved signature blocks at the foot. Print it, sign it, scan it back.",
    bestFor: "Sites that need a signed copy every month",
    formats: ["pdf", "xlsx"],
    orientation: "Portrait",
  },
] as const;

export type TimesheetTemplateKey = (typeof TIMESHEET_TEMPLATES)[number]["key"];
export const TEMPLATE_KEYS = TIMESHEET_TEMPLATES.map((t) => t.key) as [TimesheetTemplateKey, ...TimesheetTemplateKey[]];
export const isTemplateKey = (v: unknown): v is TimesheetTemplateKey => typeof v === "string" && (TEMPLATE_KEYS as string[]).includes(v);
export const templateByKey = (k: string) => TIMESHEET_TEMPLATES.find((t) => t.key === k) ?? TIMESHEET_TEMPLATES[0];
