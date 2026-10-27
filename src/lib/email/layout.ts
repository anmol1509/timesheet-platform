/**
 * The shared look of every email the app sends: a brand header (the company's logo or name), a heading, a few paragraphs, an
 * optional table of facts, one button, and a footer. Pure: it returns the HTML and a plain-text copy, so it can be tested and
 * previewed. All text is escaped here; callers pass plain text only.
 */

export type EmailTone = "default" | "success" | "warning" | "danger";
export type EmailBrand = { name: string; logoUrl?: string | null };

export type EmailSpec = {
  /** The grey line shown beside the subject in the inbox. */
  preheader?: string;
  /** A small label above the heading, e.g. "Approval needed". */
  eyebrow?: string;
  heading: string;
  /** Plain-text paragraphs. A paragraph made only of lines starting with "- " or "• " is shown as a list. */
  paragraphs: string[];
  facts?: { label: string; value: string }[];
  button?: { label: string; url: string };
  /** Small print under the button. */
  note?: string;
  tone?: EmailTone;
  brand: EmailBrand;
  /** Why this person is getting the email. */
  footer?: string;
};

const ACCENT: Record<EmailTone, string> = { default: "#5b49d8", success: "#12805c", warning: "#b45309", danger: "#b42318" };

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** A link is only ever put in an email when it is a web address, so nothing like javascript: can be smuggled in. */
export function safeUrl(url: string): string | null {
  return /^https?:\/\/[^\s"'<>]+$/i.test(url) ? url : null;
}

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

function paragraphHtml(p: string): string {
  const lines = p.split("\n").map((l) => l.trimEnd()).filter((l) => l.trim() !== "");
  if (lines.length > 0 && lines.every((l) => /^\s*[-•]\s+/.test(l))) {
    return `<ul style="margin:0 0 16px;padding-left:20px;color:#374151;font-size:15px;line-height:1.6;">${lines.map((l) => `<li style="margin:0 0 4px;">${escapeHtml(l.replace(/^\s*[-•]\s+/, ""))}</li>`).join("")}</ul>`;
  }
  return `<p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6;">${lines.map(escapeHtml).join("<br>")}</p>`;
}

export function renderEmail(spec: EmailSpec): { html: string; text: string } {
  const accent = ACCENT[spec.tone ?? "default"];
  const url = spec.button ? safeUrl(spec.button.url) : null;
  const logo = spec.brand.logoUrl && safeUrl(spec.brand.logoUrl);
  const header = logo
    ? `<img src="${escapeHtml(logo)}" alt="${escapeHtml(spec.brand.name)}" height="36" style="display:block;height:36px;max-width:180px;border:0;">`
    : `<span style="font-size:18px;font-weight:700;color:#111827;letter-spacing:-0.01em;">${escapeHtml(spec.brand.name)}</span>`;
  const facts = spec.facts && spec.facts.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;border:1px solid #e5e7eb;border-radius:8px;border-collapse:separate;">${spec.facts.map((f, i) => `<tr><td style="padding:10px 14px;font-size:13px;color:#6b7280;width:38%;${i > 0 ? "border-top:1px solid #e5e7eb;" : ""}">${escapeHtml(f.label)}</td><td style="padding:10px 14px;font-size:14px;color:#111827;font-weight:600;${i > 0 ? "border-top:1px solid #e5e7eb;" : ""}">${escapeHtml(f.value)}</td></tr>`).join("")}</table>`
    : "";
  const button = spec.button && url
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:4px 0 20px;"><tr><td style="border-radius:8px;background:${accent};"><a href="${escapeHtml(url)}" style="display:inline-block;padding:12px 22px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">${escapeHtml(spec.button.label)}</a></td></tr></table><p style="margin:0 0 16px;font-size:12px;line-height:1.5;color:#6b7280;">If the button doesn't work, copy this link into your browser:<br><a href="${escapeHtml(url)}" style="color:${accent};word-break:break-all;">${escapeHtml(url)}</a></p>`
    : "";
  const note = spec.note ? `<p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#6b7280;">${escapeHtml(spec.note)}</p>` : "";
  const footer = spec.footer ?? `Sent by ManpowerSync for ${spec.brand.name}.`;
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escapeHtml(spec.heading)}</title></head>
<body style="margin:0;padding:0;background:#f4f5f7;">
${spec.preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(spec.preheader)}</div>` : ""}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;font-family:${FONT};">
<tr><td style="height:4px;background:${accent};font-size:0;line-height:0;">&nbsp;</td></tr>
<tr><td style="padding:22px 28px 6px;">${header}</td></tr>
<tr><td style="padding:14px 28px 4px;">
${spec.eyebrow ? `<p style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${accent};">${escapeHtml(spec.eyebrow)}</p>` : ""}
<h1 style="margin:0 0 14px;font-size:21px;line-height:1.3;color:#111827;">${escapeHtml(spec.heading)}</h1>
${spec.paragraphs.map(paragraphHtml).join("\n")}
${facts}
${button}
${note}
</td></tr>
<tr><td style="padding:14px 28px 22px;border-top:1px solid #eef0f3;"><p style="margin:0;font-size:12px;line-height:1.5;color:#9ca3af;">${escapeHtml(footer)}</p></td></tr>
</table></td></tr></table></body></html>`;

  const textParts = [
    spec.eyebrow ? spec.eyebrow.toUpperCase() : null,
    spec.heading,
    "",
    ...spec.paragraphs.flatMap((p) => [p, ""]),
    ...(spec.facts && spec.facts.length ? [...spec.facts.map((f) => `${f.label}: ${f.value}`), ""] : []),
    ...(spec.button && url ? [`${spec.button.label}: ${url}`, ""] : []),
    ...(spec.note ? [spec.note, ""] : []),
    "--",
    footer,
  ].filter((x): x is string => x !== null);
  return { html, text: textParts.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n" };
}
