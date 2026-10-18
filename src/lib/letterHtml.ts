/**
 * Pure helpers for letter bodies stored as HTML (written by the rich editor).
 * Runs in the browser and on the server — no Node-only imports here.
 */
export const WORKER_TABLE_ATTR = "data-worker-table";
export const WORKER_TABLE_TAG = `<div ${WORKER_TABLE_ATTR}="true"></div>`;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Old templates were plain text ("new line = paragraph", **bold**, "- bullet"); read them as HTML.
 * Ready-made templates also use `| a | b |` lines for tables: a run of them is one table, and a row of `|---|---|`
 * right after the first makes that first row the heading. `|30%| a | b |`-style widths are written `| a{30%} | b |`.
 */
export function legacyTextToHtml(text: string): string {
  const lines = text.replace(/\r\n/g, "\n").split("\n").map((l) => l.trim()).filter(Boolean);
  const inline = (l: string) => {
    const parts = l.split("**");
    if (parts.length % 2 === 0) return esc(l.replace(/\*\*/g, ""));
    return parts.map((p, i) => (i % 2 ? `<strong>${esc(p)}</strong>` : esc(p))).join("");
  };
  const out: string[] = [];
  let list: string[] = [];
  let rows: string[] = [];
  const flush = () => { if (list.length) { out.push(`<ul>${list.join("")}</ul>`); list = []; } };
  const flushTable = () => {
    if (!rows.length) return;
    const parse = (r: string) => r.replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
    const grid = rows.map(parse);
    const head = grid.length > 1 && /^[-:\s|]+$/.test(rows[1]);
    const body = grid.filter((_, i) => !(head && i === 1));
    // A width given on the first row's first cell applies down the whole first column.
    const firstWidth = /\{(\d{1,3})%\}\s*$/.exec(body[0]?.[0] ?? "")?.[1];
    if (firstWidth) for (const r of body) if (!/\{\d{1,3}%\}\s*$/.test(r[0] ?? "")) r[0] = `${r[0] ?? ""}{${firstWidth}%}`;
    const cell = (tag: string, c: string) => {
      const w = /\{(\d{1,3})%\}\s*$/.exec(c);
      return `<${tag}${w ? ` style="width: ${w[1]}%"` : ""}><p>${inline(c.replace(/\{\d{1,3}%\}\s*$/, "").trim())}</p></${tag}>`;
    };
    out.push(`<table><tbody>${body.map((r, i) => `<tr>${r.map((c) => cell(head && i === 0 ? "th" : "td", c)).join("")}</tr>`).join("")}</tbody></table>`);
    rows = [];
  };
  for (const l of lines) {
    if (l.startsWith("|")) { flush(); rows.push(l); continue; }
    flushTable();
    const b = /^[-•]\s+(.*)$/.exec(l);
    if (b) list.push(`<li><p>${inline(b[1])}</p></li>`);
    else { flush(); out.push(`<p>${inline(l)}</p>`); }
  }
  flush();
  flushTable();
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
    .replace(/<\/(p|div|h[1-6]|li|blockquote|tr)>/gi, "\n")
    .replace(/<\/(td|th)>/gi, "  ")
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

/** A blank whose question asks for a date ("From date", "Date of incident"), so it can offer a calendar instead of a text box. */
export const isDateAsk = (label: string) => /\bdate\b/i.test(label) && !/\b(update|dated?\s+by)\b/i.test(label);

/** A calendar's YYYY-MM-DD as the DD-MM-YYYY every letter prints, and back. Anything else comes back unchanged or empty. */
export const isoToLetterDate = (iso: string) => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso.split("-").reverse().join("-") : "");
export const letterDateToIso = (d: string) => (/^\d{2}-\d{2}-\d{4}$/.test(d) ? d.split("-").reverse().join("-") : "");
