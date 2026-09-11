import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";

export type CheckInPdfRow = {
  slNo: number;
  checkInNo: string;
  employeeName: string;
  nationality: string | null;
  supplierName: string | null;
  coordinator: string | null;
  status: string;
};

export type CheckInPdfInput = {
  branchName: string;
  branchAddress: string | null;
  campName: string;
  campType: string;
  date: string;
  rows: CheckInPdfRow[];
};

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica" },
  letterhead: { marginBottom: 16, borderBottomWidth: 1, borderColor: "#2563eb", paddingBottom: 10 },
  companyName: { fontSize: 16, fontWeight: 700, color: "#2563eb" },
  companyAddress: { fontSize: 8, color: "#475569", marginTop: 2 },
  title: { fontSize: 12, fontWeight: 700, color: "#0F172A", marginTop: 8, textAlign: "center" },
  meta: { marginBottom: 12 },
  metaRow: { flexDirection: "row", fontSize: 9, marginBottom: 2 },
  metaLabel: { width: 90, color: "#475569", fontWeight: 700 },
  metaValue: { color: "#0F172A" },
  table: { display: "flex", flexDirection: "column", borderWidth: 0.5, borderColor: "#94A3B8", marginTop: 8 },
  headerRow: { flexDirection: "row", backgroundColor: "#2563eb" },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderColor: "#E2E8F0" },
  headerCell: { fontSize: 8, fontWeight: 700, color: "#FFFFFF", padding: 5 },
  cell: { fontSize: 8.5, padding: 5, color: "#1E293B" },
});

const COLS = [
  { key: "slNo", label: "Sl.No", flex: 0.5 },
  { key: "checkInNo", label: "Check-In No", flex: 1 },
  { key: "employeeName", label: "Employee Name", flex: 1.8 },
  { key: "nationality", label: "Nationality", flex: 1 },
  { key: "supplierName", label: "Supplier", flex: 1.8 },
  { key: "coordinator", label: "Coordinator", flex: 1.6 },
  { key: "status", label: "Status", flex: 1 },
] as const;

export async function generateCheckInPdf(input: CheckInPdfInput): Promise<Buffer> {
  const doc = (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.letterhead}>
          <Text style={styles.companyName}>{input.branchName}</Text>
          {input.branchAddress && <Text style={styles.companyAddress}>{input.branchAddress}</Text>}
          <Text style={styles.title}>CHECK-IN LIST</Text>
        </View>

        <View style={styles.meta}>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Date</Text>
            <Text style={styles.metaValue}>: {input.date}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Camp</Text>
            <Text style={styles.metaValue}>: {input.campName}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Camp Type</Text>
            <Text style={styles.metaValue}>: {input.campType}</Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.headerRow} fixed>
            {COLS.map((c) => (
              <Text key={c.key} style={[styles.headerCell, { flex: c.flex }]}>
                {c.label}
              </Text>
            ))}
          </View>
          {input.rows.map((r) => (
            <View key={r.checkInNo} style={styles.row} wrap={false}>
              <Text style={[styles.cell, { flex: 0.5 }]}>{r.slNo}</Text>
              <Text style={[styles.cell, { flex: 1 }]}>{r.checkInNo}</Text>
              <Text style={[styles.cell, { flex: 1.8 }]}>{r.employeeName}</Text>
              <Text style={[styles.cell, { flex: 1 }]}>{r.nationality || "—"}</Text>
              <Text style={[styles.cell, { flex: 1.8 }]}>{r.supplierName || "—"}</Text>
              <Text style={[styles.cell, { flex: 1.6 }]}>{r.coordinator || "—"}</Text>
              <Text style={[styles.cell, { flex: 1 }]}>{r.status}</Text>
            </View>
          ))}
        </View>
      </Page>
    </Document>
  );

  return renderToBuffer(doc);
}
