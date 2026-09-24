import { Text, View } from "@react-pdf/renderer";
import { parse, HTMLElement, TextNode, type Node } from "node-html-parser";

/**
 * Turns the sanitised HTML written by the letter editor into @react-pdf
 * elements. Supports what the editor offers: paragraphs, headings, bold /
 * italic / underline / strike, text and highlight colour, font family
 * (sans / serif / mono) and size, alignment, bullet + numbered lists (nested),
 * quotes, links and rules. Anything else is ignored rather than crashing.
 */
const BASE_SIZE = 9;

type Ctx = {
  /** Inside a list item: paragraphs sit tight instead of carrying their own bottom margin. */
  tight?: boolean;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  color?: string;
  bg?: string;
  size?: number;
  family?: "Helvetica" | "Times" | "Courier";
};

const PDF_FONT = {
  Helvetica: ["Helvetica", "Helvetica-Bold", "Helvetica-Oblique", "Helvetica-BoldOblique"],
  Times: ["Times-Roman", "Times-Bold", "Times-Italic", "Times-BoldItalic"],
  Courier: ["Courier", "Courier-Bold", "Courier-Oblique", "Courier-BoldOblique"],
} as const;

function familyOf(css: string): Ctx["family"] {
  const f = css.toLowerCase();
  if (/mono|courier|consolas/.test(f)) return "Courier";
  if (/serif|times|georgia|garamond/.test(f) && !/sans/.test(f)) return "Times";
  return "Helvetica";
}

function styleMap(el: HTMLElement): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (el.getAttribute("style") ?? "").split(";")) {
    const i = part.indexOf(":");
    if (i > 0) out[part.slice(0, i).trim().toLowerCase()] = part.slice(i + 1).trim();
  }
  return out;
}

const toPt = (v: string): number | undefined => {
  const m = /^([\d.]+)(px|pt)$/i.exec(v);
  if (!m) return undefined;
  return m[2].toLowerCase() === "px" ? Math.round(parseFloat(m[1]) * 0.75 * 10) / 10 : parseFloat(m[1]);
};

function inherit(ctx: Ctx, el: HTMLElement): Ctx {
  const next = { ...ctx };
  const tag = el.tagName?.toLowerCase();
  if (tag === "strong" || tag === "b") next.bold = true;
  if (tag === "em" || tag === "i") next.italic = true;
  if (tag === "u") next.underline = true;
  if (tag === "s" || tag === "strike") next.strike = true;
  if (tag === "a") { next.underline = true; next.color = next.color ?? "#1155cc"; }
  const st = styleMap(el);
  if (st.color) next.color = st.color;
  if (st["background-color"]) next.bg = st["background-color"];
  if (st["font-size"]) next.size = toPt(st["font-size"]) ?? next.size;
  if (st["font-family"]) next.family = familyOf(st["font-family"]);
  return next;
}

function textStyle(ctx: Ctx, leaf = false) {
  const fam = PDF_FONT[ctx.family ?? "Helvetica"];
  const font = fam[ctx.bold && ctx.italic ? 3 : ctx.bold ? 1 : ctx.italic ? 2 : 0];
  const deco = [ctx.underline ? "underline" : "", ctx.strike ? "line-through" : ""].filter(Boolean).join(" ");
  return {
    fontFamily: font,
    ...(ctx.size ? { fontSize: ctx.size } : {}),
    ...(ctx.color ? { color: ctx.color } : {}),
    ...(ctx.bg ? { backgroundColor: ctx.bg } : {}),
    // Decoration goes on the wrapping element only: react-pdf drops it when a leaf repeats it inside a decorated parent.
    ...(deco && !leaf ? { textDecoration: deco as "underline" } : {}),
  };
}

function Inline({ nodes, ctx, keyBase }: { nodes: Node[]; ctx: Ctx; keyBase: string }): React.ReactElement {
  return (
    <>
      {nodes.map((n, i) => {
        const key = `${keyBase}-${i}`;
        if (n instanceof TextNode) {
          const t = n.text.replace(/\s+/g, " ");
          return t ? <Text key={key} style={textStyle(ctx, true)}>{t}</Text> : null;
        }
        if (!(n instanceof HTMLElement)) return null;
        const tag = n.tagName?.toLowerCase();
        if (tag === "br") return <Text key={key}>{"\n"}</Text>;
        if (["ul", "ol", "div", "p"].includes(tag)) return null; // blocks are handled by Blocks
        return <Text key={key} style={textStyle(inherit(ctx, n))}><Inline nodes={n.childNodes} ctx={inherit(ctx, n)} keyBase={key} /></Text>;
      })}
    </>
  );
}

const ALIGN = { left: "left", right: "right", center: "center", justify: "justify" } as const;
const HEADING = { h1: 16, h2: 13, h3: 11 } as const;

function alignOf(el: HTMLElement, fallback: keyof typeof ALIGN = "justify") {
  const a = styleMap(el)["text-align"]?.toLowerCase() as keyof typeof ALIGN | undefined;
  return ALIGN[a ?? fallback];
}

function Blocks({ nodes, ctx, depth, keyBase }: { nodes: Node[]; ctx: Ctx; depth: number; keyBase: string }): React.ReactElement {
  return (
    <>
      {nodes.map((n, i) => {
        const key = `${keyBase}-${i}`;
        if (n instanceof TextNode) {
          return n.text.trim() ? <Text key={key} style={{ marginBottom: 8, lineHeight: 1.5, ...textStyle(ctx) }}>{n.text.trim()}</Text> : null;
        }
        if (!(n instanceof HTMLElement)) return null;
        const tag = n.tagName?.toLowerCase();
        const c = inherit(ctx, n);
        const isEmpty = n.text.trim() === "" && !n.querySelector("br");

        if (tag === "p") {
          if (isEmpty) return <View key={key} style={{ height: (c.size ?? BASE_SIZE) * 1.2 }} />;
          return <Text key={key} style={{ marginBottom: c.tight ? 0 : 8, lineHeight: 1.5, textAlign: alignOf(n), ...textStyle(c) }}><Inline nodes={n.childNodes} ctx={c} keyBase={key} /></Text>;
        }
        if (tag === "h1" || tag === "h2" || tag === "h3") {
          return <Text key={key} style={{ marginTop: 4, marginBottom: 6, lineHeight: 1.3, textAlign: alignOf(n, "left"), ...textStyle({ ...c, bold: true, size: c.size ?? HEADING[tag] }) }}><Inline nodes={n.childNodes} ctx={{ ...c, bold: true, size: c.size ?? HEADING[tag] }} keyBase={key} /></Text>;
        }
        if (tag === "ul" || tag === "ol") {
          const start = tag === "ol" ? parseInt(n.getAttribute("start") ?? "1", 10) || 1 : 1;
          const items = n.childNodes.filter((x): x is HTMLElement => x instanceof HTMLElement && x.tagName?.toLowerCase() === "li");
          return (
            <View key={key} style={{ marginBottom: 4 }}>
              {items.map((li, j) => (
                <View key={`${key}-${j}`} style={{ flexDirection: "row", marginBottom: 3, paddingLeft: 8 + depth * 14 }} wrap={false}>
                  <Text style={{ width: 14, lineHeight: 1.5, ...textStyle(c) }}>{tag === "ul" ? (depth % 2 ? "-" : "•") : `${start + j}.`}</Text>
                  <View style={{ flex: 1 }}><Blocks nodes={li.childNodes} ctx={{ ...inherit(c, li), tight: true }} depth={depth + 1} keyBase={`${key}-${j}`} /></View>
                </View>
              ))}
            </View>
          );
        }
        if (tag === "blockquote") {
          return <View key={key} style={{ borderLeftWidth: 2, borderLeftColor: "#9CA3AF", paddingLeft: 8, marginBottom: 8 }}><Blocks nodes={n.childNodes} ctx={{ ...c, italic: true }} depth={depth} keyBase={key} /></View>;
        }
        if (tag === "hr") return <View key={key} style={{ borderBottomWidth: 0.7, borderBottomColor: "#000000", marginVertical: 8 }} />;
        if (tag === "div") return <Blocks key={key} nodes={n.childNodes} ctx={c} depth={depth} keyBase={key} />;
        // Bare inline content at block level.
        return <Text key={key} style={{ marginBottom: 8, lineHeight: 1.5, ...textStyle(c) }}><Inline nodes={[n]} ctx={ctx} keyBase={key} /></Text>;
      })}
    </>
  );
}

/** Renders sanitised editor HTML as PDF blocks. */
export function RichHtml({ html }: { html: string }) {
  const root = parse(html || "");
  return <Blocks nodes={root.childNodes} ctx={{}} depth={0} keyBase="r" />;
}
