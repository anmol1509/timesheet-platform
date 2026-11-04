import { Document, Image, Page, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { Letterhead } from "@/lib/letterhead";
import { CARD_HEIGHT_MM, CARD_WIDTH_MM, GEOM, dayOfRow, type CardWorker, type TimeCardSpec } from "@/lib/timeCard";

/**
 * The time cards as a PDF, one card per page. Three ways to print, all on the same measured positions:
 *  - artwork: the uploaded picture of the card underneath, the values on top (prints a whole card on plain paper);
 *  - overprint: the values alone, to print on top of the physical pre-printed card;
 *  - template: the card drawn by the app from the editable template, the values on top.
 * `paper: "a4"` puts the card at the top left of an A4 sheet (with corner marks) for printers that cannot take a card-sized sheet.
 */
export type TimeCardMode = "artwork" | "overprint" | "template";

export type TimeCardPdfInput = {
  mode: TimeCardMode;
  paper: "card" | "a4";
  spec: TimeCardSpec;
  /** The uploaded artwork as a data URI (PNG or JPEG), for the artwork mode. */
  artwork: string | null;
  letterhead: Letterhead;
  workers: CardWorker[];
};

const PT = 72 / 25.4;
const pt = (mm: number) => mm * PT;
const BLACK = "#111111";
/** On an A4 sheet the card sits this far from the top-left corner. */
const A4_ORIGIN_MM = 12;

const box = (x: number, y: number, w: number, h: number) => ({ position: "absolute" as const, left: pt(x), top: pt(y), width: pt(w), height: pt(h) });

/** Fits text on one line by cutting it, since the PDF library has no single-line clamp. */
const fit = (s: string, widthMm: number, fontPt: number) => {
  const per = fontPt * 0.3528 * 0.54;
  const max = Math.max(1, Math.floor(widthMm / per));
  return s.length > max ? `${s.slice(0, Math.max(1, max - 1))}…` : s;
};

function Values({ w, offset }: { w: CardWorker; offset: { x: number; y: number } }) {
  const g = GEOM;
  const F = 9;
  const header: [keyof typeof g.fields, string][] = [["name", w.name], ["date", w.monthLabel], ["profession", w.profession], ["site", w.site], ["wage", w.wage], ["no", w.idNo]];
  const cols = [g.grid.left, g.grid.right];
  const cell = (x0: number, x1: number, y0: number, y1: number, value: string, bold = false, size = 8) =>
    value ? (
      <View style={{ ...box(x0 + offset.x, y0 + offset.y, x1 - x0, y1 - y0), justifyContent: "center", alignItems: "center" }}>
        <Text style={{ fontSize: size, fontFamily: bold ? "Helvetica-Bold" : "Helvetica", color: BLACK }}>{value}</Text>
      </View>
    ) : null;
  const t = g.totals;
  const money = w.money;
  return (
    <View style={{ position: "absolute", left: 0, top: 0, width: pt(CARD_WIDTH_MM), height: pt(CARD_HEIGHT_MM) }}>
      {header.map(([k, v]) =>
        v ? (
          <Text key={k} style={{ ...box(g.fields[k].x + 1 + offset.x, g.fields[k].line - 3.6 + offset.y, g.fields[k].w - 1, 4.2), fontSize: F, fontFamily: "Helvetica-Bold", color: BLACK }}>
            {fit(v, g.fields[k].w - 1, F)}
          </Text>
        ) : null
      )}
      {[0, 1].flatMap((half) =>
        Array.from({ length: 16 }, (_, row) => {
          const day = dayOfRow(half as 0 | 1, row);
          const d = w.days.find((x) => x.day === day);
          if (!d) return null;
          const c = cols[half];
          const y0 = g.grid.rowsY[row];
          const y1 = g.grid.rowsY[row + 1];
          return (
            <View key={`${half}-${row}`}>
              {cell(c[1], c[2], y0, y1, d.in, false, 7.5)}
              {cell(c[2], c[3], y0, y1, d.out, false, 7.5)}
              {cell(c[3], c[4], y0, y1, d.overtime, false, 8)}
              {cell(c[4], c[5], y0, y1, d.total, d.total === "A" || d.total === "OFF", 8)}
            </View>
          );
        })
      )}
      {w.totals.days > 0 && (
        <View style={{ ...box(t.cols[1] + offset.x, t.rowsY[0] + offset.y, t.cols[2] - t.cols[1], t.rowsY[1] - t.rowsY[0]), justifyContent: "center", alignItems: "center" }}>
          <Text style={{ fontSize: 6.5, color: BLACK }}>{w.totals.days} d</Text>
          <Text style={{ fontSize: 6.5, color: BLACK }}>{w.totals.hours} h</Text>
        </View>
      )}
      {Number(w.totals.overtimeHours) > 0 && cell(t.cols[1], t.cols[2], t.rowsY[1], t.rowsY[2], `${w.totals.overtimeHours} h`, false, 7.5)}
      {money && (
        <>
          {cell(t.cols[2], t.cols[3], t.rowsY[0], t.rowsY[1], money.basic, false, 7.5)}
          {cell(t.cols[2], t.cols[3], t.rowsY[1], t.rowsY[2], money.overtime, false, 7.5)}
          {cell(t.cols[2], t.cols[3], t.rowsY[2], t.rowsY[3], money.earned, true, 7.5)}
          {cell(t.cols[2], t.cols[3], t.rowsY[3], t.rowsY[4], money.advance, false, 7.5)}
          {cell(t.cols[2], t.cols[3], t.rowsY[4], t.rowsY[5], money.balance, true, 8)}
        </>
      )}
    </View>
  );
}

const line = (x: number, y: number, w: number, h: number, color: string, extra: Record<string, unknown> = {}) => (
  <View style={{ ...box(x, y, w, h), backgroundColor: color, ...extra }} />
);

function Template({ spec, letterhead }: { spec: TimeCardSpec; letterhead: Letterhead }) {
  const g = GEOM;
  const ink = spec.ink;
  const left = g.grid.left;
  const right = g.grid.right;
  const gx0 = left[0];
  const gx1 = right[5];
  const top = g.grid.headY[0];
  const bottom = g.grid.rowsY[16];
  const contact = spec.contactLine || [letterhead.addressLines.join(", "), letterhead.phone && `Tel ${letterhead.phone}`, letterhead.email, letterhead.poBox && `P.O. Box ${letterhead.poBox}`].filter(Boolean).join("  ·  ");
  const label = (text: string, x: number, lineY: number) => (
    <Text style={{ ...box(x, lineY - 4.6, 70, 4.4), fontSize: 8.5, fontFamily: "Helvetica-Bold", color: ink }}>{text}</Text>
  );
  const dotted = (x: number, y: number, w: number) => <View style={{ ...box(x, y, w, 0.3), borderBottomWidth: 0.6, borderBottomStyle: "dotted", borderBottomColor: ink }} />;
  const head = (text: string, x0: number, x1: number, y0: number, y1: number) => (
    <View style={{ ...box(x0, y0, x1 - x0, y1 - y0), justifyContent: "center", alignItems: "center" }}>
      <Text style={{ fontSize: 6.5, fontFamily: "Helvetica-Bold", color: ink }}>{text}</Text>
    </View>
  );
  const h = spec.headings;
  return (
    <View style={{ position: "absolute", left: 0, top: 0, width: pt(CARD_WIDTH_MM), height: pt(CARD_HEIGHT_MM), backgroundColor: spec.tint }}>
      {spec.showLogo && letterhead.logo && (
        // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt prop
        <Image src={letterhead.logo} style={{ ...box(g.fields.name.x - 5, g.headerTop, 15, 14), objectFit: "contain" }} />
      )}
      <Text style={{ ...box(g.fields.name.x + (spec.showLogo && letterhead.logo ? 11 : -5), g.headerTop + 1, 90, 6), fontSize: 11, fontFamily: "Helvetica-Bold", color: ink }}>{fit((spec.companyName || letterhead.name).toUpperCase(), 90, 11)}</Text>
      <Text style={{ ...box(g.fields.name.x + (spec.showLogo && letterhead.logo ? 11 : -5), g.headerTop + 7.5, 90, 8), fontSize: 5.8, color: ink }}>{contact}</Text>
      {line(g.grid.left[0], g.rule, gx1 - gx0, 0.5, ink)}
      <View style={{ ...box(g.titlePill.x, g.titlePill.y, g.titlePill.w, g.titlePill.h), backgroundColor: ink, borderRadius: pt(1.2), justifyContent: "center", alignItems: "center" }}>
        <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold", color: "#FFFFFF" }}>{spec.title}</Text>
      </View>

      {(["name", "date", "profession", "site", "wage", "no"] as const).map((k) => (
        <View key={k}>
          {label(spec.labels[k], GEOM.labelX[k], g.fields[k].line)}
          {dotted(g.fields[k].x, g.fields[k].line, g.fields[k].w)}
        </View>
      ))}

      {/* The month grid */}
      <View style={{ ...box(gx0, top, gx1 - gx0, bottom - top), borderWidth: 0.8, borderColor: ink }} />
      {[g.grid.headY[1], ...g.grid.rowsY.slice(1, 16)].map((y) => line(gx0, y, gx1 - gx0, 0.4, ink))}
      {[...left.slice(1, 5), ...right.slice(1, 5), left[5], right[0]].map((x, i) => line(x, top, 0.4, bottom - top, ink, { key: i }))}
      {[left, right].map((c, half) => (
        <View key={half}>
          {head(h.date, c[0], c[1], top, g.grid.headY[1])}
          {head(h.in, c[1], c[2], top, g.grid.headY[1])}
          {head(h.out, c[2], c[3], top, g.grid.headY[1])}
          {head(h.overtime, c[3], c[4], top, g.grid.headY[1])}
          {head(h.total, c[4], c[5], top, g.grid.headY[1])}
          {Array.from({ length: 16 }, (_, row) => {
            const day = dayOfRow(half as 0 | 1, row);
            if (day > 31) return null;
            return (
              <View key={row} style={{ ...box(c[0], g.grid.rowsY[row], c[1] - c[0], g.grid.rowsY[row + 1] - g.grid.rowsY[row]), justifyContent: "center", alignItems: "center" }}>
                <Text style={{ fontSize: 7.5, fontFamily: "Helvetica-Bold", color: ink }}>{String(day)}</Text>
              </View>
            );
          })}
        </View>
      ))}

      {/* The totals box */}
      {(() => {
        const t = g.totals;
        const x0 = t.cols[0];
        const x1 = t.cols[5];
        const y0 = t.headY[0];
        const y1 = t.rowsY[5];
        const labels = [spec.totals.days, spec.totals.overtime, spec.totals.earned, spec.totals.advance, spec.totals.balance];
        return (
          <View>
            <View style={{ ...box(x0, y0, x1 - x0, y1 - y0), borderWidth: 0.8, borderColor: ink }} />
            {line(x0, t.headY[1], t.cols[4] - x0, 0.4, ink)}
            {t.rowsY.slice(1, 5).map((y) => line(x0, y, t.cols[4] - x0, 0.4, ink))}
            {[t.cols[1], t.cols[2], t.cols[4]].map((x) => line(x, t.headY[0], 0.4, y1 - t.headY[0], ink, { key: x }))}
            {line(t.cols[3], t.headY[1], 0.4, y1 - t.headY[1], ink)}
            {head(spec.totals.header, t.cols[2], t.cols[4], y0, t.headY[1])}
            {labels.map((txt, i) => (
              <View key={i} style={{ ...box(x0 + 1, t.rowsY[i], t.cols[1] - x0 - 1, t.rowsY[i + 1] - t.rowsY[i]), justifyContent: "center" }}>
                <Text style={{ fontSize: 6.8, fontFamily: "Helvetica-Bold", color: ink }}>{txt}</Text>
              </View>
            ))}
          </View>
        );
      })()}

      {g.signatures.x.map(([a, b], i) => (
        <View key={i}>
          {dotted(a, g.signatures.lineY, b - a)}
          <View style={{ ...box(a, g.signatures.labelY - 3, b - a, 4.5), alignItems: "center" }}>
            <Text style={{ fontSize: 8, fontFamily: "Helvetica-Bold", color: ink }}>{spec.signatures[i]}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

/** Small marks in the four corners of the card's place on an A4 sheet, so a card laid on the sheet can be lined up. */
function CornerMarks() {
  const m = (x: number, y: number, i: number) => (
    <View key={i}>
      {line(x - 4, y - 0.15, 8, 0.3, "#6B7280")}
      {line(x - 0.15, y - 4, 0.3, 8, "#6B7280")}
    </View>
  );
  const o = A4_ORIGIN_MM;
  return <>{[m(o, o, 0), m(o + CARD_WIDTH_MM, o, 1), m(o, o + CARD_HEIGHT_MM, 2), m(o + CARD_WIDTH_MM, o + CARD_HEIGHT_MM, 3)]}</>;
}

export async function generateTimeCardPdf(input: TimeCardPdfInput): Promise<Buffer> {
  const { mode, paper, spec } = input;
  const size = paper === "a4" ? "A4" : ([pt(CARD_WIDTH_MM), pt(CARD_HEIGHT_MM)] as [number, number]);
  const origin = paper === "a4" ? A4_ORIGIN_MM : 0;
  // The printer offset only matters when printing on the physical card.
  const offset = mode === "overprint" ? { x: spec.offsetXmm, y: spec.offsetYmm } : { x: 0, y: 0 };
  const doc = (
    <Document title="Time cards">
      {input.workers.map((w, i) => (
        <Page key={i} size={size} style={{ backgroundColor: "#FFFFFF", fontFamily: "Helvetica" }}>
          {paper === "a4" && mode === "overprint" && <CornerMarks />}
          <View style={{ position: "absolute", left: pt(origin), top: pt(origin), width: pt(CARD_WIDTH_MM), height: pt(CARD_HEIGHT_MM) }}>
            {mode === "artwork" && input.artwork && (
              // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt prop
              <Image src={input.artwork} style={{ position: "absolute", left: 0, top: 0, width: pt(CARD_WIDTH_MM), height: pt(CARD_HEIGHT_MM) }} />
            )}
            {mode === "template" && <Template spec={spec} letterhead={input.letterhead} />}
            <Values w={w} offset={offset} />
          </View>
        </Page>
      ))}
    </Document>
  );
  return renderToBuffer(doc);
}
