import { COUNTRIES } from "@/lib/countries";
import { normalizeNationality } from "@/lib/nationality";
import { parseLooseDate } from "@/lib/looseDate";

// What a worker may add to their own record from the portal. Only fields that
// are empty can be filled — nothing already on file can be changed here — and
// the mobile number (their login) and trade (their employer's call) are not on
// the list at all.

export type ProfileField = {
  key: "gender" | "dateOfBirth" | "nationality" | "passportNumber" | "passportExpiry" | "emiratesId" | "emiratesIdExpiry" | "visaExpiry" | "laborCardNumber" | "laborCardExpiry";
  label: string;
  kind: "text" | "date" | "gender" | "country";
  hint?: string;
  /** Show only the end of what's on file. */
  mask?: boolean;
};

export const PROFILE_FIELDS: ProfileField[] = [
  { key: "gender", label: "Gender", kind: "gender" },
  { key: "dateOfBirth", label: "Date of birth", kind: "date" },
  { key: "nationality", label: "Nationality", kind: "country" },
  { key: "passportNumber", label: "Passport number", kind: "text", hint: "As printed on your passport", mask: true },
  { key: "passportExpiry", label: "Passport expiry", kind: "date" },
  { key: "emiratesId", label: "Emirates ID number", kind: "text", hint: "784-XXXX-XXXXXXX-X", mask: true },
  { key: "emiratesIdExpiry", label: "Emirates ID expiry", kind: "date" },
  { key: "visaExpiry", label: "Visa expiry", kind: "date" },
  { key: "laborCardNumber", label: "Labour card number", kind: "text", mask: true },
  { key: "laborCardExpiry", label: "Labour card expiry", kind: "date" },
];

export const COUNTRY_NAMES = COUNTRIES.map((c) => c.name);

const yearsAgo = (n: number) => { const d = new Date(); d.setUTCFullYear(d.getUTCFullYear() - n); return d; };

/** Check one submitted value. Returns the value to store, or an error to show. */
export function validateProfileValue(field: ProfileField, raw: string): { value: string | Date } | { error: string } {
  const v = raw.trim();
  switch (field.key) {
    case "gender": {
      const g = v.toLowerCase();
      return g === "male" || g === "female" ? { value: g.toUpperCase() } : { error: "Choose Male or Female." };
    }
    case "nationality": {
      const r = normalizeNationality(v);
      return r.value ? { value: r.value } : { error: "Choose your country from the list." };
    }
    case "passportNumber": {
      const p = v.replace(/\s+/g, "").toUpperCase();
      return /^[A-Z0-9]{5,12}$/.test(p) ? { value: p } : { error: "Passport number should be 5–12 letters and numbers." };
    }
    case "emiratesId": {
      const d = v.replace(/\D/g, "");
      return /^784\d{12}$/.test(d) ? { value: `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7, 14)}-${d.slice(14)}` } : { error: "Emirates ID should be 15 digits, starting 784." };
    }
    case "laborCardNumber":
      return /^[A-Za-z0-9\-/]{5,20}$/.test(v) ? { value: v.toUpperCase() } : { error: "Labour card number should be 5–20 letters and numbers." };
    default: {
      const d = parseLooseDate(v);
      if (d === "invalid" || d === null) return { error: `${field.label} isn't a valid date.` };
      if (field.key === "dateOfBirth") {
        return d < yearsAgo(80) || d > yearsAgo(16) ? { error: "Date of birth doesn't look right." } : { value: d };
      }
      const y = d.getUTCFullYear();
      return y < 2000 || y > 2100 ? { error: `${field.label} doesn't look right.` } : { value: d };
    }
  }
}
