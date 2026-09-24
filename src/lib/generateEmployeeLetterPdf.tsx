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
};

export const PLAIN_LAYOUT: LetterLayout = { onLetterhead: false, letterheadImage: null, signatoryName: null, signatoryTitle: null, signatureImage: null, stampImage: null };

// Same clearances as the client letters: 150pt clears a normal A4 letterhead header, 90pt its footer.
const LETTERHEAD_TOP = 150;
const LETTERHEAD_BOTTOM = 90;
const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;

const s = StyleSheet.create({
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
  const doc = (
    <Document>
      <Page size="A4" style={layout.onLetterhead ? s.pageOnLetterhead : s.page}>
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
