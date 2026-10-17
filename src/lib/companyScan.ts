import { formatMasked } from "@/lib/idFormats";
import { normalizePhone } from "@/lib/phone";
import type { ExtractedCompanyFields } from "@/app/api/documents/extract-company/route";

/**
 * What a scanned company document (trade licence, TRN certificate, MOHRE permit) does to a supplier or client
 * record, decided without touching the database so both quick views apply the same rules: empty fields are filled,
 * a later licence expiry replaces an older one, and anything else that disagrees with the record is handed back as
 * a conflict to choose from. Values that fail their own format check count as not read.
 */
export type CompanyScanPlan = {
  result: {
    applied: { key: string; label: string; value: string }[];
    conflicts: { key: string; label: string; current: string; scan: string }[];
  };
  /** Column values to write. */
  data: Record<string, unknown>;
  /** What those columns held before, for the audit log. */
  was: Record<string, unknown>;
};

type Spec = { key: keyof ExtractedCompanyFields & string; column: string; label: string; kind: "text" | "trn" | "date" | "phone" | "email"; renewable?: boolean };
const SPECS: Spec[] = [
  { key: "tradeLicenseNumber", column: "tradeLicenseNumber", label: "Trade licence number", kind: "text" },
  { key: "tradeLicenseExpiry", column: "tradeLicenseExpiry", label: "Trade licence expiry", kind: "date", renewable: true },
  { key: "trn", column: "trn", label: "TRN", kind: "trn" },
  { key: "mohrePermitNumber", column: "mohrePermitNumber", label: "MOHRE permit number", kind: "text" },
  { key: "emirate", column: "emirate", label: "Emirate", kind: "text" },
  { key: "phone", column: "contactPhone", label: "Contact phone", kind: "phone" },
  { key: "email", column: "contactEmail", label: "Contact email", kind: "email" },
];

function read(kind: Spec["kind"], raw: unknown): string | null {
  const t = typeof raw === "string" ? raw.trim() : "";
  if (!t) return null;
  if (kind === "date") return /^\d{4}-\d{2}-\d{2}$/.test(t) && !Number.isNaN(new Date(t).getTime()) ? t : null;
  if (kind === "trn") return t.replace(/\D/g, "").length === 15 ? formatMasked("trn", t) : null;
  if (kind === "phone") return normalizePhone(t);
  if (kind === "email") return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(t) ? t : null;
  return t;
}

const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

export function planCompanyScan(before: Record<string, unknown>, fields: ExtractedCompanyFields, skipColumns: readonly string[]): CompanyScanPlan {
  const result: CompanyScanPlan["result"] = { applied: [], conflicts: [] };
  const data: Record<string, unknown> = {};
  const was: Record<string, unknown> = {};
  for (const spec of SPECS) {
    if (skipColumns.includes(spec.column)) continue;
    // A trade licence's own expiry only counts when the document is a trade licence.
    if (spec.key === "tradeLicenseExpiry" && fields.docType && fields.docType !== "TRADE_LICENSE") continue;
    const scan = read(spec.kind, fields[spec.key]);
    if (!scan) continue;
    const cur = before[spec.column];
    const current = cur instanceof Date ? iso(cur) : ((cur as string | null) ?? null);
    if (!current) {
      data[spec.column] = spec.kind === "date" ? new Date(scan) : scan;
      was[spec.column] = cur ?? null;
      result.applied.push({ key: spec.column, label: spec.label, value: scan });
    } else if (current === scan || current.replace(/\W/g, "").toUpperCase() === scan.replace(/\W/g, "").toUpperCase()) {
      continue;
    } else if (spec.renewable) {
      if (scan > current) {
        data[spec.column] = new Date(scan);
        was[spec.column] = cur;
        result.applied.push({ key: spec.column, label: spec.label, value: scan });
      } // an older expiry than the one on file is an old scan: leave the newer date alone
    } else {
      result.conflicts.push({ key: spec.column, label: spec.label, current, scan });
    }
  }
  return { result, data, was };
}
