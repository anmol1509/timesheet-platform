/**
 * Sense checks on what is typed into a worker's record. They produce plain-language warnings, never errors: real documents
 * sometimes break the rules, so the person can save anyway. A check only looks at a field that changed, so an old record
 * with an old expiry isn't nagged about on every save.
 */

const digits = (s: string) => s.replace(/\D/g, "");

/** Emirates ID numbers carry a Luhn check digit: 15 digits, the last one computed from the others. */
export function emiratesIdChecksumOk(raw: string): boolean {
  const d = digits(raw);
  if (d.length !== 15) return false;
  let sum = 0;
  for (let i = 0; i < 15; i++) {
    let n = Number(d[14 - i]);
    if (i % 2 === 1) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
  }
  return sum % 10 === 0;
}

export type EmployeeFacts = {
  emiratesId?: string | null;
  passportNumber?: string | null;
  mobileNumber?: string | null;
  dateOfBirth?: Date | null;
  joinDate?: Date | null;
  passportExpiry?: Date | null;
  emiratesIdExpiry?: Date | null;
  laborCardExpiry?: Date | null;
  visaExpiry?: Date | null;
  medicalExpiry?: Date | null;
  basicSalary?: number | null;
  flatMonthlyRate?: number | null;
  hourlyRate?: number | null;
};

const EXPIRIES: { key: "passportExpiry" | "emiratesIdExpiry" | "laborCardExpiry" | "visaExpiry" | "medicalExpiry"; label: string }[] = [
  { key: "passportExpiry", label: "Passport expiry" },
  { key: "emiratesIdExpiry", label: "Emirates ID expiry" },
  { key: "laborCardExpiry", label: "Labour card expiry" },
  { key: "visaExpiry", label: "Visa expiry" },
  { key: "medicalExpiry", label: "Medical certificate expiry" },
];

const dmy = (d: Date) => `${String(d.getUTCDate()).padStart(2, "0")}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${d.getUTCFullYear()}`;
const same = (a: unknown, b: unknown) => (a instanceof Date || b instanceof Date ? (a as Date | null)?.getTime?.() === (b as Date | null)?.getTime?.() : (a ?? null) === (b ?? null));
const yearsBetween = (from: Date, to: Date) => (to.getTime() - from.getTime()) / (365.25 * 86400000);

export function checkEmployee(next: EmployeeFacts, before: EmployeeFacts | null, now = new Date()): string[] {
  const out: string[] = [];
  const changed = (k: keyof EmployeeFacts) => !before || !same(next[k], before[k]);

  if (next.emiratesId && changed("emiratesId")) {
    const d = digits(next.emiratesId);
    if (d.length === 15 && !d.startsWith("784")) out.push("Emirates IDs start with 784.");
    else if (d.length === 15 && !emiratesIdChecksumOk(d)) out.push("This Emirates ID number doesn't pass the check-digit test. Please re-check the digits against the card.");
    else if (d.length !== 15) out.push(`An Emirates ID has 15 digits (this has ${d.length}).`);
  }
  if (next.passportNumber && changed("passportNumber")) {
    const p = next.passportNumber.replace(/\s/g, "");
    if (!/^[A-Za-z0-9]{6,9}$/.test(p) || !/\d/.test(p)) out.push("A passport number is usually 6 to 9 letters and digits, with at least one digit. Please re-check it.");
  }
  if (next.mobileNumber && changed("mobileNumber")) {
    const d = digits(next.mobileNumber);
    if (d.startsWith("971")) {
      const national = d.slice(3);
      if (!/^5[02-68]\d{7}$/.test(national)) out.push("UAE mobile numbers start with 50, 52, 54, 55, 56 or 58 and have 9 digits after +971.");
    }
  }
  if (next.dateOfBirth && changed("dateOfBirth")) {
    const age = yearsBetween(next.dateOfBirth, now);
    if (age < 0) out.push("The date of birth is in the future.");
    else if (age < 18) out.push(`This date of birth makes the worker ${Math.floor(age)}, under 18.`);
    else if (age > 65) out.push(`This date of birth makes the worker ${Math.floor(age)}. Please check the year.`);
  }
  if (next.joinDate && changed("joinDate")) {
    if (next.joinDate.getTime() > now.getTime() + 90 * 86400000) out.push("The join date is more than 3 months in the future.");
    if (next.dateOfBirth && yearsBetween(next.dateOfBirth, next.joinDate) < 15) out.push("The join date is before the worker's 15th birthday.");
  }
  for (const { key, label } of EXPIRIES) {
    const v = next[key];
    if (!v || !changed(key)) continue;
    if (v.getTime() < now.getTime() - 86400000) out.push(`${label} (${dmy(v)}) is already in the past.`);
    else if (v.getUTCFullYear() > now.getUTCFullYear() + 15) out.push(`${label} (${dmy(v)}) is more than 15 years away. Please check the year.`);
  }
  const big = (label: string, v: number | null | undefined, k: keyof EmployeeFacts, limit: number) => {
    if (v != null && v > limit && changed(k)) out.push(`${label} of AED ${v.toLocaleString("en-AE")} is unusually high. Please check for an extra digit.`);
  };
  big("Basic salary", next.basicSalary, "basicSalary", 50_000);
  big("Monthly rate", next.flatMonthlyRate, "flatMonthlyRate", 50_000);
  big("Hourly rate", next.hourlyRate, "hourlyRate", 500);
  return out;
}

export type PartnerFacts = { trn?: string | null; tradeLicenseNumber?: string | null; tradeLicenseExpiry?: Date | null };

/** The same idea for a supplier or client company: only what changed is looked at. */
export function checkPartner(next: PartnerFacts, before: PartnerFacts | null, now = new Date()): string[] {
  const out: string[] = [];
  const changed = (k: keyof PartnerFacts) => !before || !same(next[k], before[k]);
  if (next.trn && changed("trn")) {
    const d = digits(next.trn);
    if (d.length !== 15) out.push(`A TRN has 15 digits (this has ${d.length}).`);
    else if (!d.startsWith("100")) out.push("UAE TRNs start with 100. Please re-check the number.");
  }
  const exp = next.tradeLicenseExpiry;
  if (exp && changed("tradeLicenseExpiry")) {
    if (exp.getTime() < now.getTime() - 86400000) out.push(`The trade licence expiry (${dmy(exp)}) is already in the past.`);
    else if (exp.getUTCFullYear() > now.getUTCFullYear() + 15) out.push(`The trade licence expiry (${dmy(exp)}) is more than 15 years away. Please check the year.`);
  }
  return out;
}
