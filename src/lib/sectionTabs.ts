/**
 * Pages that used to be separate sidebar rows but are really one workflow.
 * The sidebar links to the section once; these tabs switch between its pages.
 * Each tab stays a real route (deep-linkable, server-rendered, permission-gated
 * by its own path) — nothing here merges pages, it only groups their entry.
 */
export type SectionTab = {
  href: string;
  label: string;
  /** Whether this tab owns `pathname`. Defaults to href-or-descendant. */
  match?: (pathname: string) => boolean;
};

const under = (base: string) => (p: string) => p === base || p.startsWith(base + "/");

export const SECTION_TABS: SectionTab[][] = [
  // What suppliers send us through their portal
  [
    { href: "/suppliers/requests", label: "Requests", match: under("/suppliers/requests") },
    { href: "/suppliers/tickets", label: "Messages", match: under("/suppliers/tickets") },
    { href: "/suppliers/contacts", label: "Portal contacts", match: under("/suppliers/contacts") },
  ],
  // Supplier bills and their payables reports
  [
    {
      href: "/finance/bills",
      label: "Bills",
      match: (p) => under("/finance/bills")(p) && !under("/finance/bills/ageing")(p) && !under("/finance/bills/statement")(p),
    },
    {
      href: "/finance/bills/ageing",
      label: "Ageing & statements",
      match: (p) => under("/finance/bills/ageing")(p) || under("/finance/bills/statement")(p),
    },
  ],
  // Payroll
  [
    {
      href: "/payroll",
      label: "Runs",
      match: (p) =>
        under("/payroll")(p) &&
        !under("/payroll/loans")(p) &&
        !under("/payroll/recurring")(p) &&
        !under("/payroll/end-of-service")(p),
    },
    { href: "/payroll/loans", label: "Loans & advances", match: under("/payroll/loans") },
    { href: "/payroll/recurring", label: "Recurring items", match: under("/payroll/recurring") },
    { href: "/payroll/end-of-service", label: "End of service", match: under("/payroll/end-of-service") },
  ],
  // Timesheet import pipeline
  [
    { href: "/upload", label: "Upload", match: under("/upload") },
    { href: "/companies", label: "Generate sheets", match: under("/companies") },
    { href: "/history", label: "History", match: under("/history") },
  ],
  // Client timesheet. The attendance-sync review is reached from a banner on
  // the Timesheet tab (only when something differs), so it isn't a tab itself,
  // but it still belongs to this section.
  [
    {
      href: "/invoices/client-timesheet",
      label: "Timesheet",
      match: (p) =>
        under("/invoices/client-timesheet")(p) &&
        !under("/invoices/client-timesheet/daily")(p),
    },
    { href: "/invoices/client-timesheet/daily", label: "Daily view", match: under("/invoices/client-timesheet/daily") },
  ],
  // Mobilise → arrive → demobilise
  [
    { href: "/demand/mobilisation", label: "Mobilisation", match: under("/demand/mobilisation") },
    { href: "/demand/site-arrival", label: "Site arrival", match: under("/demand/site-arrival") },
    { href: "/demand/demobilisation", label: "Demobilisation", match: under("/demand/demobilisation") },
  ],
  // Fleet
  [
    {
      href: "/transport",
      label: "Vehicles",
      match: (p) => under("/transport")(p) && !under("/transport/routes")(p),
    },
    { href: "/transport/routes", label: "Routes", match: under("/transport/routes") },
  ],
  // Client invoicing (not /invoices/client-timesheet, which is the section above)
  [
    {
      href: "/invoices",
      label: "Invoices",
      match: (p) =>
        p === "/invoices" || /^\/invoices\/[^/]+\/generate/.test(p),
    },
    { href: "/invoices/history", label: "History", match: under("/invoices/history") },
  ],
];

/** The tab set that owns this path, with the active tab resolved; null when the path isn't in any section. */
export function sectionFor(pathname: string) {
  for (const tabs of SECTION_TABS) {
    const active = tabs.find((t) => (t.match ?? under(t.href))(pathname));
    if (active) return { tabs, activeHref: active.href };
  }
  return null;
}
