/**
 * Passports print the holder's dates twice: in the visual zone (where an issue date and an expiry date sit side by
 * side under their labels and are easy to swap) and in the machine-readable zone, which carries check digits. When
 * the MRZ reads cleanly it is the better source, so it overrules whatever was read from the visual zone.
 */
type Fields = { passportNumber?: string | null; passportExpiry?: string | null; dateOfBirth?: string | null; passportIssueDate?: string | null; mrzLine2?: string | null; [k: string]: unknown };

const val = (c: string) => (c === "<" ? 0 : /\d/.test(c) ? Number(c) : c.charCodeAt(0) - 55);
function check(s: string): number {
  const w = [7, 3, 1];
  return s.split("").reduce((sum, c, i) => sum + val(c) * w[i % 3], 0) % 10;
}
const clean = (s: string) => s.toUpperCase().replace(/[«\s]/g, (m) => (m === "«" ? "<" : "")).replace(/[^A-Z0-9<]/g, "");

function ymd(yymmdd: string, century: "dob" | "expiry", ref: Date): string | null {
  const yy = Number(yymmdd.slice(0, 2)), mm = Number(yymmdd.slice(2, 4)), dd = Number(yymmdd.slice(4, 6));
  if (!(mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31)) return null;
  // Birth dates in the past, expiry dates up to ~20 years ahead.
  let year = 2000 + yy;
  if (century === "dob" && year > ref.getUTCFullYear()) year -= 100;
  if (century === "expiry" && year > ref.getUTCFullYear() + 25) year -= 100;
  const d = new Date(Date.UTC(year, mm - 1, dd));
  if (d.getUTCMonth() !== mm - 1) return null;
  return d.toISOString().slice(0, 10);
}

/** Reads a TD3 (passport) second line. Returns what passes its check digits. */
export function readMrzLine2(raw: string, ref = new Date()): { passportNumber?: string; dateOfBirth?: string; passportExpiry?: string } | null {
  const s = clean(raw);
  if (s.length < 28) return null;
  const out: { passportNumber?: string; dateOfBirth?: string; passportExpiry?: string } = {};
  if (check(s.slice(0, 9)) === Number(s[9])) out.passportNumber = s.slice(0, 9).replace(/</g, "");
  if (check(s.slice(13, 19)) === Number(s[19])) out.dateOfBirth = ymd(s.slice(13, 19), "dob", ref) ?? undefined;
  if (check(s.slice(21, 27)) === Number(s[27])) out.passportExpiry = ymd(s.slice(21, 27), "expiry", ref) ?? undefined;
  return Object.keys(out).length ? out : null;
}

/**
 * Settles a passport's fields: MRZ values that pass their check digits win; otherwise an expiry that is not after
 * the issue date (the usual swap) or before the date of birth is dropped rather than saved wrong.
 */
export function reconcilePassport<T extends Fields>(parsed: T, ref = new Date()): T {
  const next = { ...parsed };
  const mrz = parsed.mrzLine2 ? readMrzLine2(parsed.mrzLine2, ref) : null;
  if (mrz?.passportExpiry) next.passportExpiry = mrz.passportExpiry;
  if (mrz?.passportNumber) next.passportNumber = mrz.passportNumber;
  if (mrz?.dateOfBirth && !parsed.dateOfBirth) next.dateOfBirth = mrz.dateOfBirth;
  if (!mrz?.passportExpiry && next.passportExpiry) {
    const e = next.passportExpiry;
    if ((parsed.passportIssueDate && e <= parsed.passportIssueDate) || (next.dateOfBirth && e <= next.dateOfBirth)) next.passportExpiry = "";
  }
  return next;
}
