/**
 * pdf.js uses Map.prototype.getOrInsertComputed, which only the newest browsers
 * have. Without it a PDF fails to render on anything slightly older.
 */
function polyfillMapUpsert() {
  for (const C of [Map, WeakMap] as unknown as { prototype: Record<string, unknown> }[]) {
    const proto = C.prototype as unknown as {
      has(k: unknown): boolean; get(k: unknown): unknown; set(k: unknown, v: unknown): unknown;
      getOrInsert?: unknown; getOrInsertComputed?: unknown;
    };
    if (typeof proto.getOrInsert !== "function") {
      Object.defineProperty(proto, "getOrInsert", { configurable: true, writable: true, value(this: typeof proto, k: unknown, v: unknown) { if (!this.has(k)) this.set(k, v); return this.get(k); } });
    }
    if (typeof proto.getOrInsertComputed !== "function") {
      Object.defineProperty(proto, "getOrInsertComputed", { configurable: true, writable: true, value(this: typeof proto, k: unknown, f: (k: unknown) => unknown) { if (!this.has(k)) this.set(k, f(k)); return this.get(k); } });
    }
  }
}

/**
 * Renders one page of a PDF to a JPEG File, in the browser.
 *
 * Document packs usually carry the worker's passport photo as its own page, so
 * the profile picture is already in the upload — it just needs lifting out.
 * pdf.js is imported lazily because it's a heavy dependency that only matters
 * when a pack actually contains a photo page.
 */
export async function pdfPageToImage(
  file: File,
  pageNumber: number,
  { maxEdge = 900, quality = 0.9 }: { maxEdge?: number; quality?: number } = {}
): Promise<File | null> {
  if (file.type !== "application/pdf") return null;

  polyfillMapUpsert();
  const pdfjs = await import("pdfjs-dist");
  // The worker ships with the package; point pdf.js at it rather than letting
  // it guess a CDN URL, which the app's CSP would block anyway.
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
  ).toString();

  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  try {
    if (pageNumber < 1 || pageNumber > doc.numPages) return null;
    const page = await doc.getPage(pageNumber);

    // Scale so the longest edge lands near maxEdge: big enough for a crisp
    // avatar, small enough that the Bytes column doesn't balloon.
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(maxEdge / Math.max(base.width, base.height), 3);
    const viewport = page.getViewport({ scale: Math.max(scale, 0.1) });

    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext("2d");
    if (!context) return null;

    // Scans are often transparent-backed; paint white so the JPEG isn't black.
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvas, canvasContext: context, viewport }).promise;

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality)
    );
    if (!blob) return null;

    const basename = file.name.replace(/\.pdf$/i, "");
    return new File([blob], `${basename}-photo.jpg`, { type: "image/jpeg" });
  } finally {
    await doc.cleanup();
  }
}
