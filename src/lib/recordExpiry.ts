import { DEFAULT_REMINDER_DAYS } from "@/lib/documentTypes";

/**
 * Expiring documents kept on records other than workers, companies, owners and vehicles: a client's or project's papers,
 * and files attached to a quotation, enquiry, supplier bill or expense. A document is tracked exactly when it was given
 * an expiry date, so anything that has one is reminded about. Pure, so the rules can be tested without a database.
 */
export type RecordSource = "clientdoc" | "projdoc" | "attach";

export type RecordFile = {
  source: RecordSource;
  /** The document's own id. */
  id: string;
  /** What it is filed against: its name for the queue ("Al Noor Contracting", "Quotation QT-0042"). */
  ownerId: string;
  ownerName: string;
  /** "Client", "Project", "Quotation"… */
  ownerKind: string;
  href: string;
  docType: string;
  filename: string;
  expiryDate: Date;
};

export type RecordExpiry = {
  /** `source:id`, so a document id can never be mistaken for a worker's or a company's. */
  subjectId: string;
  subjectName: string;
  subjectRef: string;
  href: string;
  document: string;
  docType: string;
  expiry: Date;
  reminderDays: number[];
};

const TYPE_LABEL: Record<string, string> = {
  TRADE_LICENSE: "Trade licence",
  TRN_CERTIFICATE: "VAT certificate",
  CONTRACT: "Contract",
  LPO: "LPO",
  PERMIT: "Permit",
  RFQ: "Client's RFQ",
  SIGNED_ACCEPTANCE: "Signed acceptance",
  BILL: "Supplier bill",
  CREDIT_NOTE: "Credit note",
  PROOF: "Proof of payment",
  RECEIPT: "Receipt",
  INVOICE: "Invoice",
};
/** A renewal replaces the old one of these, so only the latest counts. Everything else can legitimately exist several times. */
const SINGLE = new Set(["TRADE_LICENSE", "TRN_CERTIFICATE"]);

/** "Fire safety certificate.pdf" becomes "Fire safety certificate". */
const stem = (filename: string) => filename.replace(/\.[A-Za-z0-9]{1,5}$/, "").trim() || filename;
const humanise = (t: string) => (t.charAt(0) + t.slice(1).toLowerCase()).replace(/_/g, " ");

export function documentLabel(docType: string, filename: string): string {
  if (docType === "OTHER") return stem(filename);
  return TYPE_LABEL[docType] ?? humanise(docType);
}

export function recordExpiries(files: RecordFile[]): RecordExpiry[] {
  const latest = new Map<string, RecordFile>();
  const out: RecordExpiry[] = [];
  const add = (f: RecordFile) =>
    out.push({ subjectId: `${f.source}:${f.id}`, subjectName: f.ownerName, subjectRef: f.ownerKind, href: f.href, document: documentLabel(f.docType, f.filename), docType: f.docType, expiry: f.expiryDate, reminderDays: DEFAULT_REMINDER_DAYS });
  for (const f of files) {
    if (!SINGLE.has(f.docType)) { add(f); continue; }
    const k = `${f.source}|${f.ownerId}|${f.docType}`;
    const cur = latest.get(k);
    if (!cur || f.expiryDate > cur.expiryDate) latest.set(k, f);
  }
  for (const f of latest.values()) add(f);
  return out;
}
