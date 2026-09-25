import { isValidIban } from "@/lib/supplierRequests";

/**
 * Whether a bank account can be relied on. "Active" is earned by having the
 * details a payment or a WPS file actually needs, not typed into a dropdown.
 *
 *   DISABLED    switched off by a person
 *   INCOMPLETE  enabled, but details are missing or wrong
 *   ACTIVE      enabled and complete
 */
export type BankState = "ACTIVE" | "INCOMPLETE" | "DISABLED";

export type BankFacts = {
  status: string; // stored: "ACTIVE" (not switched off) | "INACTIVE"
  accountName: string | null;
  bankName: string | null;
  accountNo: string | null;
  ibanNo: string | null;
};

const has = (v: string | null | undefined) => !!v && v.trim().length > 0;

/** What is still missing, in plain words. Empty means complete. */
export function bankMissing(b: BankFacts): string[] {
  const out: string[] = [];
  if (!has(b.accountName)) out.push("account name");
  if (!has(b.bankName)) out.push("bank name");
  if (!has(b.accountNo)) out.push("account number");
  if (!has(b.ibanNo)) out.push("IBAN");
  else if (!isValidIban(b.ibanNo!)) out.push("a valid IBAN");
  return out;
}

export function bankState(b: BankFacts): { state: BankState; missing: string[] } {
  if (b.status === "INACTIVE") return { state: "DISABLED", missing: [] };
  const missing = bankMissing(b);
  return { state: missing.length === 0 ? "ACTIVE" : "INCOMPLETE", missing };
}

export const isUsableBank = (b: BankFacts) => bankState(b).state === "ACTIVE";

/** Field-level checks for the bank form. Returns the first problem, or null. */
export function validateBankFields(f: { ibanNo?: string | null; routingCode?: string | null; swiftCode?: string | null; contactEmail?: string | null; accountNo?: string | null }): string | null {
  if (f.ibanNo && !isValidIban(f.ibanNo)) return "That IBAN doesn't look right. Check it (UAE IBANs are 23 characters, starting AE).";
  if (f.routingCode && !/^\d{9}$/.test(f.routingCode.trim())) return "The routing code should be 9 digits (it is used in the WPS file).";
  if (f.swiftCode && !/^[A-Za-z]{4}[A-Za-z]{2}[A-Za-z0-9]{2}([A-Za-z0-9]{3})?$/.test(f.swiftCode.trim())) return "The SWIFT code should be 8 or 11 characters, like EBILAEAD.";
  if (f.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.contactEmail.trim())) return "Enter a valid contact email.";
  if (f.accountNo && !/^[A-Za-z0-9\-\s]{4,34}$/.test(f.accountNo.trim())) return "The account number should be 4 to 34 letters or digits.";
  return null;
}
