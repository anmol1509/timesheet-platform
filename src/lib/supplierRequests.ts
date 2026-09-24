/**
 * Rules for what a supplier may ask to change on its own record. Pure, so the
 * portal (which validates) and the office (which applies) agree exactly.
 *
 * Only these fields can ever be written from a request — the payload is a plain
 * JSON blob from the portal, so it is filtered here, never trusted.
 */
export const BANK_FIELDS = ["bankName", "iban", "bankAccountName", "bankAccountNumber", "bankEmirate"] as const;
export const CONTACT_FIELDS = ["contactPerson", "contactPhone", "contactEmail", "phone", "poBox", "location"] as const;

export type ChangeKind = "BANK" | "CONTACT";
export const FIELDS_FOR: Record<ChangeKind, readonly string[]> = { BANK: BANK_FIELDS, CONTACT: CONTACT_FIELDS };

export const FIELD_LABELS: Record<string, string> = {
  bankName: "Bank", iban: "IBAN", bankAccountName: "Account name", bankAccountNumber: "Account number", bankEmirate: "Bank emirate",
  contactPerson: "Contact person", contactPhone: "Mobile (also your portal sign-in number)", contactEmail: "Email", phone: "Other phone", poBox: "P.O. Box", location: "Location",
};

/** Keeps only the whitelisted fields for the kind, trimmed; empty strings are dropped. */
export function sanitizePayload(kind: ChangeKind, raw: unknown): Record<string, string> {
  const allowed = new Set(FIELDS_FOR[kind]);
  const out: Record<string, string> = {};
  if (raw && typeof raw === "object") {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (!allowed.has(k) || typeof v !== "string") continue;
      const t = v.trim();
      if (t) out[k] = t.slice(0, 200);
    }
  }
  return out;
}

/** Only fields that actually differ from what is on file — so a request shows exactly what would change. */
export function changedFields(current: Record<string, string | null | undefined>, requested: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(requested)) {
    if ((current[k] ?? "").trim().toLowerCase() !== v.trim().toLowerCase()) out[k] = v;
  }
  return out;
}

/** ISO 13616 mod-97 check, so a mistyped IBAN is caught before anyone reviews it. */
export function isValidIban(input: string): boolean {
  const iban = input.replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  if (iban.startsWith("AE") && iban.length !== 23) return false; // UAE IBANs are exactly 23 characters
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const ch of rearranged) {
    const v = ch >= "A" ? ch.charCodeAt(0) - 55 : Number(ch);
    remainder = Number(`${remainder}${v}`) % 97;
  }
  return remainder === 1;
}

/** Initials of every word in a company name: "Peak Tower Tiles Fixing Cont" gives PTTFC. */
export function initialsOf(name: string) {
  return name
    .split(/[\s\-/&.]+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .replace(/[^A-Za-z]/g, "")
    .toUpperCase()
    .slice(0, 6);
}

/** The next free employee ID under a prefix, continuing from the highest serial in use. */
export function nextEmployeeId(prefix: string, existing: string[]): string {
  let highest = 0;
  for (const id of existing) {
    if (!id.startsWith(prefix)) continue;
    const m = id.slice(prefix.length).match(/^(\d+)/);
    if (m) highest = Math.max(highest, Number(m[1]));
  }
  const width = Math.max(3, String(highest + 1).length);
  return `${prefix}${String(highest + 1).padStart(width, "0")}`;
}

/** The company documents a supplier may see and add. Letterheads, agreements and contracts stay with our office. */
export const SUPPLIER_DOC_TYPES = [
  { value: "TRADE_LICENSE", label: "Trade licence" },
  { value: "MOHRE_PERMIT", label: "MOHRE permit" },
  { value: "WORKMEN_COMPENSATION_INSURANCE", label: "Workmen compensation insurance" },
  { value: "ESTABLISHMENT_CARD", label: "MOHRE establishment card" },
  { value: "EJARI_TENANCY", label: "Ejari / tenancy contract" },
  { value: "CHAMBER_OF_COMMERCE", label: "Chamber of commerce certificate" },
  { value: "OTHER", label: "Other" },
] as const;
