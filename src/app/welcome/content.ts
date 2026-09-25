// Everything a marketer might change before launch lives here.

export const SITE = {
  name: "Workforce ERP",
  tagline: "The operating system for manpower suppliers",
  salesEmail: "sales@example.com",
};

export const demoHref = `mailto:${SITE.salesEmail}?subject=${encodeURIComponent(`${SITE.name} demo request`)}`;

export type Tint = "peach" | "rose" | "mint" | "lavender" | "sky" | "yellow" | "cream" | "gray";

export const NAV = [
  { label: "Product", href: "#product" },
  { label: "How it works", href: "#how" },
  { label: "Portals", href: "#portals" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
];

export const INDUSTRIES = [
  "Construction manpower",
  "MEP contracting",
  "Facilities management",
  "Cleaning & hospitality",
  "Oil & gas services",
  "Security services",
];

export const CAPABILITIES: {
  tint: Tint;
  icon: "clock" | "wallet" | "receipt" | "hardhat";
  title: string;
  body: string;
  points: string[];
}[] = [
  {
    tint: "sky",
    icon: "clock",
    title: "Timesheets & attendance",
    body: "Drop in the monthly workbook and every month tab is detected and reconciled automatically. No retyping.",
    points: ["Excel workbook import", "Manual & client timesheets", "Overtime and rest-day rules"],
  },
  {
    tint: "mint",
    icon: "wallet",
    title: "Payroll & WPS",
    body: "Run payroll from approved hours, route it through approval rules, and export a bank-ready WPS file.",
    points: ["WPS / SIF export", "Loans & recurring pay items", "End-of-service gratuity"],
  },
  {
    tint: "peach",
    icon: "receipt",
    title: "Billing & finance",
    body: "Turn the same approved hours into VAT invoices per client, and keep bills and expenses in one ledger.",
    points: ["Invoices from timesheets", "VAT-ready", "Bills, expenses & payments"],
  },
  {
    tint: "lavender",
    icon: "hardhat",
    title: "Projects, sites & demand",
    body: "Track every client request from enquiry and quotation to mobilisation, site arrival and demobilisation.",
    points: ["Enquiries & quotations", "Mobilisation tracking", "Sites, trades & projects"],
  },
];

export const STEPS = [
  {
    n: "01",
    title: "Hours come in",
    body: "Upload the site workbook, enter hours manually, or let suppliers submit their crews' timesheets through their portal.",
  },
  {
    n: "02",
    title: "Supervisors approve",
    body: "Exceptions and overtime are flagged. Approvers sign off in one queue, and every change is written to the audit log.",
  },
  {
    n: "03",
    title: "Everyone gets paid",
    body: "Approved hours flow straight into client invoices, payroll runs and the WPS file. No re-keying between teams.",
  },
];

export const DEEP_DIVES: {
  eyebrow: string;
  title: string;
  body: string;
  points: string[];
  visual: "documents" | "camps" | "assistant";
}[] = [
  {
    eyebrow: "Documents & compliance",
    title: "Passports, visas and Emirates IDs, read for you.",
    body: "Upload a scan and the key fields are extracted into the employee record. Expiry dates surface long before they become a fine, and letters and NOCs generate from your own templates in one click.",
    points: ["AI document extraction", "Expiry alerts", "Letter & NOC templates", "WhatsApp notifications"],
    visual: "documents",
  },
  {
    eyebrow: "Accommodation & transport",
    title: "Know who sleeps where and who rides which bus.",
    body: "Manage camps room by room with live occupancy, check workers in and out, and plan transport routes and vehicles against the sites your crews are working at today.",
    points: ["Camps & bed allocation", "Live occupancy", "Vehicles & routes", "Check-in history"],
    visual: "camps",
  },
  {
    eyebrow: "Built-in assistant",
    title: "Ask your data a question. Get the answer, with links.",
    body: "“Which visas expire this month?” “How many welders are on Site 14?” The assistant answers from your live records, respects each user's permissions, and links straight to the source.",
    points: ["Plain-language questions", "Permission-aware", "Links to records"],
    visual: "assistant",
  },
];

export const FACTS = [
  { value: "30+", label: "modules in one platform" },
  { value: "3", label: "portals: staff, employee and supplier" },
  { value: "1", label: "source of truth from hours to invoice" },
  { value: "100%", label: "of changes captured in the audit log" },
];

export const PORTALS: { tint: Tint; title: string; body: string; href: string; cta: string; points: string[] }[] = [
  {
    tint: "cream",
    title: "Staff workspace",
    body: "Operations, HR, finance and sales work from one system, each seeing only the modules their role allows.",
    href: "/login",
    cta: "Staff sign in",
    points: ["Role-based permissions", "Branch-level access", "Dashboards per team"],
  },
  {
    tint: "rose",
    title: "Employee self-service",
    body: "Workers check their attendance, download payslips and view their documents from any phone browser.",
    href: "/me/login",
    cta: "Employee sign in",
    points: ["Payslips", "Attendance history", "Personal documents"],
  },
  {
    tint: "yellow",
    title: "Supplier portal",
    body: "Subcontractors receive demands, submit workers and timesheets, and track their payments without emailing spreadsheets.",
    href: "/vendor/login",
    cta: "Supplier sign in",
    points: ["Demands & workers", "Timesheet submission", "Payment tracking"],
  },
];

export type Plan = {
  name: string;
  monthly: number | null;
  blurb: string;
  cta: string;
  featured?: boolean;
  features: string[];
};

// Prices are per active worker per month, in AED.
export const PLANS: Plan[] = [
  {
    name: "Starter",
    monthly: 15,
    blurb: "For suppliers moving their timesheets off spreadsheets.",
    cta: "Book a demo",
    features: [
      "Timesheets & attendance",
      "Employee records & documents",
      "Employee self-service portal",
      "Letters & NOC templates",
      "Email support",
    ],
  },
  {
    name: "Business",
    monthly: 22,
    blurb: "The full platform, from hours to payroll to invoices.",
    cta: "Book a demo",
    featured: true,
    features: [
      "Everything in Starter",
      "Payroll & WPS export",
      "Client invoicing & finance",
      "Accommodation & transport",
      "Supplier portal",
      "AI extraction & assistant",
    ],
  },
  {
    name: "Enterprise",
    monthly: null,
    blurb: "For multi-branch groups with custom workflows.",
    cta: "Talk to sales",
    features: [
      "Everything in Business",
      "Multiple branches & companies",
      "Custom approval rules",
      "Guided data migration",
      "Dedicated success manager",
    ],
  },
];

export const COMPARISON: { feature: string; tiers: [boolean | string, boolean | string, boolean | string] }[] = [
  { feature: "Timesheet import & approvals", tiers: [true, true, true] },
  { feature: "Employee self-service portal", tiers: [true, true, true] },
  { feature: "Documents, letters & NOCs", tiers: [true, true, true] },
  { feature: "Payroll runs & WPS file", tiers: [false, true, true] },
  { feature: "Client invoicing with VAT", tiers: [false, true, true] },
  { feature: "Accommodation & transport", tiers: [false, true, true] },
  { feature: "Supplier portal", tiers: [false, true, true] },
  { feature: "AI extraction & assistant", tiers: [false, true, true] },
  { feature: "Branches", tiers: ["1", "Up to 3", "Unlimited"] },
  { feature: "Support", tiers: ["Email", "Priority", "Dedicated"] },
];

export const FAQS = [
  {
    q: "How long does it take to go live?",
    a: "Most suppliers run their first real month within two weeks. Employees and sites are imported from your existing sheets, and your current timesheet workbook can be uploaded as-is.",
  },
  {
    q: "Can we bring our existing Excel timesheets?",
    a: "Yes. Upload the consolidated workbook and each month tab is detected automatically. Re-uploading a corrected file updates that month instead of creating duplicates.",
  },
  {
    q: "Does payroll produce a WPS file our bank accepts?",
    a: "Payroll runs export a WPS salary information file using each employee's bank and routing details, ready to upload to your bank or exchange house.",
  },
  {
    q: "Do workers need to install an app?",
    a: "No. The employee portal runs in any phone browser, so workers can check payslips, attendance and documents without downloading anything.",
  },
  {
    q: "Who can see salary and client data?",
    a: "Access is controlled by role and branch, so each person only sees the modules they need. Every create, edit and delete is recorded in the audit log.",
  },
  {
    q: "How do subcontractors fit in?",
    a: "Your suppliers get their own portal to receive demands, submit workers and timesheets, and follow their payments, all without access to your internal data.",
  },
];

export const FOOTER: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "Product",
    links: [
      { label: "Capabilities", href: "#product" },
      { label: "How it works", href: "#how" },
      { label: "Pricing", href: "#pricing" },
      { label: "FAQ", href: "#faq" },
    ],
  },
  {
    title: "Sign in",
    links: [
      { label: "Staff workspace", href: "/login" },
      { label: "Employee portal", href: "/me/login" },
      { label: "Supplier portal", href: "/vendor/login" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "Book a demo", href: demoHref },
      { label: "Contact sales", href: `mailto:${SITE.salesEmail}` },
    ],
  },
];
