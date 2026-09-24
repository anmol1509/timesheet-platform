/**
 * Ready-made letter templates. Each is a sensible starting point using the
 * merge fields the renderer fills in (see LETTER_MERGE_FIELDS) — a branch picks
 * one and edits the wording rather than starting from a blank box.
 *
 * The wording is generic. Have it checked against what your clients and
 * authorities actually expect before relying on it.
 */
export type LetterPreset = {
  key: string;
  name: string;
  category: string;
  title: string;
  /** One line shown on the gallery card. */
  blurb: string;
  body: string;
};

export const LETTER_CATEGORIES = [
  "No Objection Letter",
  "Mobilization Letter",
  "Undertaking Letter",
  "Supplier Undertaking",
] as const;

export const LETTER_PRESETS: LetterPreset[] = [
  {
    key: "noc-standard",
    name: "Standard NOC",
    category: "No Objection Letter",
    title: "No Objection Certificate",
    blurb: "Confirms the company has no objection to its workers being deployed at the client's project.",
    body: [
      "This is to certify that **%%COMPANYNAME%%** has no objection to the below-mentioned employees working at **%%PROJECTNAME%%** for **%%CLIENTNAME%%**, with effect from %%MOBILIZEDATE%%.",
      "The %%WORKERCOUNT%% employee(s) listed below are employed by us, and we remain responsible for their employment terms, salaries and welfare for the duration of their assignment.",
      "This certificate is issued on %%DATE%% at the request of the concerned party, without any liability on our part.",
    ].join("\n"),
  },
  {
    key: "mobilization-standard",
    name: "Standard Mobilization Letter",
    category: "Mobilization Letter",
    title: "Mobilization Letter",
    blurb: "Notifies the client which workers are being mobilised to site, and from when.",
    body: [
      "With reference to the above project, we, **%%COMPANYNAME%%**, are pleased to confirm the mobilization of the following **%%WORKERCOUNT%%** worker(s) to **%%PROJECTNAME%%**.",
      "Mobilization date: **%%MOBILIZEDATE%%**",
      "Please arrange site access and induction for the workers listed below. They will report to your site supervisor on arrival.",
      "Kindly contact us for any clarification. Reference: %%DOCNO%%.",
    ].join("\n"),
  },
  {
    key: "undertaking-standard",
    name: "Standard Undertaking Letter",
    category: "Undertaking Letter",
    title: "Undertaking Letter",
    blurb: "The company's undertaking about its workers' conduct, documents and compliance on site.",
    body: [
      "We, **%%COMPANYNAME%%**, hereby undertake the following in respect of the below-listed worker(s) deployed at **%%PROJECTNAME%%** for **%%CLIENTNAME%%**:",
      "- To maintain valid residence visas, labour cards and insurance for all workers throughout the assignment.",
      "- To ensure salaries are paid on time in accordance with UAE labour regulations.",
      "- To ensure workers comply with the client's site rules and safety requirements.",
      "- To be solely responsible for any claims arising from our workers' employment.",
      "This undertaking is given on %%DATE%% and remains valid for the duration of the assignment.",
    ].join("\n"),
  },
  {
    key: "supplier-undertaking-standard",
    name: "Standard Supplier Undertaking",
    category: "Supplier Undertaking",
    title: "Supplier Undertaking",
    blurb: "A supplier company's undertaking for the workers it supplies through us.",
    body: [
      "We, **%%COMPANYNAME%%**, as the supplier of the below-listed **%%WORKERCOUNT%%** worker(s) to **%%BRANCHNAME%%** for deployment at **%%PROJECTNAME%%**, undertake that:",
      "- The workers are legally employed by us and hold valid UAE residence and work permits.",
      "- We are responsible for their wages, accommodation and statutory benefits unless agreed otherwise in writing.",
      "- We will replace any worker found unfit for the work at our own cost.",
      "Issued on %%DATE%%.",
    ].join("\n"),
  },
];

export const presetByKey = (key: string | null | undefined) => LETTER_PRESETS.find((p) => p.key === key) ?? null;
