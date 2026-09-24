/**
 * Pure helpers for letter bodies stored as HTML (written by the rich editor).
 * Runs in the browser and on the server — no Node-only imports here.
 */
export const WORKER_TABLE_ATTR = "data-worker-table";
export const WORKER_TABLE_TAG = `<div ${WORKER_TABLE_ATTR}="true"></div>`;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Old templates were plain text ("new line = paragraph", **bold**, "- bullet"); read them as HTML. */
export function legacyTextToHtml(text: string): string {
  const lines = text.replace(/\r\n/g, "\n").split("\n").map((l) => l.trim()).filter(Boolean);
  const inline = (l: string) => {
    const parts = l.split("**");
    if (parts.length % 2 === 0) return esc(l.replace(/\*\*/g, ""));
    return parts.map((p, i) => (i % 2 ? `<strong>${esc(p)}</strong>` : esc(p))).join("");
  };
  const out: string[] = [];
  let list: string[] = [];
  const flush = () => { if (list.length) { out.push(`<ul>${list.join("")}</ul>`); list = []; } };
  for (const l of lines) {
    const b = /^[-•]\s+(.*)$/.exec(l);
    if (b) list.push(`<li><p>${inline(b[1])}</p></li>`);
    else { flush(); out.push(`<p>${inline(l)}</p>`); }
  }
  flush();
  return out.join("") || "<p></p>";
}

/** Whether a stored value is HTML from the editor (vs legacy plain text). */
export const looksLikeHtml = (s: string) => /^\s*<(p|h[1-6]|ul|ol|div|blockquote)[\s>]/i.test(s);

export function templateHtml(t: { bodyHtml: string | null; remarksText: string }): string {
  return t.bodyHtml && t.bodyHtml.trim() ? t.bodyHtml : looksLikeHtml(t.remarksText) ? t.remarksText : legacyTextToHtml(t.remarksText);
}

/** Visible text of an HTML body — used for snippets, search and field checks. */
export function htmlToText(html: string): string {
  return html
    .replace(/<\/(p|div|h[1-6]|li|blockquote)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

/** Replaces %%FIELD%% tokens with (HTML-escaped) values. Unknown fields become empty. */
export function substituteInHtml(html: string, values: Record<string, string>): string {
  return html.replace(/%%([^%<>\n]+?)%%/g, (_m, key: string) => esc(values[key.trim()] ?? ""));
}

/** Every %%TOKEN%% in a body, from its visible text so a token broken by formatting shows up as unknown. */
export function tokensIn(html: string): string[] {
  return [...htmlToText(html).matchAll(/%%([^%\n]+?)%%/g)].map((m) => m[1]);
}

export const ASK_PREFIX = "ASK:";
/** Prompts a template asks the person generating the letter to fill in. */
export const askLabels = (html: string) => [...new Set(tokensIn(html).filter((t) => t.startsWith(ASK_PREFIX)).map((t) => t.slice(ASK_PREFIX.length).trim()).filter(Boolean))];

export const hasWorkerTable = (html: string) => html.includes(WORKER_TABLE_ATTR);

/** Splits a body around the worker-table marker: [before, after, hadMarker]. */
export function splitAtWorkerTable(html: string): { before: string; after: string; hasTable: boolean } {
  const m = /<div[^>]*data-worker-table[^>]*>\s*<\/div>/i.exec(html);
  if (!m) return { before: html, after: "", hasTable: false };
  return { before: html.slice(0, m.index), after: html.slice(m.index + m[0].length), hasTable: true };
}
