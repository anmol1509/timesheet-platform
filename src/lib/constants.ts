// What one request can carry: the host refuses bodies over about 4.5 MB, and the server-action limit is 4 MB.
export const MAX_UPLOAD_BYTES = Math.floor(3.5 * 1024 * 1024);
export const MAX_UPLOAD_LABEL = "3.5 MB";

/**
 * Model used to read uploaded documents. Haiku is roughly an order of
 * magnitude cheaper than Opus and reads these ID cards, passports and labour
 * cards accurately, so it's the default. Override with DOCUMENT_MODEL to try
 * a stronger model on a batch of awkward scans without a code change.
 */
export const DOCUMENT_MODEL =
  process.env.DOCUMENT_MODEL || "claude-haiku-4-5-20251001";

/**
 * Model behind My Assistant. Sonnet 5.5 follows multi-step questions and picks
 * the right lookup far better than Haiku. Override with ASSISTANT_MODEL to go
 * back (set it to claude-haiku-4-5-20251001) without a code change.
 */
export const ASSISTANT_MODEL = process.env.ASSISTANT_MODEL || "claude-sonnet-5-5";

/** Used when the main assistant model rejects a request, so a question is still answered. */
export const ASSISTANT_FALLBACK_MODEL = "claude-haiku-4-5-20251001";

/** Model for the import copilot's one-shot review. Short structured output; Haiku is plenty. */
export const COPILOT_MODEL = process.env.COPILOT_MODEL || "claude-haiku-4-5-20251001";

/**
 * Extra request settings a model needs. Sonnet 5.5 thinks by default, and that
 * thinking is paid for out of max_tokens, so a short chat reply could be cut off.
 * Thinking is limited to the gaps between tool calls and effort is kept low, which
 * is what a lookup-and-answer assistant needs. Other models take no extras.
 */
export function assistantModelExtras(model: string): { thinking?: { type: "between_tools" }; effort?: "low" } {
  return model === "claude-sonnet-5-5" ? { thinking: { type: "between_tools" }, effort: "low" } : {};
}
