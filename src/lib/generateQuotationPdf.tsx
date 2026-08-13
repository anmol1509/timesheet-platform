import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";

export type QuotationPdfLine = {
  trade: string;
  quantity: number;
  rate: number;
  otRate: number | null;
  nationality: string | null;
  workingHours: string | null;
};

export type QuotationPdfInput = {
  branchName: string;
  branchAddress: string | null;
  quotationNumber: string;
  clientName: string;
  validUntil: string | null;
  terms: string | null;
  accommodationResponsibility: string | null;
  transportationResponsibility: string | null;
  ppeResponsibility: string | null;
  lines: QuotationPdfLine[];
};

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica" },
  letterhead: { marginBottom: 24, borderBottomWidth: 1, borderColor: "#2563eb", paddingBottom: 10 },
  companyName: { fontSize: 16, fontWeight: 700, color: "#2563eb" },
  companyAddress: { fontSize: 8, color: "#475569", marginTop: 2 },
  docNo: { fontSize: 8, color: "#475569", marginTop: 6 },
  meta: { marginBottom: 12 },
  metaRow: { fontSize: 9, marginBottom: 2, color: "#334155" },
  table: { display: "flex", flexDirection: "column", borderWidth: 0.5, borderColor: "#94A3B8", marginTop: 12 },
  headerRow: { flexDirection: "row", backgroundColor: "#2563eb" },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderColor: "#E2E8F0" },
  cell: { flex: 1, padding: 5, justifyContent: "center" },
  headerCell: { fontSize: 8, fontWeight: 700, color: "#FFFFFF" },
  section: { marginTop: 16 },
  sectionTitle: { fontSize: 10, fontWeight: 700, marginBottom: 4, color: "#0F172A" },
  paragraph: { marginBottom: 4, lineHeight: 1.5, color: "#334155" },
});

export async function generateQuotationPdf(input: QuotationPdfInput): Promise<Buffer> {
  const subtotal = input.lines.reduce((sum, l) => sum + l.quantity * l.rate, 0);

  const doc = (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.letterhead}>
          <Text style={styles.companyName}>{input.branchName}</Text>
          {input.branchAddress && <Text style={styles.companyAddress}>{input.branchAddress}</Text>}
          <Text style={styles.docNo}>Quotation No: {input.quotationNumber}</Text>
        </View>

        <View style={styles.meta}>
          <Text style={styles.metaRow}>Client: {input.clientName}</Text>
          {input.validUntil && <Text style={styles.metaRow}>Valid until: {input.validUntil}</Text>}
        </View>

        <View style={styles.table}>
          <View style={styles.headerRow}>
            <View style={styles.cell}>
              <Text style={styles.headerCell}>TRADE</Text>
            </View>
            <View style={styles.cell}>
              <Text style={styles.headerCell}>QTY</Text>
            </View>
            <View style={styles.cell}>
              <Text style={styles.headerCell}>RATE</Text>
            </View>
            <View style={styles.cell}>
              <Text style={styles.headerCell}>OT RATE</Text>
            </View>
            <View style={styles.cell}>
              <Text style={styles.headerCell}>AMOUNT</Text>
            </View>
          </View>
          {input.lines.map((l, i) => (
            <View key={i} style={styles.row} wrap={false}>
              <View style={styles.cell}>
                <Text>{l.trade}</Text>
              </View>
              <View style={styles.cell}>
                <Text>{l.quantity}</Text>
              </View>
              <View style={styles.cell}>
                <Text>{l.rate.toFixed(2)}</Text>
              </View>
              <View style={styles.cell}>
                <Text>{l.otRate?.toFixed(2) || "—"}</Text>
              </View>
              <View style={styles.cell}>
                <Text>{(l.quantity * l.rate).toFixed(2)}</Text>
              </View>
            </View>
          ))}
        </View>
        <Text style={{ marginTop: 8, fontSize: 10, fontWeight: 700, textAlign: "right" }}>
          Subtotal: {subtotal.toFixed(2)}
        </Text>

        {(input.accommodationResponsibility || input.transportationResponsibility || input.ppeResponsibility) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Responsibilities</Text>
            {input.accommodationResponsibility && (
              <Text style={styles.paragraph}>Accommodation: {input.accommodationResponsibility}</Text>
            )}
            {input.transportationResponsibility && (
              <Text style={styles.paragraph}>Transportation: {input.transportationResponsibility}</Text>
            )}
            {input.ppeResponsibility && <Text style={styles.paragraph}>PPE: {input.ppeResponsibility}</Text>}
          </View>
        )}

        {input.terms && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Terms</Text>
            <Text style={styles.paragraph}>{input.terms}</Text>
          </View>
        )}
      </Page>
    </Document>
  );

  return renderToBuffer(doc);
}
