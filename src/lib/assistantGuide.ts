/**
 * Knowledge for the navigation assistant. Pure data + prompt builder (no
 * Next/DB imports) so it stays testable.
 *
 * The sidebar labels alone are too terse for the model to route "where do I
 * renew a visa?" — HINTS adds one line of what each page is for, keyed by href.
 * EXTRA_PAGES are real destinations that aren't sidebar rows (the "create"
 * forms and a few sub-pages). Everything is filtered by the caller's module
 * access before it reaches the model, and the reply's links are re-checked
 * against the same list, so the assistant can never point at a page the user
 * couldn't open.
 */

export type GuidePage = { href: string; label: string; group: string };

export const HINTS: Record<string, string> = {
  "/": "Main dashboard: KPIs, compliance alerts, customisable widgets",
  "/employees": "List, search and filter all workers; open a worker's profile and documents",
  "/employees/instant-view": "Look up one worker quickly by ID / passport and see everything at a glance",
  "/employees/renewals": "Visa, Emirates ID, passport, labour card and other document expiries due for renewal",
  "/trades": "The canonical trade list (mason, carpenter, ...) used across the platform",
  "/documents": "All uploaded worker documents; upload and scan passports / IDs",
  "/letters": "Generate employee letters (NOC, salary certificate, etc.) from templates",
  "/projects": "Client projects: codes, sites, assigned staff",
  "/sites": "Work sites belonging to projects",
  "/operations/nocs": "No-objection certificates issued to workers",
  "/demand/new": "Raise a new manpower demand for a project",
  "/demand": "All demands and their approval / fulfilment status",
  "/demand/mobilisation": "Mobilise workers against approved demands (stage 2 of the cycle)",
  "/demand/site-arrival": "Confirm workers have arrived at site",
  "/demand/demobilisation": "Demobilise workers leaving a site or project",
  "/demand/documents": "Generate demand-related documents",
  "/accommodation/camps": "Labour camps, rooms and occupancy",
  "/accommodation/checkin": "Check a worker into a camp / bed",
  "/accommodation/bed-allocation": "See and change bed allocations across camps",
  "/transport": "Transport vehicles and assignments",
  "/transport/routes": "Transport routes and pickup points",
  "/inventory": "PPE and inventory stock; issue items to employees",
  "/attendance": "Daily attendance and the monthly attendance grid per project",
  "/invoices/client-timesheet": "Client timesheets: hours per worker per month, approval and PDF",
  "/invoices/client-timesheet/sync": "Sync attendance into client timesheets and review differences",
  "/upload": "Upload timesheet spreadsheets / files for processing",
  "/companies": "Generate timesheet sheets per company",
  "/history": "History of generated sheets and uploads",
  "/clients": "Client companies and their documents",
  "/suppliers": "Manpower suppliers and coordinators",
  "/banks": "Bank accounts / bank master data",
  "/sales/enquiries": "Sales enquiries from prospective clients",
  "/sales/quotations": "Quotations sent to clients",
  "/invoices": "Generate client invoices from approved timesheets",
  "/invoices/history": "Previously generated invoices",
  "/payroll": "Payroll runs: salaries, deductions, WPS export",
  "/finance": "Finance overview",
  "/finance/expenses": "Record and review expenses",
  "/finance/bills": "Supplier bills and payments",
  "/settings": "Account and system settings",
  "/settings/company": "Company profile, branding, branches",
  "/settings/team": "Users, invitations and access",
  "/settings/roles": "Roles and per-module permissions",
  "/lookups": "Dropdown lists (nationalities, banks, etc.)",
  "/letter-templates": "Edit templates used by Employee Letters",
  "/audit-log": "Who changed what, and when",
  "/settings/data-reset": "Bulk-delete test data by module (Super Admin only)",
};

export const EXTRA_PAGES: GuidePage[] = [
  { href: "/employees/new", label: "Add employee", group: "Workforce" },
  { href: "/clients/new", label: "New client", group: "Business Partners" },
  { href: "/projects/new", label: "New project", group: "Projects" },
  { href: "/operations/nocs/new", label: "Issue a NOC", group: "Projects" },
  { href: "/sales/quotations/new", label: "New quotation", group: "Sales" },
  { href: "/transport/routes/new", label: "New route", group: "Facilities" },
  { href: "/invoices/client-timesheet/new", label: "New timesheet entry", group: "Timesheets" },
];

export const MAX_MESSAGES = 10;
export const MAX_MESSAGE_CHARS = 600;

export const REPLY_SCHEMA = {
  type: "object" as const,
  properties: {
    answer: { type: "string" as const, description: "Short, friendly answer (1-3 sentences)" },
    links: {
      type: "array" as const,
      description: "Up to 3 pages to open, best match first. Only hrefs from the page list; empty if none fit.",
      items: {
        type: "object" as const,
        properties: { href: { type: "string" as const } },
        required: ["href"],
        additionalProperties: false,
      },
    },
  },
  required: ["answer", "links"],
  additionalProperties: false,
};

export function buildSystemPrompt(pages: GuidePage[]): string {
  const list = pages
    .map((p) => `- ${p.href} | ${p.group} › ${p.label}${HINTS[p.href] ? ` — ${HINTS[p.href]}` : ""}`)
    .join("\n");
  return `You are the in-app navigation assistant for a UAE manpower-supply / workforce ERP. You help the signed-in user find the right page and understand where things live.

Rules:
- Answer only questions about finding pages or doing tasks in this app. For anything else (or for questions about specific records, numbers or people), say briefly that you can only help with navigation.
- Recommend only pages from the list below — these are the only pages this user can open. If the task needs a page that isn't listed, say they may not have access and suggest asking an admin.
- Keep answers to 1-3 short sentences. If a task takes several pages, mention the order in the answer and put the pages in "links" in that order (max 3).
- Never invent pages, buttons or features.

Pages (href | group › label — what it's for):
${list}`;
}
