export type MaskKind = "iban" | "eid" | "passport" | "trn";

export function formatMasked(kind: MaskKind, raw: string): string {
  switch (kind) {
    case "iban":
      return raw.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 34);
    case "passport":
      return raw.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 20);
    case "trn":
      return raw.replace(/\D/g, "").slice(0, 15);
    case "eid": {
      const d = raw.replace(/\D/g, "").slice(0, 15);
      // 784-YYYY-NNNNNNN-C
      return [d.slice(0, 3), d.slice(3, 7), d.slice(7, 14), d.slice(14, 15)].filter(Boolean).join("-");
    }
  }
}

/** ISO 13616 checksum: move the first four characters to the end, letters become 10-35, the number mod 97 must be 1. */
export function ibanChecksumOk(iban: string): boolean {
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(iban)) return false;
  const moved = iban.slice(4) + iban.slice(0, 4);
  let rem = 0;
  for (const ch of moved) {
    const v = /\d/.test(ch) ? ch : String(ch.charCodeAt(0) - 55);
    for (const d of v) rem = (rem * 10 + Number(d)) % 97;
  }
  return rem === 1;
}

export type Hint = { tone: "ok" | "warn"; text: string } | null;

/** A gentle, non-blocking check: the message never stops a save, since foreign documents and older records legitimately differ. */
export function hintFor(kind: MaskKind, value: string): Hint {
  if (!value) return null;
  switch (kind) {
    case "iban": {
      if (ibanChecksumOk(value)) return value.startsWith("AE") && value.length !== 23 ? { tone: "warn", text: "UAE IBANs have 23 characters." } : { tone: "ok", text: "Valid IBAN" };
      if (value.startsWith("AE") && value.length < 23) return { tone: "warn", text: `UAE IBANs have 23 characters (${value.length} so far).` };
      return { tone: "warn", text: "This doesn't pass the IBAN check — please re-check the digits." };
    }
    case "eid": {
      const n = value.replace(/\D/g, "").length;
      if (n === 15) return value.startsWith("784") ? { tone: "ok", text: "Valid format" } : { tone: "warn", text: "Emirates IDs start with 784." };
      return { tone: "warn", text: `15 digits expected (${n} so far).` };
    }
    case "trn": {
      const n = value.length;
      return n === 15 ? { tone: "ok", text: "Valid format" } : { tone: "warn", text: `15 digits expected (${n} so far).` };
    }
    case "passport":
      return value.length < 6 ? { tone: "warn", text: "That looks short for a passport number." } : null;
  }
}
