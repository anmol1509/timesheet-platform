/**
 * IBAN checks for the public validator and the SIF file checker. Pure and
 * browser-safe. Validates the ISO 13616 structure (country, length, mod-97
 * check digits); it cannot tell whether an account exists or belongs to the
 * person named. UAE IBANs are 23 characters: AE, two check digits, a 3-digit
 * bank code and a 16-digit account number.
 */
const LENGTHS: Record<string, number> = {
  AE: 23, SA: 24, BH: 22, KW: 30, OM: 23, QA: 29, JO: 30, LB: 28, EG: 29, PK: 24, TR: 26, IL: 23,
  GB: 22, DE: 22, FR: 27, ES: 24, IT: 27, NL: 18, CH: 21, IE: 22, BE: 16, PT: 25, AT: 20, SE: 24,
};

export type IbanResult = {
  input: string;
  /** Upper-case, spaces and dashes removed. */
  normalized: string;
  /** Grouped in fours for reading back. */
  formatted: string;
  valid: boolean;
  country: string | null;
  isUae: boolean;
  /** UAE only: the 3-digit bank code and 16-digit account number. */
  bankCode: string | null;
  accountNumber: string | null;
  problems: string[];
};

export const normalizeIban = (s: string) => s.replace(/[\s-]/g, "").toUpperCase();

export const formatIban = (s: string) => s.replace(/(.{4})/g, "$1 ").trim();

/** ISO 7064 mod 97-10: true when the check digits are right. */
function checksumOk(iban: string): boolean {
  const moved = iban.slice(4) + iban.slice(0, 4);
  let rem = 0;
  for (const ch of moved) {
    const v = parseInt(ch, 36); // 0-9 -> 0-9, A-Z -> 10-35
    rem = (v > 9 ? rem * 100 + v : rem * 10 + v) % 97;
  }
  return rem === 1;
}

// Letters people commonly type for a digit in an account number.
const LOOKALIKES: Record<string, string> = { O: "0", I: "1", L: "1", S: "5", B: "8", Z: "2" };

export function validateIban(input: string): IbanResult {
  const normalized = normalizeIban(input);
  const problems: string[] = [];
  const country = /^[A-Z]{2}/.test(normalized) ? normalized.slice(0, 2) : null;
  const isUae = country === "AE";
  const base = {
    input,
    normalized,
    formatted: formatIban(normalized),
    country,
    isUae,
    bankCode: null as string | null,
    accountNumber: null as string | null,
  };

  if (!normalized) return { ...base, valid: false, problems: ["Enter an IBAN to check."] };
  if (!/^[A-Z0-9]+$/.test(normalized)) {
    problems.push("It contains characters other than letters and digits. Remove punctuation and symbols.");
  }
  if (!country) {
    problems.push("An IBAN starts with a two-letter country code, such as AE for the UAE.");
  } else {
    const want = LENGTHS[country];
    if (want && normalized.length !== want) {
      problems.push(
        `${country} IBANs are ${want} characters long; this one has ${normalized.length}. ${normalized.length < want ? "A digit is probably missing." : "There is probably an extra character."}`,
      );
    } else if (!want && normalized.length < 15) {
      problems.push("IBANs are at least 15 characters long.");
    }
    if (!/^\d{2}/.test(normalized.slice(2, 4))) problems.push("The two characters after the country code must be digits (the check digits).");
  }

  if (isUae && /^[A-Z0-9]+$/.test(normalized)) {
    const rest = normalized.slice(4);
    const letters = [...rest].map((c, i) => ({ c, pos: i + 5 })).filter((x) => /[A-Z]/.test(x.c));
    if (letters.length) {
      const hints = letters.slice(0, 3).map((x) => (LOOKALIKES[x.c] ? `${x.c} at position ${x.pos} may be the digit ${LOOKALIKES[x.c]}` : `${x.c} at position ${x.pos}`));
      problems.push(`After AE and the check digits, a UAE IBAN is digits only. Found a letter: ${hints.join("; ")}.`);
    }
  }

  // Only run the checksum when the shape is plausible; otherwise it just adds noise.
  const shapeOk = problems.length === 0;
  if (shapeOk && !checksumOk(normalized)) {
    problems.push("The check digits don't match the rest of the number. This is usually one mistyped digit or two swapped digits.");
  }

  const valid = problems.length === 0;
  return {
    ...base,
    valid,
    bankCode: isUae && valid ? normalized.slice(4, 7) : null,
    accountNumber: isUae && valid ? normalized.slice(7) : null,
    problems,
  };
}
