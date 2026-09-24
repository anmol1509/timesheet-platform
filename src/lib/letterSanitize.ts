import sanitizeHtml from "sanitize-html";

/**
 * Whitelist sanitiser for letter HTML. The editor only produces these tags and
 * styles; anything else in a request (a hand-crafted POST) is dropped, so stored
 * HTML is safe to render back into a page and to feed the PDF converter.
 */
const COLOR = /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|[a-z]{3,20})$/i;
const SIZE = /^\d{1,3}(\.\d+)?(px|pt)$/i;
const FONT = /^[\w\s"',-]{1,80}$/;
const ALIGN = /^(left|right|center|justify)$/i;
const LINEH = /^\d(\.\d+)?$/;

export function sanitizeLetterHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ["p", "br", "strong", "b", "em", "i", "u", "s", "strike", "span", "h1", "h2", "h3", "ul", "ol", "li", "a", "blockquote", "hr", "div", "mark"],
    allowedAttributes: {
      "*": ["style"],
      a: ["href", "target", "rel"],
      div: ["data-worker-table"],
      ol: ["start"],
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowedStyles: {
      "*": {
        color: [COLOR],
        "background-color": [COLOR],
        "font-size": [SIZE],
        "font-family": [FONT],
        "text-align": [ALIGN],
        "line-height": [LINEH],
      },
    },
    // A div is only allowed as the worker-table marker; drop any other.
    exclusiveFilter: (f) => f.tag === "div" && !("data-worker-table" in f.attribs),
    transformTags: { a: (tag, attribs) => ({ tagName: tag, attribs: { ...attribs, target: "_blank", rel: "noopener noreferrer" } }) },
  });
}
