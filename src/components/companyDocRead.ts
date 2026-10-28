/** What reading a company document gave: which kind it is, its expiry, and its number when it prints one. */
export type CompanyDocRead = { docType: string; expiry: string; number: string; issue: string };

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Asks the AI to read a company document (trade licence, MOHRE permit, establishment card...). Nothing is stored; the form
 * shows what was read and the person checks it before saving. Resolves to null when the file can't be read (AI not switched on,
 * credits used up, unreadable, too big), and the person then types the expiry themselves.
 */
export async function readCompanyDoc(file: File): Promise<CompanyDocRead | null> {
  const fd = new FormData();
  fd.set("file", file);
  try {
    const res = await fetch("/api/documents/extract-company", { method: "POST", body: fd });
    if (!res.ok) return null;
    const j = (await res.json()) as { docType?: string; tradeLicenseExpiry?: string; documentExpiry?: string; issueDate?: string; tradeLicenseNumber?: string; mohrePermitNumber?: string; trn?: string };
    const docType = j.docType ?? "OTHER";
    // A trade licence's own expiry is the licence expiry; any other document's is the date printed on that document.
    const pick = docType === "TRADE_LICENSE" ? j.tradeLicenseExpiry || j.documentExpiry : j.documentExpiry || j.tradeLicenseExpiry;
    const expiry = pick && ISO.test(pick) ? pick : "";
    const number = (docType === "TRADE_LICENSE" ? j.tradeLicenseNumber : docType === "MOHRE_PERMIT" ? j.mohrePermitNumber : docType === "TRN_CERTIFICATE" ? j.trn : "") ?? "";
    const issue = j.issueDate && ISO.test(j.issueDate) ? j.issueDate : "";
    return { docType, expiry, number, issue };
  } catch {
    return null;
  }
}
