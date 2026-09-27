// One entry per industry vertical page, at /industries/<slug>. Grounded in
// the same product facts as the rest of the site (content.ts) — the
// differentiators are just framed for what actually differs about staffing
// in that industry, not invented claims.
export const INDUSTRIES_DATA = [
  {
    slug: "construction-manpower-software-uae",
    name: "Construction Manpower",
    title: "Manpower Software for Construction Companies in the UAE",
    description:
      "Trade-based workforce tracking, WPS payroll for a large blue-collar roster, and camps and transport tied to the sites your crews are working today.",
    keywords: ["construction manpower software UAE", "construction labour supply software", "construction workforce ERP UAE"],
    intro:
      "A construction manpower supplier runs a large, trade-based workforce across shifting sites and subcontractor crews, with visa, labour card and WPS compliance as a daily operational job, not an annual one.",
    differentiators: [
      {
        title: "Deployment tracked by trade, not just headcount",
        body: "Helpers, masons, steel fixers, carpenters and electricians are tracked as the trade they're deployed as today — matching a demand for 20 shuttering carpenters to who's actually idle and qualified.",
      },
      {
        title: "WPS payroll built for a large blue-collar roster",
        body: "Hundreds of workers, paid monthly through the Wage Protection System, with overtime and site allowances applied consistently across the whole roster.",
      },
      {
        title: "Camps and transport tied to where crews are working",
        body: "Bed assignments and bus routes are planned against current site deployment, not a fixed roster that stops matching reality the moment a crew moves.",
      },
    ],
  },
  {
    slug: "mep-contracting-workforce-software-uae",
    name: "MEP Contracting",
    title: "Workforce Software for MEP Contractors in the UAE",
    description:
      "Specialist trades billed by the hour across several concurrent projects, with mobilisation and hours-to-invoice tracked so nothing slips through between sites.",
    keywords: ["MEP manpower software UAE", "MEP contractor workforce software", "MEP labour supply UAE"],
    intro:
      "MEP contractors run specialist trades — electricians, plumbers, HVAC technicians — across several concurrent projects at once, usually billed by the hour on tight margins where a missed billable hour is a direct loss.",
    differentiators: [
      {
        title: "Trade rates set per client and per project",
        body: "A client's agreed rate for an electrician on one project doesn't have to be the same as another — rates are set at the client or project level, not one flat number for the whole company.",
      },
      {
        title: "Approved hours become an invoice, not a gap",
        body: "The same approved hours a supervisor signs off on become the client invoice, closing the gap where billable hours on a fast-moving project quietly go unbilled.",
      },
      {
        title: "Mobilisation tracked across several sites at once",
        body: "Each trade's current project and site is on their record, so moving a technician between two concurrent MEP jobs is a record update, not a phone call to confirm who's where.",
      },
    ],
  },
  {
    slug: "facilities-management-workforce-software-uae",
    name: "Facilities Management",
    title: "Workforce Software for Facilities Management Companies in the UAE",
    description:
      "Cleaners, technicians and support staff spread across many client sites and smaller recurring contracts, tracked and billed per client without a spreadsheet per contract.",
    keywords: ["facilities management workforce software UAE", "FM manpower software UAE", "facilities management staffing software"],
    intro:
      "A facilities management company typically runs many smaller contracts at once — a handful of staff per client site, spread across a large client base — which makes per-client tracking and billing the real operational challenge, more than headcount.",
    differentiators: [
      {
        title: "Many small contracts, tracked without a spreadsheet each",
        body: "Each client site's staff, hours and billing rate live on one system instead of a separate file per contract, so scaling to another client site doesn't mean scaling the admin overhead with it.",
      },
      {
        title: "Attendance across dispersed locations, in one place",
        body: "Staff working at client premises rather than a central site still report attendance into the same system, so there's one place to check who's where, not one per contract.",
      },
      {
        title: "Billing that matches each client's own rate",
        body: "Invoices are generated per client against their agreed rate and the hours actually worked at their site — not a single blended rate across your whole book of contracts.",
      },
    ],
  },
  {
    slug: "cleaning-hospitality-workforce-software-uae",
    name: "Cleaning & Hospitality",
    title: "Workforce Software for Cleaning & Hospitality Staffing in the UAE",
    description:
      "High-headcount, shift-based staffing with simple worker-facing tools and fast onboarding — built for a workforce that turns over more often than a typical office roster.",
    keywords: ["cleaning company staffing software UAE", "hospitality staffing software UAE", "shift workforce management UAE"],
    intro:
      "Cleaning and hospitality staffing runs on high headcount, shift-based rosters with more turnover than most other manpower segments — the operational bottleneck is usually onboarding and shift attendance at volume, not a shortage of trades.",
    differentiators: [
      {
        title: "Bulk onboarding for high-turnover rosters",
        body: "New starters are imported from a spreadsheet rather than registered one at a time, so onboarding a new contract's staff doesn't become a week of manual data entry.",
      },
      {
        title: "Shift attendance without an app to install",
        body: "The employee portal runs in any phone browser, which matters more here than most segments — a workforce with high turnover can't be trained on a new app every time someone joins.",
      },
      {
        title: "Payroll that keeps up with roster churn",
        body: "Starters, leavers and shift changes flow straight into the next payroll run, instead of a manual reconciliation every time the roster changes mid-month.",
      },
    ],
  },
  {
    slug: "oil-gas-workforce-software-uae",
    name: "Oil & Gas Services",
    title: "Workforce Software for Oil & Gas Services Companies in the UAE",
    description:
      "Site clearance, medical and safety certification tracking, and camp accommodation for a workforce deployed to remote and restricted-access sites.",
    keywords: ["oil and gas manpower software UAE", "CICPA workforce tracking software", "oil gas services staffing UAE"],
    intro:
      "Oil and gas services work often means deploying workers to remote or restricted-access sites, where site clearance, medical fitness and safety certification are as operationally critical as the trade itself.",
    differentiators: [
      {
        title: "Site clearance tracked alongside every other document",
        body: "CICPA and other restricted-site clearance details sit on the employee record next to their visa, Emirates ID and medical certificate — one expiry-tracking system instead of a separate register for site access.",
      },
      {
        title: "Camps built for remote-site accommodation",
        body: "Bed-level camp management and transport routing were built for a workforce housed away from head office, not bolted on afterward for a mostly office-based one.",
      },
      {
        title: "Medical and safety certification expiry, tracked automatically",
        body: "Medical fitness and other safety certifications get the same expiry alerts as visas and labour cards, so a lapsed certificate doesn't surface only when a worker is turned away at a gate.",
      },
    ],
  },
  {
    slug: "security-services-workforce-software-uae",
    name: "Security Services",
    title: "Workforce Software for Security Services Companies in the UAE",
    description:
      "Guard deployment per client site, shift-based attendance, and licence and certification expiry tracked the same way visas and Emirates IDs are.",
    keywords: ["security services manpower software UAE", "security guard workforce software", "security staffing software UAE"],
    intro:
      "Security services staffing runs on guards deployed to many client sites around the clock, where licensing and certification lapses carry the same operational risk as an expired visa — and are just as easy to lose track of across a large roster.",
    differentiators: [
      {
        title: "Guard deployment tracked per client site",
        body: "Each guard's current site assignment is on their record, so covering a shift or reallocating a guard between sites is a record change, not a radio call to confirm who's where.",
      },
      {
        title: "Shift-based attendance, not a 9-to-5 assumption",
        body: "Attendance and timesheets are built to handle round-the-clock shift patterns, not a single daily in/out that assumes an office schedule.",
      },
      {
        title: "Licence and certification expiry, tracked like a visa",
        body: "Security licences and certifications get the same expiry alerts as visas and labour cards — one system flags all of it, instead of a separate register that's easy to let lapse.",
      },
    ],
  },
] as const;

export type IndustryEntry = (typeof INDUSTRIES_DATA)[number];
