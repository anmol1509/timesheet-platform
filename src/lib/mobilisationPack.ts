/**
 * The document types a mobilisation pack can include.
 *
 * These are the papers a client or a site gate actually asks for before a
 * worker starts. Two of them don't live on the worker at all: the trade licence
 * and the workmen's compensation certificate belong to the company sponsoring
 * or employing them.
 */
export type PackSection = {
  key: string;
  label: string;
  hint?: string;
  /** Document.type values on the employee that satisfy this section. */
  employeeTypes?: string[];
  /**
   * Attachment.docType values on the employing/sponsoring company. Several
   * spellings are accepted because these are typed by whoever uploaded them.
   */
  companyTypes?: string[];
};

export const PACK_SECTIONS: PackSection[] = [
  // DOCUMENT_PACK appears in both scan sections: when a worker's papers were
  // uploaded as one bundle, that file is the passport and ID copy.
  { key: "passport", label: "Passport", employeeTypes: ["PASSPORT", "DOCUMENT_PACK"] },
  {
    key: "emirates_id",
    label: "Emirates ID",
    // A worker who hasn't been issued the card yet has one of the substitutes
    // instead, so the section accepts any of them rather than coming back empty.
    hint: "Falls back to visa copy, entry permit or the ID application form",
    employeeTypes: [
      "EMIRATES_ID",
      "RESIDENCY_ISSUANCE",
      "VISA",
      "ENTRY_PERMIT",
      "DOCUMENT_PACK",
    ],
  },
  { key: "labour_card", label: "Labour card", employeeTypes: ["LABOR_CARD"] },
  {
    key: "trade_license",
    label: "Trade licence of sponsor",
    hint: "Sponsorship company, or the supplier if the sponsor has none on file",
    companyTypes: ["TRADE_LICENSE", "TRADE_LICENCE", "TRADELICENSE"],
  },
  {
    key: "workmen_comp",
    label: "Workmen's compensation",
    hint: "Sponsorship company, or the supplier if the sponsor has none on file",
    companyTypes: [
      "WORKMEN_COMPENSATION_INSURANCE",
      "WORKMEN_COMPENSATION",
      "WORKMENS_COMPENSATION",
    ],
  },
];

/** Strips anything that would break a path inside the zip. */
export function packSafeName(value: string) {
  return value.replace(/[^A-Za-z0-9 ._-]/g, "").trim() || "document";
}
