import { ibanChecksumOk } from "@/lib/idFormats";

/**
 * Contact-detail checks shared by the browser (to stop a save) and the server
 * (so nothing wrong gets stored even if the browser check is bypassed).
 * Pure: no DB, no Next imports.
 */

/** local@domain.tld — a dot in the domain and a TLD of at least two letters; no spaces. */
export function isValidEmail(v: string): boolean {
  const s = v.trim();
  if (s.length > 254) return false;
  return /^[A-Za-z0-9._%+'-]+@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,}$/.test(s);
}

/**
 * A complete international number: "+", then 8 to 15 digits (ITU E.164). For a UAE number the
 * national part is exactly 9 digits (so +971 5x xxx xxxx is 12 digits in all), which catches the
 * common "typed 8 digits" mistake. Landlines and foreign numbers are checked by length only.
 */
export function isValidPhone(v: string): boolean {
  const s = v.trim();
  if (!s) return false;
  const digits = s.replace(/[^\d]/g, "");
  if (!/^\+?[\d\s()-]+$/.test(s)) return false;
  if (digits.length < 8 || digits.length > 15) return false;
  if (s.startsWith("+971") || digits.startsWith("971")) {
    const national = digits.slice(3);
    // Mobiles start with 5 and have 9 digits; landlines have 8 (2-digit area code after a leading 0 is dropped).
    return national.startsWith("5") ? national.length === 9 : national.length === 8 || national.length === 9;
  }
  return true;
}

export const EMAIL_MESSAGE = "Enter a complete email address, like name@company.com.";
export const PHONE_MESSAGE = "Enter the full phone number, including the digits after the country code.";

const EMAIL_KEY = /(^|[a-z])email$/i;
const PHONE_KEY = /(phone|mobile|whatsapp|telephone|contactno|^fax$)/i;

const IBAN_KEY = /^(iban|ibanNo|wpsIban)$/i;
const EID_KEY = /^emiratesId$/i;
const TRN_KEY = /^(trn|companyTrn)$/i;

/** The first contact field in a submitted form whose value is filled in but not valid, or null. */
export function firstInvalidContact(entries: Iterable<[string, FormDataEntryValue]>): { field: string; message: string } | null {
  for (const [key, raw] of entries) {
    if (typeof raw !== "string" || raw.trim() === "") continue;
    if (EMAIL_KEY.test(key) && !isValidEmail(raw)) return { field: key, message: EMAIL_MESSAGE };
    if (PHONE_KEY.test(key) && !isValidPhone(raw)) return { field: key, message: PHONE_MESSAGE };
    const compact = raw.replace(/\s+/g, "");
    if (IBAN_KEY.test(key) && !ibanChecksumOk(compact.toUpperCase())) return { field: key, message: "That IBAN isn't valid — please re-check the digits." };
    if (EID_KEY.test(key) && compact.replace(/\D/g, "").length !== 15) return { field: key, message: "An Emirates ID has 15 digits." };
    if (TRN_KEY.test(key) && compact.replace(/\D/g, "").length !== 15) return { field: key, message: "A TRN has 15 digits." };
  }
  return null;
}

/** Server-side guard: throws a readable error instead of saving a malformed email or phone number. */
export function assertContactsValid(formData: FormData): void {
  const bad = firstInvalidContact(formData.entries());
  if (bad) throw new Error(`${bad.message} (${bad.field})`);
}
