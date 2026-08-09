import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { NOC_DISPLAY_FIELDS } from "@/lib/nocDisplayFields";

export type NocPdfEmployee = {
  employeeIdNo: string;
  name: string;
  passportNumber: string | null;
  nationality: string | null;
  trade: string | null;
  emiratesId: string | null;
  visaStatus: string | null;
};

export type NocPdfInput = {
  branchName: string;
  branchAddress: string | null;
  docNo: number;
  bodyText: string;
  displayFields: string[];
  employees: NocPdfEmployee[];
};

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica" },
  letterhead: { marginBottom: 24, borderBottomWidth: 1, borderColor: "#2563eb", paddingBottom: 10 },
  companyName: { fontSize: 16, fontWeight: 700, color: "#2563eb" },
  companyAddress: { fontSize: 8, color: "#475569", marginTop: 2 },
  docNo: { fontSize: 8, color: "#475569", marginTop: 6 },
  paragraph: { marginBottom: 8, lineHeight: 1.5 },
  table: { display: "flex", flexDirection: "column", borderWidth: 0.5, borderColor: "#94A3B8", marginTop: 16 },
  headerRow: { flexDirection: "row", backgroundColor: "#2563eb" },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderColor: "#E2E8F0" },
  cell: { flex: 1, padding: 5, justifyContent: "center" },
  headerCell: { fontSize: 8, fontWeight: 700, color: "#FFFFFF" },
});

export async function generateNocLetterPdf(input: NocPdfInput): Promise<Buffer> {
  const columns = NOC_DISPLAY_FIELDS.filter((f) => input.displayFields.includes(f.key));
  const paragraphs = input.bodyText.split(/\n+/).filter((p) => p.trim().length > 0);

  const doc = (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.letterhead}>
          <Text style={styles.companyName}>{input.branchName}</Text>
          {input.branchAddress && <Text style={styles.companyAddress}>{input.branchAddress}</Text>}
          <Text style={styles.docNo}>Doc No: NOC-{input.docNo}</Text>
        </View>

        {paragraphs.map((p, i) => (
          <Text key={i} style={styles.paragraph}>
            {p}
          </Text>
        ))}

        {columns.length > 0 && input.employees.length > 0 && (
          <View style={styles.table}>
            <View style={styles.headerRow}>
              {columns.map((c) => (
                <View key={c.key} style={styles.cell}>
                  <Text style={styles.headerCell}>{c.label.toUpperCase()}</Text>
                </View>
              ))}
            </View>
            {input.employees.map((e, i) => (
              <View key={i} style={styles.row} wrap={false}>
                {columns.map((c) => (
                  <View key={c.key} style={styles.cell}>
                    <Text>{c.resolve(e)}</Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        )}
      </Page>
    </Document>
  );

  return renderToBuffer(doc);
}
