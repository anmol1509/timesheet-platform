/**
 * The shape both site letters share — the NOC and the Undertaking.
 *
 * Taken from the letters the client already issues and accepts: date, the
 * addressee, the project, a title, a body naming the issuing company, a table
 * of the workers it covers, and a signature block. Only the title and body
 * differ between the two, and both of those come from a Letter Template.
 */

/** A placeholder usable in a Letter Template body. */
export type MergeField = { key: string; label: string; example: string };

/**
 * Every placeholder a letter body may use.
 *
 * Listed here so the templates screen and the letter renderer cannot disagree
 * about what is available — the screen used to name a handful in prose.
 */
export const LETTER_MERGE_FIELDS: MergeField[] = [
  { key: "CLIENTNAME", label: "Client name", example: "WADE ADAMS CONTRACTING LLC" },
  { key: "CLIENTADDRESS", label: "Client address", example: "Business Bay — Dubai" },
  { key: "PROJECTNAME", label: "Project name", example: "R1117/1 Improvement Of Al Mustaqbal Road" },
  { key: "COMPANYNAME", label: "Issuing company", example: "BURJ AL AWEER CONCRETE CARPENTER CONT" },
  // Kept for templates written before the issuing company had its own field.
  { key: "SPONSORSHIPCOMPANYNAME", label: "Issuing company (older name for it)", example: "BURJ AL AWEER CONCRETE CARPENTER CONT" },
  { key: "BRANCHNAME", label: "Branch", example: "Dubai" },
  { key: "DOCNO", label: "Document number", example: "417" },
  { key: "MOBILIZEDATE", label: "Mobilisation date", example: "27-07-2026" },
  { key: "DATE", label: "Today's date", example: "27-07-2026" },
  { key: "WORKERCOUNT", label: "Number of workers listed", example: "10" },
];

/**
 * The worker table's columns, in the order the client's own letters print them.
 *
 * S.No, Name and Company Name are always shown — they are what identifies the
 * row and who is answerable for it. The rest are optional so the NOC's existing
 * column picker keeps working; leaving them all on reproduces the client's
 * letter exactly.
 */
export const LETTER_TABLE_COLUMNS = [
  { key: "SNO", label: "S.No", width: 28, always: true },
  { key: "NAME", label: "Name", width: 90, always: true },
  { key: "COMPANY", label: "Company Name", width: 104, always: true },
  { key: "DESIGNATION", label: "Designation", width: 58, always: false },
  { key: "NATIONALITY", label: "Nationality", width: 56, always: false },
  { key: "PASSPORT", label: "Passport No.", width: 64, always: false },
  { key: "ID_NUMBER", label: "ID Number", width: 76, always: false },
  { key: "EMPLOYEE_ID", label: "Employee ID", width: 58, always: false },
  { key: "VISA_STATUS", label: "Visa Status", width: 58, always: false },
] as const;

export type LetterColumnKey = (typeof LETTER_TABLE_COLUMNS)[number]["key"];

/** The client's own letter: everything except the two extras. */
export const DEFAULT_LETTER_COLUMNS: LetterColumnKey[] = [
  "SNO", "NAME", "COMPANY", "DESIGNATION", "NATIONALITY", "PASSPORT", "ID_NUMBER",
];

/**
 * The NOC screen stores its own field keys; this maps them onto letter columns
 * so one picker drives the one table rather than two vocabularies drifting.
 */
const NOC_FIELD_TO_COLUMN: Record<string, LetterColumnKey> = {
  NAME: "NAME",
  TRADE: "DESIGNATION",
  NATIONALITY: "NATIONALITY",
  PASSPORT_NO: "PASSPORT",
  EMIRATES_ID: "ID_NUMBER",
  EMPLOYEE_ID: "EMPLOYEE_ID",
  VISA_STATUS: "VISA_STATUS",
};

export function columnsFromNocFields(fields: string[]): LetterColumnKey[] {
  if (fields.length === 0) return DEFAULT_LETTER_COLUMNS;
  const chosen = new Set<LetterColumnKey>();
  for (const f of fields) {
    const col = NOC_FIELD_TO_COLUMN[f];
    if (col) chosen.add(col);
  }
  return LETTER_TABLE_COLUMNS.filter((c) => c.always || chosen.has(c.key)).map((c) => c.key);
}

export type LetterWorker = {
  id: string;
  name: string;
  employeeIdNo: string;
  trade: string | null;
  nationality: string | null;
  passportNumber: string | null;
  emiratesId: string | null;
  visaStatus: string | null;
  /** The company the worker belongs to — printed in the Company Name column. */
  supplierId: string | null;
  supplierName: string | null;
};

export type LetterGroup = {
  /** Null when the workers have no supplier at all; still gets its own letter. */
  supplierId: string | null;
  supplierName: string | null;
  workers: LetterWorker[];
};

/**
 * Splits a selection into one letter per issuing company.
 *
 * A letter is a statement by one company about workers it is answerable for,
 * so a selection spanning three suppliers is three letters, not one with a
 * mixed table. Order follows the first appearance of each supplier, so the
 * output is stable rather than reshuffling between downloads.
 */
export function groupWorkersBySupplier(workers: LetterWorker[]): LetterGroup[] {
  const groups = new Map<string, LetterGroup>();
  for (const w of workers) {
    const key = w.supplierId ?? "";
    const existing = groups.get(key);
    if (existing) existing.workers.push(w);
    else
      groups.set(key, {
        supplierId: w.supplierId,
        supplierName: w.supplierName,
        workers: [w],
      });
  }
  return [...groups.values()];
}

export function formatLetterDate(date: Date): string {
  const d = String(date.getUTCDate()).padStart(2, "0");
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${d}-${m}-${date.getUTCFullYear()}`;
}
