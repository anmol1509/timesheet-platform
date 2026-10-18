import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { Letterhead } from "@/lib/letterhead";
import { RichHtml } from "@/lib/richPdf";

/**
 * A letter about one employee (salary certificate, experience letter, warning…):
 * company letterhead, reference and date, heading, the rich body, and a
 * signature block. Sibling of generateLetterPdf, which is for client-facing
 * letters with a worker table.
 */
export type EmployeeLetterInput = {
  letterhead: Letterhead;
  refNo: string;
  date: string;
  title: string;
  bodyHtml: string;
  layout: LetterLayout;
};

/** How this letter is printed. Everything here is optional and chosen per letter. */
export type LetterLayout = {
  /** Printing on letterhead: our own header block is left out and the header/footer area stays clear. */
  onLetterhead: boolean;
  /** Full-page letterhead artwork (data URI) drawn behind the text when printing on letterhead. */
  letterheadImage: string | null;
  signatoryName: string | null;
  signatoryTitle: string | null;
  /** Signature and stamp images as data URIs (null = not printed). */
  signatureImage: string | null;
  stampImage: string | null;
  /** Clear space kept at the top and bottom on a letterhead, in mm (defaults 65 / 35). */
  topMm?: number | null;
  bottomMm?: number | null;
  /**
   * Letters issued from now on: no header of our own (plain paper is just the body, on the company's margins),
   * larger text and a signature line. Letters issued earlier leave this off and print exactly as they did.
   */
  modern?: boolean;
  /** Margins in mm saved with the letter: all four on plain paper, left and right on a letterhead. */
  margins?: { top: number; bottom: number; left: number; right: number } | null;
};

export const PLAIN_LAYOUT: LetterLayout = { onLetterhead: false, letterheadImage: null, signatoryName: null, signatoryTitle: null, signatureImage: null, stampImage: null };

// Same clearances as the client letters: 150pt clears a normal A4 letterhead header, 90pt its footer.
const MM = 72 / 25.4; // millimetres to points
const LETTERHEAD_TOP = 65 * MM;
const LETTERHEAD_BOTTOM = 35 * MM;
const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;

const s = StyleSheet.create({
  // Letters issued from now on: readable size, even spacing, room to sign.
  pageModern: { fontSize: 10.5, fontFamily: "Helvetica" },
  metaModern: { flexDirection: "row", justifyContent: "space-between", marginBottom: 18, fontSize: 9.5, color: "#374151" },
  titleModern: { marginBottom: 18, fontSize: 13, fontFamily: "Helvetica-Bold", textAlign: "center", letterSpacing: 1.2 },
  signatureModern: { marginTop: 34 },
  signatureLine: { borderTopWidth: 0.8, borderTopColor: "#111111", width: 170, marginTop: 6, paddingTop: 4 },
  page: { paddingTop: 40, paddingBottom: 48, paddingHorizontal: 50, fontSize: 9, fontFamily: "Helvetica" },
  pageOnLetterhead: { paddingTop: LETTERHEAD_TOP, paddingBottom: LETTERHEAD_BOTTOM, paddingHorizontal: 52, fontSize: 9, fontFamily: "Helvetica" },
  background: { position: "absolute", top: 0, left: 0, width: A4_WIDTH, height: A4_HEIGHT },
  header: { flexDirection: "row", alignItems: "center", paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: "#111111", marginBottom: 16 },
  logo: { width: 52, height: 52, objectFit: "contain", marginRight: 12 },
  company: { fontFamily: "Helvetica-Bold", fontSize: 13 },
  small: { fontSize: 8, color: "#374151", marginTop: 1 },
  meta: { flexDirection: "row", justifyContent: "space-between", marginBottom: 14 },
  title: { marginBottom: 14, fontSize: 12, fontFamily: "Helvetica-Bold", textAlign: "center", textDecoration: "underline" },
  signature: { marginTop: 30 },
  bold: { fontFamily: "Helvetica-Bold" },
});

export async function generateEmployeeLetterPdf(input: EmployeeLetterInput): Promise<Buffer> {
  const { letterhead: l } = input;
  const contact = [l.phone && `Tel: ${l.phone}`, l.fax && `Fax: ${l.fax}`, l.email && `Email: ${l.email}`, l.poBox && `P.O. Box ${l.poBox}`].filter(Boolean).join("   ");
  const { layout } = input;
  if (layout.modern) return renderToBuffer(<ModernLetter input={input} />);
  const doc = (
    <Document>
      <Page size="A4" style={layout.onLetterhead ? [s.pageOnLetterhead, { paddingTop: (layout.topMm ?? 65) * MM, paddingBottom: (layout.bottomMm ?? 35) * MM }] : s.page}>
        {layout.onLetterhead && layout.letterheadImage && <Image src={layout.letterheadImage} style={s.background} fixed />}
        {!layout.onLetterhead && (
          <View style={s.header}>
            {l.logo && <Image src={l.logo} style={s.logo} />}
            <View style={{ flex: 1 }}>
              <Text style={s.company}>{l.name.toUpperCase()}</Text>
              {l.addressLines.length > 0 && <Text style={s.small}>{l.addressLines.join(", ")}</Text>}
              {contact && <Text style={s.small}>{contact}</Text>}
              {l.trn && <Text style={s.small}>TRN: {l.trn}</Text>}
            </View>
          </View>
        )}
        <View style={s.meta}>
          <Text>Ref: {input.refNo}</Text>
          <Text>Date: {input.date}</Text>
        </View>
        <Text style={s.title}>{input.title.toUpperCase()}</Text>
        <RichHtml html={input.bodyHtml} />
        <View style={s.signature} wrap={false}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" }}>
            <View>
              <Text>For and on behalf of</Text>
              <Text style={s.bold}>{l.name.toUpperCase()}</Text>
              {layout.signatureImage ? <Image src={layout.signatureImage} style={{ width: 120, height: 44, objectFit: "contain", marginTop: 6, marginBottom: 2 }} /> : <View style={{ height: 30 }} />}
              <Text style={s.bold}>{layout.signatoryName || "Authorised Signatory"}</Text>
              {layout.signatoryTitle && <Text>{layout.signatoryTitle}</Text>}
            </View>
            {layout.stampImage && <Image src={layout.stampImage} style={{ width: 92, height: 92, objectFit: "contain" }} />}
          </View>
        </View>
      </Page>
    </Document>
  );
  return renderToBuffer(doc);
}

/** The letter as issued from now on: body only, on the company's margins. */
function ModernLetter({ input }: { input: EmployeeLetterInput }) {
  const { layout, letterhead: l } = input;
  const m = layout.margins ?? { top: 25, bottom: 25, left: 25, right: 25 };
  const { top, bottom } = m;
  return (
    <Document>
      <Page size="A4" style={[s.pageModern, { paddingTop: top * MM, paddingBottom: bottom * MM, paddingLeft: m.left * MM, paddingRight: m.right * MM }]}>
        {layout.onLetterhead && layout.letterheadImage && <Image src={layout.letterheadImage} style={s.background} fixed />}
        <View style={s.metaModern}>
          <Text>Ref: {input.refNo}</Text>
          <Text>Date: {input.date}</Text>
        </View>
        <Text style={s.titleModern}>{input.title.toUpperCase()}</Text>
        <RichHtml html={input.bodyHtml} baseSize={10.5} />
        <View style={s.signatureModern} wrap={false}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" }}>
            <View>
              <Text>For and on behalf of</Text>
              <Text style={s.bold}>{l.name.toUpperCase()}</Text>
              {layout.signatureImage ? <Image src={layout.signatureImage} style={{ width: 130, height: 48, objectFit: "contain", marginTop: 6 }} /> : <View style={{ height: 36 }} />}
              <View style={s.signatureLine}>
                <Text style={s.bold}>{layout.signatoryName || "Authorised Signatory"}</Text>
                {layout.signatoryTitle && <Text style={{ color: "#374151" }}>{layout.signatoryTitle}</Text>}
              </View>
            </View>
            {layout.stampImage && <Image src={layout.stampImage} style={{ width: 96, height: 96, objectFit: "contain" }} />}
          </View>
        </View>
      </Page>
    </Document>
  );
}
