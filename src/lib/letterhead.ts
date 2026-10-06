import { readFile } from "node:fs/promises";
import path from "node:path";
import { inflateSync } from "node:zlib";
import { prisma } from "@/lib/db";

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

/**
 * The PDF renderer decodes a logo while drawing the page, and a damaged file makes it throw from
 * inside a callback that can't be caught, which takes the request down. So an image is proved
 * readable first: a PNG's pixel data must inflate, and a JPEG must start and end as one.
 */
export function imageIsReadable(data: Uint8Array, mime: string): boolean {
  const b = Buffer.from(data);
  try {
    if (/png/i.test(mime)) {
      if (b.length < 33 || b.readUInt32BE(0) !== 0x89504e47) return false;
      let off = 8;
      const idat: Buffer[] = [];
      let ended = false;
      while (off + 12 <= b.length) {
        const len = b.readUInt32BE(off);
        const type = b.toString("ascii", off + 4, off + 8);
        if (len > b.length || off + 12 + len > b.length) return false;
        if (type === "IDAT") idat.push(b.subarray(off + 8, off + 8 + len));
        if (type === "IEND") { ended = true; break; }
        off += 12 + len;
      }
      if (!ended || idat.length === 0) return false;
      inflateSync(Buffer.concat(idat));
      return true;
    }
    if (/jpe?g/i.test(mime)) return b.length > 4 && b[0] === 0xff && b[1] === 0xd8 && b[b.length - 2] === 0xff && b[b.length - 1] === 0xd9;
  } catch {
    return false;
  }
  return false;
}

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
  /** Uploaded company logo (Company profile). Wins over the static fallback file. */
  logoId?: string | null;
}): Promise<Letterhead> {
  let logo: string | null = null;
  if (branch.logoId) {
    const img = await prisma.storedImage.findUnique({ where: { id: branch.logoId } });
    // The PDF renderer reads only PNG and JPEG; anything else would break the whole document, so it is left out.
    if (img && /^image\/(png|jpe?g)$/i.test(img.mimeType) && imageIsReadable(img.data, img.mimeType)) logo = `data:${img.mimeType};base64,${Buffer.from(img.data).toString("base64")}`;
  }
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
    logo: logo ?? (await loadLogoDataUri()),
  };
}
