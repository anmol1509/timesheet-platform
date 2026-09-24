import ExcelJS from "exceljs";
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { summarise, type ReportRow } from "@/lib/attendanceReport";

export type ReportMeta = { supplier: string; from: string; to: string; statusLabel: string };

/** Excel copy of the report: the rows, then a totals line. */
export async function attendanceReportXlsx(meta: ReportMeta, rows: ReportRow[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Attendance");
  ws.addRow([`Attendance report — ${meta.supplier}`]).font = { bold: true, size: 13 };
  ws.addRow([`${meta.from} to ${meta.to} · ${meta.statusLabel}`]);
  ws.addRow([]);
  const head = ws.addRow(["Employee ID", "Name", "Date", "Status", "Normal hours", "OT hours"]);
  head.font = { bold: true };
  for (const r of rows) ws.addRow([r.code, r.name, r.date, r.status, r.normal, r.ot]);
  const s = summarise(rows);
  ws.addRow([]);
  const total = ws.addRow(["Total", `${s.workers} worker${s.workers === 1 ? "" : "s"}`, `${s.days} day${s.days === 1 ? "" : "s"}`, `${s.present} present · ${s.absent} absent · ${s.leave} leave`, s.normal, s.ot]);
  total.font = { bold: true };
  ws.columns = [{ width: 16 }, { width: 28 }, { width: 12 }, { width: 34 }, { width: 14 }, { width: 10 }];
  return Buffer.from(await wb.xlsx.writeBuffer());
}

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 9, fontFamily: "Helvetica" },
  title: { fontSize: 14, fontWeight: 700, color: "#2563eb" },
  sub: { fontSize: 9, color: "#475569", marginTop: 3, marginBottom: 10 },
  head: { flexDirection: "row", backgroundColor: "#2563eb", padding: 4 },
  row: { flexDirection: "row", padding: 4, borderBottomWidth: 0.5, borderColor: "#E2E8F0" },
  hc: { color: "#FFFFFF", fontWeight: 700, fontSize: 8 },
  total: { flexDirection: "row", padding: 4, marginTop: 4, borderTopWidth: 1, borderColor: "#94A3B8" },
});
const W = { code: 70, name: 150, date: 62, status: 56, n: 56, ot: 40 };

/** PDF copy of the report, paginated. */
export async function attendanceReportPdf(meta: ReportMeta, rows: ReportRow[]): Promise<Buffer> {
  const s = summarise(rows);
  const doc = (
    <Document>
      <Page size="A4" style={styles.page} wrap>
        <Text style={styles.title}>Attendance report</Text>
        <Text style={styles.sub}>{meta.supplier} · {meta.from} to {meta.to} · {meta.statusLabel}</Text>
        <View style={styles.head} fixed>
          <Text style={[styles.hc, { width: W.code }]}>ID</Text><Text style={[styles.hc, { width: W.name }]}>Name</Text><Text style={[styles.hc, { width: W.date }]}>Date</Text>
          <Text style={[styles.hc, { width: W.status }]}>Status</Text><Text style={[styles.hc, { width: W.n, textAlign: "right" }]}>Normal h</Text><Text style={[styles.hc, { width: W.ot, textAlign: "right" }]}>OT h</Text>
        </View>
        {rows.map((r, i) => (
          <View key={i} style={styles.row} wrap={false}>
            <Text style={{ width: W.code }}>{r.code}</Text><Text style={{ width: W.name }}>{r.name}</Text><Text style={{ width: W.date }}>{r.date}</Text>
            <Text style={{ width: W.status }}>{r.status}</Text><Text style={{ width: W.n, textAlign: "right" }}>{r.normal}</Text><Text style={{ width: W.ot, textAlign: "right" }}>{r.ot}</Text>
          </View>
        ))}
        <View style={styles.total}>
          <Text style={{ width: W.code + W.name + W.date, fontWeight: 700 }}>{s.workers} worker{s.workers === 1 ? "" : "s"} · {s.days} day{s.days === 1 ? "" : "s"}</Text>
          <Text style={{ width: W.status }}>{s.present}P {s.absent}A {s.leave}L</Text>
          <Text style={{ width: W.n, textAlign: "right", fontWeight: 700 }}>{s.normal}</Text><Text style={{ width: W.ot, textAlign: "right", fontWeight: 700 }}>{s.ot}</Text>
        </View>
      </Page>
    </Document>
  );
  return renderToBuffer(doc);
}
