// Pure (no server imports): what the AI reads off each page of a document, and how pages become documents.
import type { DocOwnerKind } from "./documentMatch";

export type Audience = "EMPLOYEE" | "SUPPLIER";
export type Confidence = "high" | "medium" | "low";

/** One page as the AI saw it. */
export type PageRead = {
  ref: string;
  type: string;
  /** True when this page belongs to the same document as the page before it (the back of a card, page 2 of a licence). */
  continuation: boolean;
  holder: string;
  idNumber: string;
  /** YYYY-MM-DD, or "" when the page shows none. */
  expiry: string;
  confidence: Confidence;
  blank: boolean;
};

/** A document found in a file: a run of pages of one type for one holder. */
export type ReadDocument = {
  /** Source file index and 1-based pages within it. A photo or other single image has pages [1]. */
  source: number;
  pages: number[];
  type: string;
  holder: string;
  idNumber: string;
  expiry: string;
  confidence: Confidence;
};

const RANK: Record<Confidence, number> = { high: 3, medium: 2, low: 1 };
const lowest = (a: Confidence, b: Confidence): Confidence => (RANK[a] <= RANK[b] ? a : b);

/** Pages in order become documents: a page continues the one before unless it says otherwise or the type or holder changes. */
export function groupPages(source: number, reads: PageRead[]): ReadDocument[] {
  const docs: ReadDocument[] = [];
  reads.forEach((r, i) => {
    if (r.blank) return;
    const prev = docs[docs.length - 1];
    const sameDoc = !!prev && r.continuation && prev.type === r.type && (!r.holder || !prev.holder || sameName(r.holder, prev.holder)) && prev.pages[prev.pages.length - 1] === i;
    if (sameDoc && prev) {
      prev.pages.push(i + 1);
      prev.holder = prev.holder || r.holder;
      prev.idNumber = prev.idNumber || r.idNumber;
      prev.expiry = prev.expiry || r.expiry;
      prev.confidence = lowest(prev.confidence, r.confidence);
    } else {
      docs.push({ source, pages: [i + 1], type: r.type, holder: r.holder, idNumber: r.idNumber, expiry: r.expiry, confidence: r.confidence });
    }
  });
  return docs;
}

const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9؀-ۿ]+/g, " ").trim();
export const sameName = (a: string, b: string) => {
  const x = squash(a).split(" ").sort().join(" "), y = squash(b).split(" ").sort().join(" ");
  return x === y || x.includes(y) || y.includes(x);
};

/** Numbers compared without dashes, spaces or case: 784-1990-1234567-1 equals 784199012345671. */
export const idKey = (s: string | null | undefined) => (s ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");

/** The record field an expiry date feeds, by document type. */
export const EXPIRY_FIELD: Record<DocOwnerKind, Record<string, string>> = {
  EMPLOYEE: {
    PASSPORT: "passportExpiry", EMIRATES_ID: "emiratesIdExpiry", VISA: "visaExpiry", RESIDENCY_ISSUANCE: "visaExpiry",
    LABOR_CARD: "laborCardExpiry", MEDICAL: "medicalExpiry", CICPA: "cicpaExpiry", INSURANCE: "insuranceExpiry", DRIVING_LICENCE: "drivingLicenceExpiry",
  },
  SUPPLIER: { TRADE_LICENSE: "tradeLicenseExpiry" },
};

/** The identity numbers on a record that a page's number can be matched against, by document type. */
export const ID_FIELDS: Record<DocOwnerKind, Record<string, string[]>> = {
  EMPLOYEE: {
    PASSPORT: ["passportNumber"], EMIRATES_ID: ["emiratesId"], LABOR_CARD: ["laborCardNumber", "laborCardPersonalNo"], VISA: ["visaNumber", "unifiedNo"], RESIDENCY_ISSUANCE: ["visaNumber", "unifiedNo"],
  },
  SUPPLIER: { TRADE_LICENSE: ["tradeLicenseNumber"], MOHRE_PERMIT: ["mohrePermitNumber"], TRN_CERTIFICATE: ["trn"] },
};
