// Browser-only helpers for reading a PDF or image page by page and for cutting a PDF into smaller documents.
import { polyfillMapUpsert } from "@/lib/pdfPageToImage";

export type PageImage = { page: number; blob: Blob; base64: string; width: number; height: number };

const toBase64 = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });

async function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

/** A JPEG of an image file, longest edge at most `maxEdge`, white behind any transparency. */
export async function imageToPage(file: Blob, { maxEdge = 1000, quality = 0.62 } = {}): Promise<PageImage | null> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, maxEdge / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bmp.width * scale));
    canvas.height = Math.max(1, Math.round(bmp.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await canvasToJpeg(canvas, quality);
    return blob ? { page: 1, blob, base64: await toBase64(blob), width: canvas.width, height: canvas.height } : null;
  } catch {
    return null; // a format the browser can't decode (HEIC)
  }
}

/** Every page of a PDF as a JPEG small enough to send to the AI, up to `maxPages`. */
export async function pdfToPages(file: Blob, { maxEdge = 1000, quality = 0.62, maxPages = 40 } = {}): Promise<{ pages: PageImage[]; total: number } | null> {
  polyfillMapUpsert();
  try {
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
    const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    try {
      const pages: PageImage[] = [];
      for (let n = 1; n <= Math.min(doc.numPages, maxPages); n++) {
        const page = await doc.getPage(n);
        const base = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: Math.max(Math.min(maxEdge / Math.max(base.width, base.height), 3), 0.1) });
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const ctx = canvas.getContext("2d");
        if (!ctx) continue;
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvas, canvasContext: ctx, viewport }).promise;
        const blob = await canvasToJpeg(canvas, quality);
        if (blob) pages.push({ page: n, blob, base64: await toBase64(blob), width: canvas.width, height: canvas.height });
      }
      return { pages, total: doc.numPages };
    } finally {
      await doc.cleanup();
    }
  } catch {
    return null; // not a readable PDF (damaged, or password-protected)
  }
}

/** A new PDF holding only the given pages (1-based) of `file`. Null when it can't be cut. */
export async function cutPdf(file: Blob, pageNumbers: number[]): Promise<Blob | null> {
  try {
    const { PDFDocument } = await import("pdf-lib");
    const src = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
    const out = await PDFDocument.create();
    const idx = pageNumbers.map((n) => n - 1).filter((i) => i >= 0 && i < src.getPageCount());
    if (idx.length === 0) return null;
    for (const p of await out.copyPages(src, idx)) out.addPage(p);
    const bytes = await out.save();
    return new Blob([bytes as BlobPart], { type: "application/pdf" });
  } catch {
    return null;
  }
}
