// Per-industry copy that goes beyond the registry in industries-data.ts: a typical
// contract, how hours and compliance play out, the paperwork to keep on record and
// industry-specific questions. Written from features the product actually has; it
// names kinds of documents, not specific regulators' rules, so it can't go stale
// with a rule change. Each page therefore carries its own text rather than a shared template.
export type IndustryContent = {
  /** "A typical contract": how the work arrives and is billed. */
  scenario: string;
  hoursStory: string;
  complianceStory: string;
  documents: { title: string; body: string }[];
  faqs: { q: string; a: string }[];
  /** Blog post slugs worth reading next. */
  posts: string[];
};

export const INDUSTRY_CONTENT: Record<string, IndustryContent> = {
  "construction-manpower-software-uae": {
    scenario:
      "A contractor asks for 20 shuttering carpenters and 10 helpers for a tower project starting in three weeks. You check who is idle and qualified, quote against the request, mobilise the crew to a camp, and bill the client on approved hours, with some of the crew coming from subcontractors.",
    hoursStory:
      "Daily hours arrive per site and per crew, some from your own supervisors and some from subcontractors. One person approves them once, and the same figures drive the client invoice and the monthly WPS salary run.",
    complianceStory:
      "A large roster means a steady stream of visa, Emirates ID and labour card renewals. Expiries show on each employee record with enough notice to renew before a crew member can no longer be deployed.",
    documents: [
      { title: "Labour card and work permit", body: "Tracked per worker with expiry alerts, so a lapse is caught as a date on a screen and not as a fine." },
      { title: "Emirates ID and residence visa", body: "Read from uploaded scans into the employee record, with renewal dates visible across the whole roster." },
      { title: "Trade skills and certificates", body: "The trade each worker is deployed as, with certificates filed on their record, so a demand for scaffolders can be matched to people who are qualified." },
      { title: "Subcontractor crew paperwork", body: "Workers submitted through the supplier portal sit on the same records as your own, so their papers are checked the same way." },
    ],
    faqs: [
      { q: "Can we track subcontractor crews separately from our own?", a: "Yes. Subcontractors use their own portal to quote against a demand and submit workers and hours, and see only their own records. Their hours go into the same approval queue as yours." },
      { q: "Can workers be paid hourly and monthly in the same payroll?", a: "Yes. Each employee has a pay structure: itemised (basic plus allowances), flat monthly or hourly. Overtime and rest-day premiums are applied on top." },
      { q: "How do we match a demand for a trade to available workers?", a: "Workers are tracked by the trade they are deployed as, so a demand for a given trade can be matched against who is on the bench and qualified, then moved through quotation and mobilisation." },
    ],
    posts: ["wps-sif-rejection-reasons-uae", "visa-emirates-id-expiry-compliance-checklist"],
  },
  "mep-contracting-workforce-software-uae": {
    scenario:
      "An MEP contractor runs electricians, plumbers and HVAC technicians across four projects at once, each billed by the hour at a rate agreed per client. A technician finishing one job is moved to another within days, and every hour worked has to land on the right project's invoice.",
    hoursStory:
      "Hours are recorded against the project each technician worked on, then approved once. The approved figures become that client's invoice at the client's own rate for the trade, so a fast-moving project does not leave billable hours behind.",
    complianceStory:
      "Specialist trades often carry certificates alongside their visa and labour card. Each can be filed on the employee record with its own expiry date, so a lapsed certificate is visible before a technician is sent to site.",
    documents: [
      { title: "Trade certificates and licences", body: "Filed on each technician's record with an expiry date, next to their visa and labour card." },
      { title: "Labour card and Emirates ID", body: "Tracked with expiry alerts so renewals are planned around project mobilisation." },
      { title: "Client rate agreements", body: "Rates set per client and per project, so the rate on an invoice matches what was agreed for that trade." },
      { title: "Site access and clearance letters", body: "Letters and NOCs generated from your own templates when a project needs paperwork for a technician." },
    ],
    faqs: [
      { q: "Can the same trade have different rates on different projects?", a: "Yes. Rates are set at the client or project level, not as one flat company-wide number, so an electrician can be billed differently on two projects." },
      { q: "How do approved hours become an invoice?", a: "The hours a supervisor approves are the ones used to generate the VAT-ready client invoice, so there is no separate retyping step where billable hours can be missed." },
      { q: "Can we see which technicians are free for the next project?", a: "Each trade's current project and site is on their record, so moving a technician between jobs is a record update, and who is on the bench is visible." },
    ],
    posts: ["stop-client-timesheet-disputes-labour-supply-invoices", "how-to-price-manpower-supply-uae-hourly-rate"],
  },
  "facilities-management-workforce-software-uae": {
    scenario:
      "A facilities management company holds dozens of recurring contracts: a cleaning team in one tower, technicians across several malls, support staff at a handful of offices. Each contract has its own rate and its own monthly invoice, and people rotate between sites.",
    hoursStory:
      "Attendance is captured per site and per contract, approved, and billed at each client's own rate. A worker covering two sites in a month shows up correctly on both invoices without a spreadsheet per contract.",
    complianceStory:
      "With many small teams, expiries are easy to miss. Visa, Emirates ID, labour card and certificate dates are tracked across the whole roster in one view, whichever site the person is on.",
    documents: [
      { title: "Labour card and visa", body: "Tracked per worker across all sites, with alerts well before the date." },
      { title: "Health and safety certificates", body: "Filed on the employee record with an expiry date, for roles that need them." },
      { title: "Client contract rates", body: "Billing at each client's agreed rate, kept separate per contract." },
      { title: "Uniform and equipment issued", body: "Inventory and issue records so what each person was given is on file." },
    ],
    faqs: [
      { q: "Can we bill each client at a different rate?", a: "Yes. Billing follows each client's own agreed rate, so many small recurring contracts do not need a spreadsheet each." },
      { q: "How is attendance recorded across many small sites?", a: "Attendance and hours are entered or imported per site and approved in one queue, rather than collected from a separate file for each location." },
      { q: "Can we track who is assigned where when staff rotate?", a: "Each worker's current client and site is on their record, so rotating a team is a record update and the current picture is always visible." },
    ],
    posts: ["construction-timesheet-format-labour-supply-uae", "manpower-supply-software-uae-buyers-checklist"],
  },
  "cleaning-hospitality-workforce-software-uae": {
    scenario:
      "A staffing company supplies cleaners and hospitality staff to hotels and venues. Headcount shifts with the season, a new contract can mean 60 starters in a fortnight, and some leave within months. Onboarding and payroll have to keep pace with that churn.",
    hoursStory:
      "Shift attendance is captured without an app for anyone to install, then approved and carried into both payroll and the client's invoice. Peaks in hours around events are billed from the same record that pays the staff.",
    complianceStory:
      "High turnover means constant paperwork: new visas, new IDs and exits. Documents are read from scans into the record when someone joins, and expiries are tracked from day one so nobody is left unchecked in the rush.",
    documents: [
      { title: "Visa and labour card for new starters", body: "Captured at onboarding from scans, so records are complete before the first shift." },
      { title: "Emirates ID", body: "Read into the employee record, with the renewal date tracked from the start." },
      { title: "Health and food-handling certificates", body: "Filed on the employee record with an expiry date where a venue requires them." },
      { title: "Exit and settlement records", body: "Leavers are processed through the same system, including end-of-service calculations." },
    ],
    faqs: [
      { q: "Can we onboard a large intake at once?", a: "Yes. New starters can be imported from a spreadsheet instead of registered one by one, so onboarding a new contract's staff is not a week of manual data entry." },
      { q: "Do workers need an app to record shifts?", a: "No. Attendance does not depend on an app installed on a phone, and workers can see their own payslips and attendance in any phone browser." },
      { q: "How does payroll cope with staff coming and going?", a: "Payroll runs from approved hours and each employee's pay structure, so starters and leavers are handled in the same run, with end-of-service gratuity calculated for leavers." },
    ],
    posts: ["eosb-gratuity-calculation-uae", "uae-overtime-rules-construction-workers"],
  },
  "oil-gas-workforce-software-uae": {
    scenario:
      "An oil and gas services company supplies technicians and support staff to remote sites. Workers cannot start without site clearances and certificates, they often live in camps near the site, and a missing document can keep a whole crew off the job.",
    hoursStory:
      "Hours are recorded per site and rotation, approved by a supervisor and carried into the client invoice and the payroll run. The record shows who was on site and for how long, which supports the invoice if a client queries it.",
    complianceStory:
      "CICPA, medical certificate, visa and labour card expiries each have their own field and alerts, and other clearances are filed as documents with expiry dates, so renewals can be planned before a worker is turned away at the gate.",
    documents: [
      { title: "Site access clearance", body: "CICPA has its own expiry field with alerts, and any other clearance can be filed as a document with an expiry date." },
      { title: "Medical fitness and safety certificates", body: "The medical certificate has its own expiry field with alerts; other certificates can be filed as documents with an expiry date." },
      { title: "Visa, labour card and Emirates ID", body: "Tracked across the roster with alerts and scan extraction." },
      { title: "Camp assignment records", body: "Which worker is in which bed, with check-in and check-out history." },
    ],
    faqs: [
      { q: "Can site clearance be tracked like other documents?", a: "Yes. CICPA has its own expiry field with alerts, and other site clearances can be filed on the employee record as documents with an expiry date." },
      { q: "How are remote-site camps managed?", a: "Camps are managed bed by bed with live occupancy and check-in and check-out history, and transport can be planned against where crews are working." },
      { q: "How do we keep certification current across a large crew?", a: "The medical certificate has its own expiry field with alerts, and other certificates can be filed on the record as documents with an expiry date." },
    ],
    posts: ["labour-camp-occupancy-beds-checkins-cost-per-bed", "visa-emirates-id-expiry-compliance-checklist"],
  },
  "security-services-workforce-software-uae": {
    scenario:
      "A security company deploys guards to dozens of client sites on fixed posts and rotating shifts, including nights and weekends. Each post is billed to its client, guards move between posts, and licences must be valid for anyone on duty.",
    hoursStory:
      "Attendance follows shifts rather than a nine-to-five day. Hours per guard and per post are approved and billed to each client, and the same record drives payroll, including night and rest-day premiums.",
    complianceStory:
      "A guard's licence or certification matters as much as their visa. Both are held with expiry dates on the employee record, so a lapsed licence can be seen before the guard is rostered.",
    documents: [
      { title: "Security licence or certification", body: "Filed on the guard's record as a document with an expiry date." },
      { title: "Visa, labour card and Emirates ID", body: "Visa, labour card, Emirates ID, passport and driving licence expiries each have their own field and alerts." },
      { title: "Post and site assignment", body: "Each guard's current client site on their record, so the current deployment is visible." },
      { title: "Uniform and equipment issued", body: "Issue records so equipment is accounted for when a guard leaves." },
    ],
    faqs: [
      { q: "Does attendance work for night and rotating shifts?", a: "Yes. Attendance is not built around a fixed day, and overtime and rest-day rules are applied on top of approved hours." },
      { q: "Can we bill each client for the guards on their site?", a: "Yes. Hours are recorded per client site and billed at each client's agreed rate from the same approved record that drives payroll." },
      { q: "How do we avoid rostering a guard with an expired licence?", a: "File the licence on the employee record with its expiry date. Visa, labour card, Emirates ID, passport, medical and driving licence expiries also have their own fields and alerts." },
    ],
    posts: ["uae-overtime-rules-construction-workers", "labour-card-work-permit-visa-difference-uae"],
  },
};
