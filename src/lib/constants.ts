export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8MB
export const MAX_UPLOAD_LABEL = "8MB";

/**
 * Model used to read uploaded documents. Haiku is roughly an order of
 * magnitude cheaper than Opus and reads these ID cards, passports and labour
 * cards accurately, so it's the default. Override with DOCUMENT_MODEL to try
 * a stronger model on a batch of awkward scans without a code change.
 */
export const DOCUMENT_MODEL =
  process.env.DOCUMENT_MODEL || "claude-haiku-4-5-20251001";
