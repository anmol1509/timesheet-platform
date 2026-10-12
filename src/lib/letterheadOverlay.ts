import { PDFDocument } from "pdf-lib";

/**
 * react-pdf can only draw raster images behind a page, but a letterhead is very
 * often a PDF. These put the letter's pages over the first page of a letterhead
 * PDF instead, keeping the letterhead sharp (vector) rather than re-drawing it.
 */

/** Lays every page of `letter` (transparent background) over page 1 of `letterhead`. */
export async function overlayOnLetterheadPdf(letter: Uint8Array, letterhead: Uint8Array): Promise<Uint8Array> {
  const out = await PDFDocument.create();
  const [bg] = await out.embedPdf(await PDFDocument.load(letterhead), [0]);
  const pages = await out.embedPdf(await PDFDocument.load(letter));
  for (const content of pages) {
    const page = out.addPage([595.28, 841.89]); // A4, the size the letter is laid out for
    page.drawPage(bg, { x: 0, y: 0, width: page.getWidth(), height: page.getHeight() });
    page.drawPage(content, { x: 0, y: 0, width: page.getWidth(), height: page.getHeight() });
  }
  return out.save();
}

/** Joins PDFs end to end. */
export async function mergePdfs(parts: Uint8Array[]): Promise<Uint8Array> {
  const out = await PDFDocument.create();
  for (const bytes of parts) {
    const src = await PDFDocument.load(bytes);
    for (const p of await out.copyPages(src, src.getPageIndices())) out.addPage(p);
  }
  return out.save();
}
