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
