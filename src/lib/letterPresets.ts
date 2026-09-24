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
export const EMPLOYEE_CATEGORIES = ["Salary Certificate", "Employment Certificate", "Experience Certificate", "Warning Letter", "Leave Approval Letter", "General Letter"] as const;
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
      "With reference to the above project, we, **%%COMPANYNAME%%**, are pleased to confirm the mobilization of the following **%%WORKERCOUNT%%** worker(s) to **%%PROJECTNAME%%**.",
      "Mobilization date: **%%MOBILIZEDATE%%**",
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
      "We, **%%COMPANYNAME%%**, hereby undertake the following in respect of the below-listed worker(s) deployed at **%%PROJECTNAME%%** for **%%CLIENTNAME%%**:",
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
      "We, **%%COMPANYNAME%%**, as the supplier of the below-listed **%%WORKERCOUNT%%** worker(s) to **%%BRANCHNAME%%** for deployment at **%%PROJECTNAME%%**, undertake that:",
      "- The workers are legally employed by us and hold valid UAE residence and work permits.",
      "- We are responsible for their wages, accommodation and statutory benefits unless agreed otherwise in writing.",
      "- We will replace any worker found unfit for the work at our own cost.",
    ]),
    afterTable: "Issued on %%DATE%%.",
  },

  // ---- Letters about one employee ------------------------------------------
  {
    key: "salary-certificate", audience: "EMPLOYEE", name: "Salary Certificate", category: "Salary Certificate", title: "Salary Certificate",
    blurb: "Confirms an employee's position and monthly salary, e.g. for a bank or embassy.",
    body: J([
      "**To Whom It May Concern**",
      "This is to certify that **%%EMPLOYEENAME%%** (%%NATIONALITY%%), holder of passport number %%PASSPORTNO%%, is employed with **%%COMPANYNAME%%** as **%%DESIGNATION%%** since %%JOINDATE%% (Employee ID: %%EMPLOYEEID%%).",
      "The employee's monthly salary is as follows:",
      "- Basic salary: AED %%BASICSALARY%%",
      "- **Total monthly salary: AED %%TOTALSALARY%%**",
      "This certificate is issued on %%DATE%% at the employee's request for %%ASK:Purpose of the certificate%% and does not constitute any financial liability on the company.",
    ]),
  },
  {
    key: "employment-certificate", audience: "EMPLOYEE", name: "Employment Certificate", category: "Employment Certificate", title: "Employment Certificate",
    blurb: "Confirms that a person currently works for the company, without stating salary.",
    body: J([
      "**To Whom It May Concern**",
      "This is to certify that **%%EMPLOYEENAME%%** (%%NATIONALITY%%), holder of passport number %%PASSPORTNO%%, is currently employed with **%%COMPANYNAME%%** as **%%DESIGNATION%%** and has been with us since %%JOINDATE%%.",
      "This certificate is issued on %%DATE%% at the employee's request, without any liability on the company.",
    ]),
  },
  {
    key: "experience-certificate", audience: "EMPLOYEE", name: "Experience Certificate", category: "Experience Certificate", title: "Experience Certificate",
    blurb: "Confirms a former employee's service period and role.",
    body: J([
      "**To Whom It May Concern**",
      "This is to certify that **%%EMPLOYEENAME%%** (%%NATIONALITY%%), holder of passport number %%PASSPORTNO%%, worked with **%%COMPANYNAME%%** as **%%DESIGNATION%%** from %%JOINDATE%% to %%ASK:Last working date%%.",
      "During this period the employee performed the assigned duties diligently. We wish the employee every success in future endeavours.",
      "Issued on %%DATE%%.",
    ]),
  },
  {
    key: "warning-letter", audience: "EMPLOYEE", name: "Warning Letter", category: "Warning Letter", title: "Warning Letter",
    blurb: "A formal warning to an employee about conduct or performance.",
    body: J([
      "**Subject: Warning Letter**",
      "Dear **%%EMPLOYEENAME%%** (Employee ID: %%EMPLOYEEID%%, %%DESIGNATION%%),",
      "It has been brought to our attention that on %%ASK:Date of incident%%, %%ASK:What happened%%.",
      "This conduct is not in line with company policy. You are hereby warned to ensure that it does not recur. Further violations may lead to disciplinary action in accordance with UAE labour regulations and company policy.",
      "Please acknowledge receipt of this letter by signing below.",
      "Issued on %%DATE%%.",
    ]),
  },
  {
    key: "leave-approval", audience: "EMPLOYEE", name: "Leave Approval Letter", category: "Leave Approval Letter", title: "Leave Approval",
    blurb: "Confirms approved leave for an employee, with dates.",
    body: J([
      "Dear **%%EMPLOYEENAME%%** (Employee ID: %%EMPLOYEEID%%),",
      "We are pleased to confirm that your request for **%%ASK:Type of leave%%** has been approved from **%%ASK:From date%%** to **%%ASK:To date%%**.",
      "Please ensure your duties are handed over before you leave and report back on %%ASK:Return-to-work date%%.",
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
