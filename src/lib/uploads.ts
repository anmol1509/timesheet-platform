/**
 * Rules for accepting uploads and for handing them back out again.
 *
 * Uploaded files are stored in the database and served from this app's own
 * origin, so a file's declared type is not cosmetic: an HTML or SVG document
 * served inline executes as first-party script. The browser's `file.type` is
 * client-controlled, so it's treated as a claim to be checked, not a fact.
 */

/** Types safe to store and to render inline in a browser tab. */
const INLINE_SAFE = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
]);

/**
 * Types worth accepting but never rendering inline — office documents are
 * legitimate paperwork, but they're handed back as downloads.
 */
const DOWNLOAD_ONLY = new Set([
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

export const ACCEPTED_UPLOAD_TYPES = [...INLINE_SAFE, ...DOWNLOAD_ONLY];

/** File-picker `accept` string matching what the server will actually take. */
export const UPLOAD_ACCEPT_ATTR = "image/*,application/pdf,.doc,.docx,.xls,.xlsx";

export function isAcceptedUploadType(mimeType: string | null | undefined) {
  return !!mimeType && (INLINE_SAFE.has(mimeType) || DOWNLOAD_ONLY.has(mimeType));
}

/** Only images are worth storing as a profile photo. */
export function isAcceptedPhotoType(mimeType: string | null | undefined) {
  return !!mimeType && mimeType.startsWith("image/") && INLINE_SAFE.has(mimeType);
}

/**
 * Strips anything that could break out of the quoted filename in a
 * Content-Disposition header (quotes, backslashes, CR/LF) or walk a path.
 */
export function safeFilename(filename: string) {
  const base = filename.split(/[\\/]/).pop() || "document";
  const cleaned = base.replace(/["\\\r\n]/g, "").trim();
  return cleaned.slice(0, 120) || "document";
}

/**
 * Response headers for serving a stored file: inline only for types that are
 * safe to render, everything else forced to download, and never trusting a
 * stored type that isn't on the list.
 */
export function contentDispositionFor(mimeType: string, filename: string) {
  const safe = safeFilename(filename);
  const inline = INLINE_SAFE.has(mimeType);
  return {
    // An unrecognised stored type (uploaded before the whitelist existed) is
    // served as a plain download rather than whatever it claims to be.
    "Content-Type": isAcceptedUploadType(mimeType) ? mimeType : "application/octet-stream",
    "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${safe}"`,
    // Stops a served file being interpreted as a different type than declared.
    "X-Content-Type-Options": "nosniff",
  };
}
