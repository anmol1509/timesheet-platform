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
  // Administration: the company itself
  [
    { href: "/settings/company", label: "Company profile", match: under("/settings/company") },
    { href: "/settings", label: "Branches & billing", match: (p) => p === "/settings" },
  ],
  // Administration: getting data in, keeping it clean, and wiping it
  [
    { href: "/import", label: "Import", match: under("/import") },
    { href: "/data-health", label: "Data health", match: under("/data-health") },
    { href: "/lookups", label: "Lookups", match: under("/lookups") },
    { href: "/settings/data-reset", label: "Reset data", match: under("/settings/data-reset") },
  ],
  // Administration: what happened, and what people told the assistant
  [
    { href: "/audit-log", label: "Audit log", match: under("/audit-log") },
    { href: "/settings/assistant", label: "Assistant feedback", match: under("/settings/assistant") },
  ],
  // Who can sign in, and what each person may open and do
  [
    { href: "/settings/team", label: "Team", match: under("/settings/team") },
    { href: "/settings/roles", label: "Roles & permissions", match: under("/settings/roles") },
    { href: "/settings/developers", label: "Developers", match: under("/settings/developers") },
  ],
  // Letters: made for employees, NOCs for clients, and the wording behind both
  [
    { href: "/letters", label: "All Letters", match: under("/letters") },
    { href: "/operations/nocs", label: "NOC", match: under("/operations/nocs") },
    { href: "/letter-templates", label: "Templates", match: under("/letter-templates") },
  ],
  // What suppliers send us through their portal
  [
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
  // Accounting: transactions, bank, reports and settings
  [
    { href: "/finance/books", label: "Transactions", match: (p) => p === "/finance/books" || under("/finance/books/parties")(p) },
    { href: "/finance/books/bank", label: "Bank", match: under("/finance/books/bank") },
    { href: "/finance/books/reports", label: "Reports", match: (p) => under("/finance/books/reports")(p) || under("/finance/books/accounts")(p) || under("/finance/books/ledger")(p) },
    { href: "/finance/books/setup", label: "Settings", match: under("/finance/books/setup") },
  ],
  // Expenses and the budgets they are held to
  [
    { href: "/finance/expenses", label: "Expenses", match: (p) => under("/finance/expenses")(p) && !under("/finance/expenses/budgets")(p) },
    { href: "/finance/expenses/budgets", label: "Budgets & petty cash", match: under("/finance/expenses/budgets") },
  ],
  // Payroll
  [
    {
      href: "/payroll",
      label: "Pay runs",
      match: (p) =>
        under("/payroll")(p) &&
        !under("/payroll/loans")(p) &&
        !under("/payroll/recurring")(p) &&
        !under("/payroll/end-of-service")(p) &&
        !under("/payroll/settlements")(p),
    },
    { href: "/payroll/loans", label: "Loans & advances", match: under("/payroll/loans") },
    { href: "/payroll/recurring", label: "Recurring items", match: under("/payroll/recurring") },
    { href: "/payroll/end-of-service", label: "Gratuity", match: under("/payroll/end-of-service") },
    { href: "/payroll/settlements", label: "Leavers", match: under("/payroll/settlements") },
  ],
  // Timesheet import pipeline
  [
    { href: "/companies", label: "Generate sheets", match: (p) => under("/companies")(p) || under("/upload")(p) },
    { href: "/history", label: "History", match: under("/history") },
    { href: "/timesheet-templates", label: "Templates", match: under("/timesheet-templates") },
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
