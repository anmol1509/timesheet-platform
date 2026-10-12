/**
 * Step-by-step guides for the questions people ask most, so My Assistant can answer "how do I…" and
 * "why is…" with the real steps instead of "I'm not sure". Pure data (no Next or database imports).
 *
 * Only write what the screens do: when a screen changes, change its guide here. `pages` are hrefs the assistant
 * may offer as links; it only links the ones the person is allowed to open.
 */

export type HelpGuide = {
  id: string;
  title: string;
  /** Words and phrases a person might use, in plain English; matched against the question. */
  keywords: string[];
  steps: string[];
  /** Things to check or know that are not steps. */
  notes?: string[];
  pages?: string[];
};

export const HELP_GUIDES: HelpGuide[] = [
  {
    id: "payroll-setup",
    title: "Set up payroll for the first time",
    keywords: ["set up payroll", "first payroll", "start payroll", "payroll not working", "cannot start payroll", "no company in payroll", "own company"],
    steps: [
      "Mark your company as an own company: Suppliers › open the company › tick \"Own company\". Payroll is only for own companies and their subsidiaries.",
      "Add the company's MOHRE establishment ID on the same page. The bank (WPS) file needs it.",
      "Add the bank that pays salaries: Banks › add an account with its routing code and IBAN, and keep it active.",
      "Set each worker's pay on their Trade & pay tab (basic plus allowances, a flat monthly rate, or an hourly rate). Workers with no pay set are left out of the run.",
      "Add each worker's bank details on their Payroll & WPS tab (MOL person code, routing code, IBAN or account).",
      "On the Payroll page choose the company and month and press Start payroll run.",
    ],
    notes: ["The \"Set up payroll\" checklist at the top of the Payroll page shows which of these is still missing."],
    pages: ["/payroll", "/suppliers", "/banks", "/employees"],
  },
  {
    id: "payroll-run-flow",
    title: "Run payroll from start to payment",
    keywords: ["run payroll", "payroll steps", "how does payroll work", "process salaries", "pay salaries", "payroll flow", "month end payroll"],
    steps: [
      "Payroll › choose the company and month › Start payroll run. Pay comes from attendance (salaried workers) or from the timesheet hours (hourly workers).",
      "Open the run and check each line. View days shows every day against the client timesheet, and you can fix a day there.",
      "Type any deduction, advance or adjustment in the run's Deduction, Advance and Adjustment columns (each needs a note) and press Save.",
      "Press Submit for approval. It then waits in Approvals › Payroll.",
      "An approver opens it and presses Approve (or sends it back with a reason).",
      "Download the bank file (WPS / SIF) and upload it in the bank's online portal.",
      "Press Mark as paid. Payslips and the payroll register can be downloaded from the run.",
    ],
    notes: ["A draft can be changed freely and recalculated (More › Recalculate). An approved run can be reopened until it is paid. After it is paid, fix mistakes as a correction in next month's payroll."],
    pages: ["/payroll", "/approvals?type=PAYROLL"],
  },
  {
    id: "payroll-missing-worker",
    title: "A worker is missing from a payroll run",
    keywords: ["not in payroll", "missing from payroll", "worker missing payroll", "not showing in payroll", "employee not in run", "left out of payroll", "no pay line"],
    steps: [
      "Check the worker belongs to an own company (Suppliers › company › Own company), and that it is the company you chose for the run.",
      "Check their status is not Terminated, and that they had joined by the end of the month and had not left before the start of it.",
      "Open their Trade & pay tab: they need a pay structure and an amount (basic, flat rate or hourly rate). Workers with no pay set are left out.",
      "For an hourly company, check the worker has timesheet hours for that month. Without hours they are paid nothing.",
      "After fixing anything, open the run and press More › Recalculate.",
    ],
    pages: ["/payroll", "/employees", "/suppliers"],
  },
  {
    id: "payroll-cannot-approve",
    title: "Payroll will not approve",
    keywords: ["cannot approve payroll", "approve payroll error", "payroll approval blocked", "missing bank details", "send for approval", "not submitted", "someone other than the person who prepared"],
    steps: [
      "The run must first be submitted: open it and press Submit for approval. Only submitted drafts appear in Approvals › Payroll.",
      "If it says bank details are missing, fix them on the worker's Payroll & WPS tab (MOL person code, routing code, IBAN or account number), or use the Fix bank details option on the run. Then press More › Recalculate.",
      "If it says someone other than the person who prepared the run has to approve it, a different approver must do it. Above the branch's approval limit the person who created a run cannot approve it.",
      "You need the payroll approve permission. If the Approve button is missing, ask an admin (Settings › Roles).",
    ],
    pages: ["/payroll", "/approvals?type=PAYROLL", "/settings/roles"],
  },
  {
    id: "payroll-pay-explained",
    title: "How a worker's pay is worked out",
    keywords: ["how is salary calculated", "why is pay low", "salary calculation", "net pay", "deduction explained", "why was pay deducted", "overtime rate", "days in month", "28 days", "31 days"],
    steps: [
      "A monthly (basic or flat) worker gets the full monthly amount in any month, whether it has 28, 30 or 31 days.",
      "Absence is deducted using a 30-day month. The company's rule decides what an absent day costs: the first few absences a month are free, then a fixed amount per day.",
      "Overtime is paid on the basic wage only: basic ÷ 30 ÷ the standard day (8 hours) × the overtime multiplier. Hours on a weekly off day or holiday use the rest-day multiplier.",
      "Gas charge, loan or advance recovery, a typed deduction, recurring items and an adjustment are then added or taken off. Net pay never goes below zero.",
      "An hourly worker is paid every timesheet hour at the hourly rate, with no overtime premium.",
    ],
    notes: ["For one worker's exact figures, ask for their pay line and month and I will break it down."],
    pages: ["/payroll"],
  },
  {
    id: "payroll-short-hours",
    title: "Deduct pay for short days (short hours)",
    keywords: ["short hours", "shortfall", "worked less hours", "left early", "5 hours instead of 8", "deduct for fewer hours", "half day deduction"],
    steps: [
      "Choose the rule once for the company: Suppliers › open the company › Short hours on a present day. Off (no deduction), Hourly (the missing hours at the hourly rate) or Half day (half a day's pay when the day is under a set number of hours).",
      "Open the payroll run and recalculate. A present working day with fewer hours than the standard day now shows a Short hours amount in View days.",
      "To skip it for one day, untick that day's tick box in View days.",
      "The deduction shows as its own Short hours line on the payslip.",
    ],
    notes: ["Only salaried workers' present working days count. Absent, leave, sick, idle, holiday and weekly-off days never do, and hourly workers are paid for the hours on their timesheet."],
    pages: ["/payroll", "/suppliers"],
  },
  {
    id: "advance-request",
    title: "Give an employee an advance or loan",
    keywords: ["advance", "salary advance", "employee took advance", "loan", "give advance", "advance request", "advance approval", "record advance", "advance receipt", "advance letter", "deduct advance", "recover advance"],
    steps: [
      "Payroll › Loans & advances › New advance / loan. Choose the employee, the amount and the reason.",
      "Choose how it is deducted from salary: all in one month, the same amount every month, or the amount for each month. A month-by-month plan must add up to the amount.",
      "Press Request approval. It goes to Approvals › Advances, and approvers are notified. The person who asked can't approve their own request if someone else can.",
      "Once approved, hand over the money and press Record as given: enter the day it was handed over, how it was paid and a reference. Nothing is deducted before this is recorded.",
      "Print the Request letter or the Receipt from the same row (choose letterhead, signature and stamp if you want them). The employee signs the acknowledgement at the bottom of the same page.",
      "From then on each payroll run deducts that month's amount automatically, and the payslip names the advance and the balance left. Open the employee's name in the list for their full statement.",
    ],
    notes: [
      "If net pay is too low to take the whole amount in a month, the run takes what it can and the rest carries on in later months.",
      "To stop recovery, press Stop recovery on the row. What was already deducted stays on record.",
      "The letter wording comes from the Advance Request and Advance Receipt templates. To change it, add them from the gallery in Letters › Templates (category Advance Letter) and edit your copy; the Loans page then uses your version.",
      "A one-off amount for a single month's run can also be typed in the run's Advance column, but that doesn't create a record or a receipt: use Loans & advances for a proper advance.",
    ],
    pages: ["/payroll/loans", "/approvals?type=ADVANCE", "/payroll"],
  },
  {
    id: "payroll-adjustments",
    title: "Add a deduction, bonus or recurring item to payroll",
    keywords: ["fine", "bonus", "deduction", "adjustment", "add deduction", "recurring deduction", "standing allowance", "add bonus"],
    steps: [
      "For a one-off item, open the run (while it is a draft) and use the worker's Deduction or Adjustment box. A deduction needs a note saying what it is for; an adjustment can be plus (bonus) or minus.",
      "Press Save. Net pay updates, and it never goes below zero.",
      "For something that repeats every month (a standing allowance or deduction), use Payroll › Recurring.",
      "For money given to an employee in advance, use Loans & advances instead: it is approved, recorded with the day it was given, and deducted as planned.",
    ],
    pages: ["/payroll", "/payroll/recurring", "/payroll/loans"],
  },
  {
    id: "payroll-gas",
    title: "Gas charge on payroll",
    keywords: ["gas charge", "gas deduction", "waive gas", "why gas deducted"],
    steps: [
      "The gas charge comes from the company's rule (Suppliers › company): an amount per day from the worker's site arrival date, up to a monthly limit.",
      "It only applies if the worker has a site arrival date. To stop it for one worker, tick \"Waive gas charge for this worker\" on their Payroll tab.",
      "Open the payroll run and press More › Recalculate to apply a change.",
    ],
    pages: ["/suppliers", "/employees", "/payroll"],
  },
  {
    id: "payslips-download",
    title: "Download payslips",
    keywords: ["payslip", "download payslip", "print payslip", "salary slip", "letterhead payslip", "sign payslip"],
    steps: [
      "Open the payroll run and press Payslips.",
      "Tick the employees you want (use Only for one person, or Select all). The preview shows the one you click.",
      "Choose plain paper or On letterhead, and tick the signature and stamp if the company has them on file. Type the signatory's name and title if needed.",
      "Press Download PDF. It contains exactly the people you ticked.",
    ],
    notes: ["The letterhead, signature and stamp come from the company's page (Suppliers › company) or, for older runs, Settings › Company profile."],
    pages: ["/payroll"],
  },
  {
    id: "wps-file",
    title: "Create the bank (WPS / SIF) salary file",
    keywords: ["wps", "sif", "bank file", "salary file", "mohre", "upload to bank", "wps error"],
    steps: [
      "Check the company has its MOHRE establishment ID (Suppliers › company) and an active payer bank with routing code and IBAN (Banks).",
      "Check every worker has the MOL person code, routing code and an IBAN or account number on their Payroll & WPS tab. Workers paid in cash are left out.",
      "Approve the run, then press Bank file (WPS) on it (it appears once the run is approved).",
      "Upload that file in your bank's online portal.",
    ],
    pages: ["/payroll", "/banks", "/suppliers"],
  },
  {
    id: "import-timesheet",
    title: "Import a client's monthly timesheet from Excel",
    keywords: ["import timesheet", "upload timesheet", "excel timesheet", "bulk import", "import attendance", "timesheet import error", "import skipped rows"],
    steps: [
      "Open Administration › Import Data, choose Timesheets and upload the .xlsx file.",
      "The sheet tab must be named with the month, like JULY-26 or Aug 26.",
      "The heading row needs the worker's name (Employee Name, or NAME), a supplier or company column, and the days of the month. If a column was not recognised, pick it by hand on the review screen.",
      "Check the review: companies that are not on record, workers matched by name, and any rows skipped. Fix and apply.",
      "After importing, open the payroll run for that month and press More › Recalculate to pick up the hours and attendance.",
    ],
    notes: [
      "Cells read as: a number is hours worked; A absent; SL sick leave; H holiday; L leave (HL half-day leave counts as leave); W or OFF weekly off; ND not deployed (idle). On a layout where blank means not deployed, a blank day is recorded as idle.",
      "Workers with no usable ID get a placeholder ID made from their name; where one existing worker has that name, the row is added to them.",
      "The sign-off line (Prepared By) and anything under it is ignored.",
    ],
    pages: ["/import", "/payroll"],
  },
  {
    id: "attendance-mark",
    title: "Mark and correct attendance",
    keywords: ["attendance", "mark attendance", "absent", "daily attendance", "wrong attendance", "correct attendance", "attendance sync"],
    steps: [
      "Timesheets › Daily Attendance: pick the project and date and mark each worker's status and hours.",
      "A worker needs a site arrival date before attendance can be recorded (confirm arrival on Demand › Site Arrival).",
      "To change a day that is already approved and locked, an admin must unlock it.",
      "Attendance Sync (Timesheets) pushes attendance into the client timesheets and shows where they differ. It never overwrites hand-entered values.",
    ],
    pages: ["/attendance", "/invoices/client-timesheet/sync", "/demand/site-arrival"],
  },
  {
    id: "timesheet-approval",
    title: "Client timesheet approval and invoicing",
    keywords: ["timesheet approval", "client approved", "invoice from timesheet", "generate invoice", "timesheet status", "locked timesheet", "not invoiced"],
    steps: [
      "A timesheet goes Draft → Submitted → Under review → Client approved → Locked (once invoiced).",
      "Only client-approved timesheets can be invoiced. Invoices › generate an invoice from them.",
      "A locked timesheet cannot be changed; unlock it first if a correction is needed.",
    ],
    pages: ["/invoices/client-timesheet", "/invoices"],
  },
  {
    id: "letters-issue",
    title: "Issue an employee letter",
    keywords: ["letter", "salary certificate", "noc", "experience letter", "issue letter", "letterhead", "sign letter"],
    steps: [
      "Open Letters, choose the employee and the letter.",
      "Choose whose letterhead to use, then plain paper or On letterhead. Tick signature and stamp if they are on file.",
      "Check the preview and press Issue. Issued letters can be downloaded again exactly as issued.",
    ],
    pages: ["/letters", "/letter-templates"],
  },
  {
    id: "report-problem",
    title: "Report a problem to support",
    keywords: ["bug", "error", "something wrong", "not working", "support", "report issue", "help"],
    steps: [
      "Use Report an issue at the bottom of the sidebar. Say what you were doing, what happened and what you expected; it is sent with your name and the page you were on.",
      "Or use Send to support under an assistant answer: it attaches this conversation.",
    ],
  },
];

/** Lower-case words with a plural "s" dropped, so "payslips" finds "payslip". */
const stem = (w: string) => (w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w);
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(" ").map(stem).join(" ");

/** The best matching guides for a question, best first. Matching is by words and phrases, so it needs no model call. */
export function findGuides(query: string, limit = 2): HelpGuide[] {
  const q = ` ${norm(query)} `;
  const words = new Set(norm(query).split(" ").filter((w) => w.length > 2));
  const scored = HELP_GUIDES.map((g) => {
    let score = 0;
    for (const k of g.keywords) {
      const nk = norm(k);
      if (q.includes(` ${nk} `)) score += 4 + nk.split(" ").length; // a whole phrase is a strong match
      else if (nk.split(" ").every((w) => words.has(w))) score += 2;
    }
    for (const w of norm(g.title).split(" ")) if (w.length > 3 && words.has(w)) score += 1;
    return { g, score };
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((x) => x.g);
}

/** The titles the assistant is told about, so it knows when to look a guide up. */
export const GUIDE_INDEX = HELP_GUIDES.map((g) => `- ${g.title}`).join("\n");
