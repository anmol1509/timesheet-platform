/** Placeholders a saved quotation cover text may use, filled in when the PDF is made. */
export const COVER_FIELDS = [
  { key: "CLIENT", label: "Client name" },
  { key: "CONTACT", label: "Contact person" },
  { key: "QUOTATION_NO", label: "Quotation number" },
  { key: "DATE", label: "Today's date" },
  { key: "VALID_UNTIL", label: "Valid until" },
  { key: "TOTAL", label: "Total per month" },
  { key: "COMPANY", label: "Our company name" },
] as const;

export const STANDARD_INTRO = "Thank you for your enquiry. We are pleased to submit our quotation for the supply of manpower to {CLIENT}, as set out below.";

const norm = (key: string) => key.toUpperCase();

/** Replaces {FIELD} with its value; a field that is empty (no contact, no validity date) simply disappears. */
export function fillCoverText(text: string, facts: { client: string; contact: string; quotationNo: string; date: string; validUntil: string; total: string; company: string }): string {
  const map: Record<string, string> = { CLIENT: facts.client, CONTACT: facts.contact || "Sir / Madam", QUOTATION_NO: facts.quotationNo, DATE: facts.date, VALID_UNTIL: facts.validUntil, TOTAL: facts.total, COMPANY: facts.company };
  return text.replace(/\{([A-Za-z_]+)\}/g, (m, k: string) => (norm(k) in map ? map[norm(k)] : m)).replace(/[ \t]+\n/g, "\n").trim();
}
