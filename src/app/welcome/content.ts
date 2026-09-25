// Everything a marketer might change before launch lives here.

export const SITE = {
  name: "ManpowerSync",
  tagline: "The operating system for manpower suppliers",
  salesEmail: "sales@manpowersync.com",
  // Where "Book a demo" submissions are notified — kept separate from
  // salesEmail since that one also drives the "Contact sales" mailto link.
  demoNotifyEmail: "info@manpowersync.com",
};

// The landing page is served from its own domain, so links into the app need
// the app's absolute origin. Leave unset when both share one domain.
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
export const appHref = (path: string) => `${APP_URL}${path}`;

export const demoHref = `mailto:${SITE.salesEmail}?subject=${encodeURIComponent(`${SITE.name} demo request`)}`;

export type Tint = "peach" | "rose" | "mint" | "lavender" | "sky" | "yellow" | "cream" | "gray";

export const NAV = [
  { label: "Challenges", href: "#challenges" },
  { label: "Product", href: "#product" },
  { label: "How it works", href: "#how" },
  { label: "Portals", href: "#portals" },
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

export const CHALLENGES: { icon: "sheet" | "id" | "wallet" | "leak" | "bed" | "mail"; title: string; body: string }[] = [
  {
    icon: "sheet",
    title: "Timesheets in every format",
    body: "Hours arrive from each site on paper, in Excel and as phone photos. Someone retypes them for payroll, then again for billing.",
  },
  {
    icon: "id",
    title: "Documents that expire quietly",
    body: "Visas, Emirates IDs, passports and labour cards lapse between renewals. By the time anyone notices, the fine has arrived.",
  },
  {
    icon: "wallet",
    title: "Payroll built by hand",
    body: "Overtime, deductions, loans and the WPS file are worked out in spreadsheets every month, for hundreds of workers at once.",
  },
  {
    icon: "leak",
    title: "Hours worked, never billed",
    body: "When timesheets and invoices live in separate files, approved hours slip through and revenue quietly leaks away.",
  },
  {
    icon: "bed",
    title: "A workforce spread across camps and sites",
    body: "Beds, buses and site rotations are coordinated by phone, with no single view of who is where today.",
  },
  {
    icon: "mail",
    title: "Subcontractors on email",
    body: "Supplier crews, their timesheets and their payments are tracked through forwarded spreadsheets and follow-up calls.",
  },
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
    href: appHref("/login"),
    cta: "Staff sign in",
    points: ["Role-based permissions", "Branch-level access", "Dashboards per team"],
  },
  {
    tint: "rose",
    title: "Employee self-service",
    body: "Workers check their attendance, download payslips and view their documents from any phone browser.",
    href: appHref("/me/login"),
    cta: "Employee sign in",
    points: ["Payslips", "Attendance history", "Personal documents"],
  },
  {
    tint: "yellow",
    title: "Supplier portal",
    body: "Subcontractors receive demands, submit workers and timesheets, and track their payments without emailing spreadsheets.",
    href: appHref("/vendor/login"),
    cta: "Supplier sign in",
    points: ["Demands & workers", "Timesheet submission", "Payment tracking"],
  },
];

export const FAQS = [
  {
    q: "How is this different from a general HRMS or ERP?",
    a: "General systems stop at employee records and payroll. Manpower suppliers also need client timesheets, billing by the hour, visa and ID tracking, camps, transport, mobilisation and subcontractor crews. Those are built in here rather than bolted on.",
  },
  {
    q: "What does getting started involve?",
    a: "Employees and sites are imported from your existing sheets, and your current timesheet workbook can be uploaded as-is. There is nothing to re-key before your first month.",
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
      { label: "Portals", href: "#portals" },
      { label: "FAQ", href: "#faq" },
    ],
  },
  {
    title: "Sign in",
    links: [
      { label: "Staff workspace", href: appHref("/login") },
      { label: "Employee portal", href: appHref("/me/login") },
      { label: "Supplier portal", href: appHref("/vendor/login") },
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
