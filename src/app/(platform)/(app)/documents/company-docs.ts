import { span, stateOf, type CellState } from "./matrix";

/** The documents a supplier company holds, in the order the columns run. */
export const COMPANY_TYPES = [
  { key: "TRADE_LICENSE", label: "Trade licence", types: ["TRADE_LICENSE", "TRADE_LICENCE"] },
  { key: "VAT", label: "VAT certificate", types: ["TRN_CERTIFICATE", "VAT_CERTIFICATE"] },
  { key: "WC", label: "Workmen comp", types: ["WORKMEN_COMPENSATION_INSURANCE", "WORKMEN_COMPENSATION"] },
  { key: "MOHRE", label: "MOHRE permit", types: ["MOHRE_PERMIT"] },
  { key: "ESTABLISHMENT", label: "Establishment card", types: ["ESTABLISHMENT_CARD"] },
] as const;
export type CompanyKey = (typeof COMPANY_TYPES)[number]["key"];
export const COMPANY_LABEL = Object.fromEntries(COMPANY_TYPES.map((t) => [t.key, t.label])) as Record<CompanyKey, string>;
/** Every attachment doc type the companies view reads. */
export const COMPANY_DOC_TYPES: string[] = COMPANY_TYPES.flatMap((t) => [...t.types]);

export type CompanyState = CellState | "na";
export type CompanyCell = { state: CompanyState; label: string; sub: string; attachmentId?: string };
export type CompanySupplier = { id: string; name: string; trn: string | null; tradeLicenseExpiry: string | null };
export type CompanyAttachment = { id: string; supplierId: string; docType: string; expiryDate: string | null; uploadedAt: string };

const LABEL: Record<CompanyState, string> = { valid: "Valid", expiring: "Expiring", expired: "Expired", missing: "Missing", notlisted: "Not listed", na: "Not needed" };

/**
 * One cell per supplier and document. The current document is the one that runs longest, since a renewal replaces an
 * old one. A supplier with no VAT number is not expected to hold a VAT certificate (unless it has uploaded one), so
 * that cell reads "Not needed" instead of "Missing".
 */
export function buildCompanyCells(suppliers: CompanySupplier[], attachments: CompanyAttachment[], now: number) {
  const best = new Map<string, CompanyAttachment>();
  const rank = (a: CompanyAttachment) => (a.expiryDate ? new Date(a.expiryDate).getTime() : new Date(a.uploadedAt).getTime() - 1e13);
  for (const a of attachments) {
    const key = COMPANY_TYPES.find((t) => (t.types as readonly string[]).includes(a.docType))?.key;
    if (!key) continue;
    const k = `${a.supplierId}|${key}`;
    const cur = best.get(k);
    if (!cur || rank(a) > rank(cur)) best.set(k, a);
  }
  const cells = new Map<string, Record<CompanyKey, CompanyCell>>();
  for (const s of suppliers) {
    const row = {} as Record<CompanyKey, CompanyCell>;
    for (const t of COMPANY_TYPES) {
      const a = best.get(`${s.id}|${t.key}`);
      // The trade licence date on the supplier record counts when the file itself has none.
      const expiry = a ? a.expiryDate ?? (t.key === "TRADE_LICENSE" ? s.tradeLicenseExpiry : null) : null;
      if (a) {
        const state = stateOf(expiry, now);
        row[t.key] = { state, label: LABEL[state], sub: span(expiry, now), attachmentId: a.id };
      } else if (t.key === "VAT" && !s.trn) {
        row[t.key] = { state: "na", label: LABEL.na, sub: "No VAT no." };
      } else {
        row[t.key] = { state: "missing", label: LABEL.missing, sub: "—" };
      }
    }
    cells.set(s.id, row);
  }
  return cells;
}

/** How many of the documents a supplier is expected to hold are on file and not expired. */
export function companyComplete(row: Record<CompanyKey, CompanyCell>) {
  const expected = COMPANY_TYPES.filter((t) => row[t.key].state !== "na");
  const ok = expected.filter((t) => row[t.key].state === "valid" || row[t.key].state === "expiring");
  return { ok: ok.length, of: expected.length };
}

/** Worst first: expired counts most, then missing, then expiring. */
export const companyBadness = (row: Record<CompanyKey, CompanyCell>) =>
  COMPANY_TYPES.reduce((n, t) => n + (row[t.key].state === "expired" ? 3 : row[t.key].state === "missing" ? 2 : row[t.key].state === "expiring" ? 1 : 0), 0);

/** The attachment ids to print for chosen suppliers and chosen document kinds, supplier by supplier in column order. */
export function companyPrintIds(supplierIds: string[], keys: CompanyKey[], cells: Map<string, Record<CompanyKey, CompanyCell>>) {
  const ids: string[] = [];
  let missing = 0;
  for (const s of supplierIds) {
    const row = cells.get(s);
    if (!row) continue;
    for (const t of COMPANY_TYPES) {
      if (!keys.includes(t.key)) continue;
      const c = row[t.key];
      if (c.attachmentId) ids.push(`att:${c.attachmentId}`);
      else if (c.state !== "na") missing++;
    }
  }
  return { ids, missing };
}
