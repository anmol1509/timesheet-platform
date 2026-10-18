import { WORKER_TABLE_TAG, legacyTextToHtml } from "@/lib/letterHtml";
import type { Audience } from "@/lib/letterFields";

/**
 * Ready-made letter templates. Each is a sensible first draft using the merge
 * fields the renderer fills in — a branch picks one and edits it rather than
 * starting from a blank page. The wording is generic: have it checked against
 * what your clients and authorities actually expect before relying on it.
 */
export type LetterPreset = {
  key: string;
  audience: Audience;
  name: string;
  category: string;
  title: string;
  /** One line shown on the gallery card. */
  blurb: string;
  /** Text (with **bold** / "- bullets") before the worker table — or the whole letter for employee letters. */
  body: string;
  /** Site letters only: text printed underneath the worker table. */
  afterTable?: string;
};

export const SITE_CATEGORIES = ["No Objection Letter", "Mobilization Letter", "Undertaking Letter", "Supplier Undertaking"] as const;
export const EMPLOYEE_CATEGORIES = ["Salary Certificate", "Employment Certificate", "Experience Certificate", "Warning Letter", "Leave Approval Letter", "Advance Letter", "Salary Revision Letter", "Final Settlement Statement", "Salary Deduction Notice", "Salary Transfer Letter", "General Letter"] as const;
/** Kept for older imports. */
export const LETTER_CATEGORIES = SITE_CATEGORIES;
export const categoriesFor = (a: Audience): readonly string[] => (a === "EMPLOYEE" ? EMPLOYEE_CATEGORIES : SITE_CATEGORIES);

const J = (lines: string[]) => lines.join("\n");

export const LETTER_PRESETS: LetterPreset[] = [
  {
    key: "noc-standard", audience: "SITE", name: "Standard NOC", category: "No Objection Letter", title: "No Objection Certificate",
    blurb: "Confirms the company has no objection to its workers being deployed at the client's project.",
    body: J([
      "This is to certify that **%%COMPANYNAME%%** has no objection to the below-mentioned employees working at **%%PROJECTNAME%%** for **%%CLIENTNAME%%**, with effect from %%MOBILIZEDATE%%.",
      "The %%WORKERCOUNT%% employee(s) listed below are employed by us:",
    ]),
    afterTable: J([
      "We remain responsible for their employment terms, salaries and welfare for the duration of their assignment.",
      "This certificate is issued on %%DATE%% at the request of the concerned party, without any liability on our part.",
    ]),
  },
  {
    key: "mobilization-standard", audience: "SITE", name: "Standard Mobilization Letter", category: "Mobilization Letter", title: "Mobilization Letter",
    blurb: "Notifies the client which workers are being mobilised to site, and from when.",
    body: J([
      "With reference to the above project, we, **%%COMPANYNAME%%**, are pleased to confirm the mobilization of the workers listed below.",
      "| **Project**{34%} | %%PROJECTNAME%% |",
      "| **Client** | %%CLIENTNAME%% |",
      "| **Mobilization date** | **%%MOBILIZEDATE%%** |",
      "| **Number of workers** | %%WORKERCOUNT%% |",
    ]),
    afterTable: J([
      "Please arrange site access and induction for the workers listed above. They will report to your site supervisor on arrival.",
      "Kindly contact us for any clarification. Reference: %%DOCNO%%.",
    ]),
  },
  {
    key: "undertaking-standard", audience: "SITE", name: "Standard Undertaking Letter", category: "Undertaking Letter", title: "Undertaking Letter",
    blurb: "The company's undertaking about its workers' conduct, documents and compliance on site.",
    body: J([
      "We, **%%COMPANYNAME%%**, hereby undertake the following in respect of the workers listed below.",
      "| **Project**{34%} | %%PROJECTNAME%% |",
      "| **Client** | %%CLIENTNAME%% |",
      "| **Number of workers** | %%WORKERCOUNT%% |",
      "We undertake:",
      "- To maintain valid residence visas, labour cards and insurance for all workers throughout the assignment.",
      "- To ensure salaries are paid on time in accordance with UAE labour regulations.",
      "- To ensure workers comply with the client's site rules and safety requirements.",
      "- To be solely responsible for any claims arising from our workers' employment.",
    ]),
    afterTable: "This undertaking is given on %%DATE%% and remains valid for the duration of the assignment.",
  },
  {
    key: "supplier-undertaking-standard", audience: "SITE", name: "Standard Supplier Undertaking", category: "Supplier Undertaking", title: "Supplier Undertaking",
    blurb: "A supplier company's undertaking for the workers it supplies through us.",
    body: J([
      "We, **%%COMPANYNAME%%**, as the supplier of the workers listed below, undertake that:",
      "| **Supplied to**{34%} | %%BRANCHNAME%% |",
      "| **Project** | %%PROJECTNAME%% |",
      "| **Number of workers** | %%WORKERCOUNT%% |",
      "- The workers are legally employed by us and hold valid UAE residence and work permits.",
      "- We are responsible for their wages, accommodation and statutory benefits unless agreed otherwise in writing.",
      "- We will replace any worker found unfit for the work at our own cost.",
    ]),
    afterTable: "Issued on %%DATE%%.",
  },

  // ---- Letters about one employee ------------------------------------------
  // Details sit in a two-column table (`{34%}` on the first cell sets the label column's width down the table).
  {
    key: "advance-request", audience: "EMPLOYEE", name: "Advance Request", category: "Advance Letter", title: "Advance Request",
    blurb: "Records an employee's request for a salary advance, for approval, with their acknowledgement. Used for Request letter on Loans & advances.",
    body: J([
      "This is to record that **%%EMPLOYEENAME%%** of **%%COMPANYNAME%%** has requested a salary %%ADVANCETYPE%%, for approval, on the terms below.",
      "| **Employee**{34%} | %%EMPLOYEENAME%% |",
      "| **Employee ID** | %%EMPLOYEEID%% |",
      "| **Designation** | %%DESIGNATION%% |",
      "| **Amount requested** | **AED %%ADVANCEAMOUNT%%** (%%ADVANCEWORDS%%) |",
      "| **Date requested** | %%ADVANCEREQUESTEDON%% |",
      "| **Reason** | %%ADVANCEREASON%% |",
      "| **Request entered by** | %%ADVANCEREQUESTEDBY%% |",
      "| **Approval** | %%ADVANCEAPPROVAL%% |",
      "| **Deduction from salary** | %%ADVANCEPLAN%% |",
      "**Employee acknowledgement**",
      "I confirm that I have requested this %%ADVANCETYPE%% and I authorise the company to deduct it from my salary as shown above.",
    ]),
  },
  {
    key: "advance-receipt", audience: "EMPLOYEE", name: "Advance Receipt", category: "Advance Letter", title: "Advance Receipt",
    blurb: "Confirms the advance was handed over, how it is deducted, and has the employee acknowledge receiving it. Used for Receipt on Loans & advances.",
    body: J([
      "This is to confirm that **%%COMPANYNAME%%** has advanced the amount below to **%%EMPLOYEENAME%%**.",
      "| **Employee**{34%} | %%EMPLOYEENAME%% |",
      "| **Employee ID** | %%EMPLOYEEID%% |",
      "| **Designation** | %%DESIGNATION%% |",
      "| **Amount paid** | **AED %%ADVANCEAMOUNT%%** (%%ADVANCEWORDS%%) |",
      "| **Date paid** | %%ADVANCEGIVEN%% |",
      "| **Paid by** | %%ADVANCEPAYMENT%% |",
      "| **Our reference** | %%ADVANCEREF%% |",
      "| **Approval** | %%ADVANCEAPPROVAL%% |",
      "| **Deduction from salary** | %%ADVANCEPLAN%% |",
      "| **Balance still to deduct** | AED %%ADVANCEBALANCE%% |",
      "**Employee acknowledgement**",
      "I, %%EMPLOYEENAME%%, acknowledge that I received the amount above on %%ADVANCEGIVEN%% as a salary %%ADVANCETYPE%%, and I authorise the company to deduct it from my salary as shown.",
    ]),
  },
  {
    key: "salary-revision", audience: "EMPLOYEE", name: "Salary Revision Letter", category: "Salary Revision Letter", title: "Salary Revision Letter",
    blurb: "Tells an employee their monthly salary has changed, from when, and from what to what. Used from the worker's Salary history.",
    body: J([
      "Dear **%%EMPLOYEENAME%%** (Employee ID %%EMPLOYEEID%%, %%DESIGNATION%%),",
      "We are writing to confirm a change to your total monthly salary with **%%COMPANYNAME%%**.",
      "| **Effective from**{34%} | **%%SALARYEFFECTIVE%%** |",
      "| **Previous monthly salary** | AED %%SALARYBEFORE%% |",
      "| **Revised monthly salary** | **AED %%SALARYAFTER%%** |",
      "| **Change** | AED %%SALARYCHANGE%% (%%SALARYCHANGEPCT%%) |",
      "| **Reason** | %%SALARYREASON%% |",
      "All other terms and conditions of your employment remain unchanged.",
      "**Employee acknowledgement**",
      "I acknowledge the revised salary stated above.",
    ]),
  },
  {
    key: "final-settlement", audience: "EMPLOYEE", name: "Final Settlement Statement", category: "Final Settlement Statement", title: "Final Settlement Statement",
    blurb: "Itemises what a leaver is owed and owes, with the net amount, and has them acknowledge it. Used from a final settlement.",
    body: J([
      "This is the final settlement statement for **%%EMPLOYEENAME%%** of **%%COMPANYNAME%%**.",
      "| **Employee**{34%} | %%EMPLOYEENAME%% |",
      "| **Employee ID** | %%EMPLOYEEID%% |",
      "| **Designation** | %%DESIGNATION%% |",
      "| **Last working day** | %%SETTLEEXIT%% |",
      "| **Reason for leaving** | %%SETTLEREASON%% |",
      "| **Years of service** | %%SETTLEYEARS%% |",
      "**Amounts due to the employee**",
      "| Item{70%} | Amount (AED) |",
      "|---|---|",
      "| Gratuity | %%SETTLEGRATUITY%% |",
      "| Salary for days worked, not yet paid | %%SETTLEUNPAID%% |",
      "| Leave pay | %%SETTLELEAVE%% |",
      "| Notice pay | %%SETTLENOTICE%% |",
      "| Other amounts due to the employee | %%SETTLEOTHEREARN%% |",
      "| **Total due to the employee** | **%%SETTLETOTALEARN%%** |",
      "**Deductions**",
      "| Item{70%} | Amount (AED) |",
      "|---|---|",
      "| Loans and advances outstanding | %%SETTLELOAN%% |",
      "| Other amounts due from the employee | %%SETTLEOTHERDED%% |",
      "| **Total deductions** | **%%SETTLETOTALDED%%** |",
      "**Net amount %%SETTLENETLABEL%%: AED %%SETTLENET%%**",
      "**Employee acknowledgement**",
      "I acknowledge the statement above. On receiving the net amount payable, I confirm that I have no further claim against the company in respect of my employment.",
    ]),
  },
  {
    key: "deduction-notice", audience: "EMPLOYEE", name: "Salary Deduction Notice", category: "Salary Deduction Notice", title: "Salary Deduction Notice",
    blurb: "Tells an employee an amount will be deducted from their salary, for what, and in which month. Used from the payroll run's Deduction.",
    body: J([
      "Dear **%%EMPLOYEENAME%%** (Employee ID %%EMPLOYEEID%%, %%DESIGNATION%%),",
      "This is to inform you of a deduction from your salary.",
      "| **Salary month**{34%} | %%DEDUCTIONMONTH%% |",
      "| **Amount to be deducted** | **AED %%DEDUCTIONAMOUNT%%** |",
      "| **Reason** | %%DEDUCTIONREASON%% |",
      "If you disagree with this deduction, please contact the HR department before the salary is processed.",
      "**Employee acknowledgement**",
      "I acknowledge that I have been informed of this deduction and its reason.",
    ]),
  },
  {
    key: "salary-transfer-letter", audience: "EMPLOYEE", name: "Salary Transfer Letter", category: "Salary Transfer Letter", title: "Salary Transfer Letter",
    blurb: "Confirms to a bank that the employee's salary is paid into their account, with the amount. Choose it on the Letters screen.",
    body: J([
      "**To: %%ASK:Bank name%%**",
      "This is to confirm that **%%EMPLOYEENAME%%** is employed with **%%COMPANYNAME%%** and that the employee's salary is credited each month to the account below through the UAE Wages Protection System.",
      "| **Employee**{34%} | %%EMPLOYEENAME%% (%%NATIONALITY%%) |",
      "| **Passport number** | %%PASSPORTNO%% |",
      "| **Designation** | %%DESIGNATION%% |",
      "| **Date of joining** | %%JOINDATE%% |",
      "| **Total monthly salary** | **AED %%TOTALSALARY%%** |",
      "| **Bank** | %%BANKNAME%% |",
      "| **Account or IBAN** | %%IBAN%% |",
      "This letter is issued on %%DATE%% at the employee's request, without any liability on the part of the company.",
    ]),
  },
  {
    key: "salary-certificate", audience: "EMPLOYEE", name: "Salary Certificate", category: "Salary Certificate", title: "Salary Certificate",
    blurb: "Confirms an employee's position and monthly salary, e.g. for a bank or embassy.",
    body: J([
      "**To Whom It May Concern**",
      "This is to certify that **%%EMPLOYEENAME%%** is employed with **%%COMPANYNAME%%** and has been since %%JOINDATE%%. The details below are taken from the company's records.",
      "| **Employee name**{34%} | %%EMPLOYEENAME%% |",
      "| **Employee ID** | %%EMPLOYEEID%% |",
      "| **Nationality** | %%NATIONALITY%% |",
      "| **Passport number** | %%PASSPORTNO%% |",
      "| **Designation** | %%DESIGNATION%% |",
      "| **Date of joining** | %%JOINDATE%% |",
      "| **Basic salary** | AED %%BASICSALARY%% per month |",
      "| **Total monthly salary** | **AED %%TOTALSALARY%%** |",
      "This certificate is issued on %%DATE%% at the employee's request for %%ASK:Purpose of the certificate%%. It does not constitute any financial liability on the company.",
    ]),
  },
  {
    key: "employment-certificate", audience: "EMPLOYEE", name: "Employment Certificate", category: "Employment Certificate", title: "Employment Certificate",
    blurb: "Confirms that a person currently works for the company, without stating salary.",
    body: J([
      "**To Whom It May Concern**",
      "This is to certify that **%%EMPLOYEENAME%%** is currently employed with **%%COMPANYNAME%%**. The details below are taken from the company's records.",
      "| **Employee name**{34%} | %%EMPLOYEENAME%% |",
      "| **Employee ID** | %%EMPLOYEEID%% |",
      "| **Nationality** | %%NATIONALITY%% |",
      "| **Passport number** | %%PASSPORTNO%% |",
      "| **Designation** | %%DESIGNATION%% |",
      "| **Date of joining** | %%JOINDATE%% |",
      "This certificate is issued on %%DATE%% at the employee's request, without any liability on the company.",
    ]),
  },
  {
    key: "experience-certificate", audience: "EMPLOYEE", name: "Experience Certificate", category: "Experience Certificate", title: "Experience Certificate",
    blurb: "Confirms a former employee's service period and role.",
    body: J([
      "**To Whom It May Concern**",
      "This is to certify that **%%EMPLOYEENAME%%** worked with **%%COMPANYNAME%%**, as set out below.",
      "| **Employee name**{34%} | %%EMPLOYEENAME%% |",
      "| **Employee ID** | %%EMPLOYEEID%% |",
      "| **Nationality** | %%NATIONALITY%% |",
      "| **Passport number** | %%PASSPORTNO%% |",
      "| **Designation** | %%DESIGNATION%% |",
      "| **Period of service** | %%JOINDATE%% to %%ASK:Last working date%% |",
      "During this period the employee performed the assigned duties diligently. We wish the employee every success in future endeavours.",
      "Issued on %%DATE%%.",
    ]),
  },
  {
    key: "warning-letter", audience: "EMPLOYEE", name: "Warning Letter", category: "Warning Letter", title: "Warning Letter",
    blurb: "A formal warning to an employee about conduct or performance.",
    body: J([
      "**Subject: Warning Letter**",
      "Dear **%%EMPLOYEENAME%%**,",
      "It has been brought to our attention that your conduct was not in line with company policy, as set out below.",
      "| **Employee**{34%} | %%EMPLOYEENAME%% |",
      "| **Employee ID** | %%EMPLOYEEID%% |",
      "| **Designation** | %%DESIGNATION%% |",
      "| **Date of incident** | %%ASK:Date of incident%% |",
      "| **What happened** | %%ASK:What happened%% |",
      "| **Date of this warning** | %%DATE%% |",
      "You are hereby warned to ensure that it does not recur. Further violations may lead to disciplinary action in accordance with UAE labour regulations and company policy.",
      "Please acknowledge receipt of this letter by signing below.",
    ]),
  },
  {
    key: "leave-approval", audience: "EMPLOYEE", name: "Leave Approval Letter", category: "Leave Approval Letter", title: "Leave Approval",
    blurb: "Confirms approved leave for an employee, with dates.",
    body: J([
      "Dear **%%EMPLOYEENAME%%**,",
      "We are pleased to confirm that your leave request has been approved on the terms below.",
      "| **Employee**{34%} | %%EMPLOYEENAME%% (Employee ID %%EMPLOYEEID%%) |",
      "| **Type of leave** | %%ASK:Type of leave%% |",
      "| **From** | %%ASK:From date%% |",
      "| **To** | %%ASK:To date%% |",
      "| **Return to work on** | %%ASK:Return-to-work date%% |",
      "Please make sure your duties are handed over before you leave.",
      "Issued on %%DATE%%.",
    ]),
  },
];

export const presetByKey = (key: string | null | undefined) => LETTER_PRESETS.find((p) => p.key === key) ?? null;

/** The preset's body as editor HTML (with the worker table marker between the two halves for site letters). */
export function presetHtml(p: LetterPreset): string {
  if (p.audience === "EMPLOYEE") return legacyTextToHtml(p.body);
  return legacyTextToHtml(p.body) + WORKER_TABLE_TAG + (p.afterTable ? legacyTextToHtml(p.afterTable) : "");
}
