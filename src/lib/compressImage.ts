/**
 * Browser-only. Phone photos run to several MB, but a save carries every file in one request, and the host
 * refuses a request over about 4.5 MB. Photos are scaled down and re-encoded before upload; anything that
 * isn't an image (a PDF) or is already small is left exactly as it is.
 */
export async function shrinkImage(file: File, maxBytes = 900 * 1024): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif" || file.size <= maxBytes) return file;
  try {
    const bitmap = await createImageBitmap(file);
    let scale = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height));
    for (let attempt = 0; attempt < 4; attempt++) {
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) return file;
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", attempt === 0 ? 0.85 : 0.7));
      if (blob && blob.size <= maxBytes) return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
      scale *= 0.7;
    }
    return file;
  } catch {
    return file; // a format the browser can't decode (HEIC): send as is
  }
}

/** One request carries everything, so the total matters, not each file. */
export const MAX_REQUEST_BYTES = 4 * 1024 * 1024;
