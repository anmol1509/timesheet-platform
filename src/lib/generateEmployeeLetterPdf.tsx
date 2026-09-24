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
  /** Printed under "For and on behalf of"; defaults to "Authorised Signatory". */
  signedBy: string | null;
};

const s = StyleSheet.create({
  page: { paddingTop: 40, paddingBottom: 48, paddingHorizontal: 50, fontSize: 9, fontFamily: "Helvetica" },
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
  const doc = (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          {l.logo && <Image src={l.logo} style={s.logo} />}
          <View style={{ flex: 1 }}>
            <Text style={s.company}>{l.name.toUpperCase()}</Text>
            {l.addressLines.length > 0 && <Text style={s.small}>{l.addressLines.join(", ")}</Text>}
            {contact && <Text style={s.small}>{contact}</Text>}
            {l.trn && <Text style={s.small}>TRN: {l.trn}</Text>}
          </View>
        </View>
        <View style={s.meta}>
          <Text>Ref: {input.refNo}</Text>
          <Text>Date: {input.date}</Text>
        </View>
        <Text style={s.title}>{input.title.toUpperCase()}</Text>
        <RichHtml html={input.bodyHtml} />
        <View style={s.signature} wrap={false}>
          <Text>For and on behalf of</Text>
          <Text style={s.bold}>{l.name.toUpperCase()}</Text>
          <Text style={{ marginTop: 26 }}>{input.signedBy || "Authorised Signatory"}</Text>
        </View>
      </Page>
    </Document>
  );
  return renderToBuffer(doc);
}
