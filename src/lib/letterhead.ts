import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Letterhead block for generated documents.
 *
 * The competitor timesheet we're matching prints the issuing company's name
 * beside its address, phone, fax, email, P.O. Box and TRN — the TRN especially
 * matters, since their own notes reject invoices that omit both parties' tax
 * numbers.
 */
export type Letterhead = {
  name: string;
  addressLines: string[];
  phone: string | null;
  fax: string | null;
  email: string | null;
  poBox: string | null;
  trn: string | null;
  /** PNG/JPEG data URI, or null when no logo file is present. */
  logo: string | null;
};

let cachedLogo: string | null | undefined;

/**
 * Reads the company logo once per process.
 *
 * Kept as a file in `public/brand` rather than a database blob so it can be
 * replaced by dropping in a new file. Missing is not an error: the letterhead
 * simply renders without it, so a deployment without the asset still produces
 * a usable document.
 */
export async function loadLogoDataUri(): Promise<string | null> {
  if (cachedLogo !== undefined) return cachedLogo;
  // Order matters: the real artwork wins as soon as it's dropped in, and the
  // placeholder derived from the repo's brand mark is only a fallback so a
  // document is never issued with an empty letterhead.
  for (const file of [
    "timesheet-logo.png",
    "timesheet-logo.jpg",
    "logo.png",
    "logo-placeholder.png",
  ]) {
    try {
      const buffer = await readFile(path.join(process.cwd(), "public", "brand", file));
      const mime = file.endsWith(".jpg") ? "image/jpeg" : "image/png";
      cachedLogo = `data:${mime};base64,${buffer.toString("base64")}`;
      return cachedLogo;
    } catch {
      // Try the next candidate.
    }
  }
  cachedLogo = null;
  return cachedLogo;
}

export async function buildLetterhead(branch: {
  name: string;
  address: string | null;
  emirate: string | null;
  country: string | null;
  phone: string | null;
  fax: string | null;
  email: string | null;
  poBox: string | null;
  trn: string | null;
}): Promise<Letterhead> {
  return {
    name: branch.name,
    addressLines: [branch.address, branch.emirate, branch.country].filter(
      (line): line is string => !!line && line.trim().length > 0
    ),
    phone: branch.phone,
    fax: branch.fax,
    email: branch.email,
    // Stored values sometimes already include the label; printing both reads
    // as "P.O. Box P.O. Box 26403".
    poBox: branch.poBox ? branch.poBox.replace(/^\s*P\.?\s*O\.?\s*Box\s*/i, "").trim() : null,
    trn: branch.trn,
    logo: await loadLogoDataUri(),
  };
}
