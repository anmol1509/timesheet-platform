import { Document, Page, Text, View, Image, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import ExcelJS from "exceljs";
import type { Letterhead } from "@/lib/letterhead";

/**
 * One working-hours sheet for whichever employees were picked: a row per person,
 * a column per calendar day and a total. Supplier, project and client are optional
 * columns the person asks for, so the same sheet serves a quick hours check and a
 * report that has to show who each worker belongs to.
 */
export type HoursRow = {
  employeeIdNo: string;
  name: string;
  trade: string | null;
  supplier: string;
  project: string | null;
  client: string | null;
  /** One entry per calendar day of the month, in order: a number as text, or a marker like A / OFF / H. */
  days: string[];
};

export type HoursShow = { supplier: boolean; project: boolean; client: boolean };

export type HoursReportInput = {
  letterhead: Letterhead;
  monthLabel: string;
  dayCount: number;
  rows: HoursRow[];
  show: HoursShow;
  /** Sort and band the rows by supplier, with a subtotal under each. */
  groupBySupplier: boolean;
  preparedBy: string | null;
};

const NAVY = "#2B3187";
const LINE = "#000000";
const s = StyleSheet.create({
  page: { paddingTop: 18, paddingBottom: 28, paddingHorizontal: 16, fontSize: 6.5, fontFamily: "Helvetica", color: "#000" },
  headBand: { flexDirection: "row", alignItems: "center", marginBottom: 5 },
  logo: { width: 60, height: 44, objectFit: "contain" },
  companyBlock: { flex: 1, paddingHorizontal: 8 },
  companyName: { fontSize: 11, fontFamily: "Helvetica-Bold", color: NAVY },
  rule: { height: 1.4, backgroundColor: NAVY, marginBottom: 5 },
  title: { fontSize: 9, fontFamily: "Helvetica-Bold", textAlign: "center", marginBottom: 5 },
  table: { borderWidth: 0.6, borderColor: LINE },
  row: { flexDirection: "row", borderBottomWidth: 0.4, borderColor: LINE },
  cell: { borderRightWidth: 0.4, borderColor: LINE, paddingVertical: 1.8, paddingHorizontal: 1.5, justifyContent: "center" },
  th: { fontSize: 5.6, fontFamily: "Helvetica-Bold", textAlign: "center" },
  td: { fontSize: 6, textAlign: "center" },
  tdLeft: { fontSize: 6, textAlign: "left" },
  absent: { backgroundColor: "#F7A23B" },
  band: { flexDirection: "row", backgroundColor: "#E8EAF6", borderBottomWidth: 0.4, borderColor: LINE },
  bandText: { fontSize: 6.5, fontFamily: "Helvetica-Bold", paddingVertical: 2, paddingLeft: 3 },
  footer: { position: "absolute", bottom: 12, left: 0, right: 0, textAlign: "center", fontSize: 7 },
});

const num = (v: string) => { const n = Number(v); return v !== "" && !Number.isNaN(n) ? n : 0; };
const marker = (v: string) => { const t = String(v).trim().toUpperCase(); return t === "OFF" || t === "WO" ? "W" : v; };
const fmt = (n: number) => n.toLocaleString("en-AE", { maximumFractionDigits: 2 });
const totalOf = (r: HoursRow) => r.days.reduce((a, d) => a + num(d), 0);

function ordered(input: HoursReportInput) {
  const rows = [...input.rows];
  rows.sort((a, b) => (input.groupBySupplier ? a.supplier.localeCompare(b.supplier) : 0) || a.name.localeCompare(b.name));
  return rows;
}

export async function generateHoursReportPdf(input: HoursReportInput): Promise<Buffer> {
  const rows = ordered(input);
  const { show, dayCount } = input;
  const W = { sn: 16, id: 62, name: 92, trade: 48, supplier: 98, project: 52, client: 86, total: 30 };
  const fixed = W.sn + W.id + W.name + W.trade + W.total + (show.supplier ? W.supplier : 0) + (show.project ? W.project : 0) + (show.client ? W.client : 0);
  const dayW = Math.max(11, Math.floor((810 - fixed) / dayCount));
  const days = Array.from({ length: dayCount }, (_, i) => i + 1);
  const fixedCols = (r: HoursRow | null, n: number) => [
    <View key="sn" style={[s.cell, { width: W.sn }]}><Text style={s.td}>{r ? n : "#"}</Text></View>,
    <View key="id" style={[s.cell, { width: W.id }]}><Text style={r ? s.td : s.th}>{r ? r.employeeIdNo : "ID"}</Text></View>,
    <View key="nm" style={[s.cell, { width: W.name }]}><Text style={r ? s.tdLeft : s.th}>{r ? r.name : "Employee"}</Text></View>,
    <View key="tr" style={[s.cell, { width: W.trade }]}><Text style={r ? s.tdLeft : s.th}>{r ? r.trade ?? "" : "Trade"}</Text></View>,
    ...(show.supplier ? [<View key="su" style={[s.cell, { width: W.supplier }]}><Text style={r ? s.tdLeft : s.th}>{r ? r.supplier : "Supplier"}</Text></View>] : []),
    ...(show.project ? [<View key="pr" style={[s.cell, { width: W.project }]}><Text style={r ? s.tdLeft : s.th}>{r ? r.project ?? "" : "Project"}</Text></View>] : []),
    ...(show.client ? [<View key="cl" style={[s.cell, { width: W.client }]}><Text style={r ? s.tdLeft : s.th}>{r ? r.client ?? "" : "Client"}</Text></View>] : []),
  ];
  const Header = () => (
    <View style={[s.row, { backgroundColor: "#E8EAF6" }]} fixed>
      {fixedCols(null, 0)}
      {days.map((d) => <View key={d} style={[s.cell, { width: dayW }]}><Text style={s.th}>{d}</Text></View>)}
      <View style={[s.cell, { width: W.total, borderRightWidth: 0 }]}><Text style={s.th}>Total</Text></View>
    </View>
  );

  const body: React.ReactNode[] = [];
  let n = 0;
  let current = "";
  let subtotal = 0;
  const flushSub = (key: string) => {
    if (input.groupBySupplier && current) {
      body.push(
        <View key={`sub-${key}`} style={s.row} wrap={false}>
          <View style={{ flex: 1 }}><Text style={[s.bandText, { textAlign: "right", paddingRight: 4 }]}>Subtotal — {current}</Text></View>
          <View style={[s.cell, { width: W.total, borderRightWidth: 0 }]}><Text style={[s.td, { fontFamily: "Helvetica-Bold" }]}>{fmt(subtotal)}</Text></View>
        </View>
      );
    }
    subtotal = 0;
  };
  for (const r of rows) {
    if (input.groupBySupplier && r.supplier !== current) {
      flushSub(current);
      current = r.supplier;
      body.push(<View key={`band-${r.supplier}`} style={s.band} wrap={false}><Text style={s.bandText}>{r.supplier}</Text></View>);
    }
    n += 1;
    const t = totalOf(r);
    subtotal += t;
    body.push(
      <View key={`${r.employeeIdNo}-${n}`} style={s.row} wrap={false}>
        {fixedCols(r, n)}
        {days.map((d) => {
          const v = r.days[d - 1] ?? "";
          const isAbsent = String(v).trim().toUpperCase() === "A";
          return <View key={d} style={[s.cell, { width: dayW }, isAbsent ? s.absent : {}]}><Text style={s.td}>{marker(v)}</Text></View>;
        })}
        <View style={[s.cell, { width: W.total, borderRightWidth: 0 }]}><Text style={[s.td, { fontFamily: "Helvetica-Bold" }]}>{fmt(t)}</Text></View>
      </View>
    );
  }
  flushSub(current);
  const grand = rows.reduce((a, r) => a + totalOf(r), 0);

  const doc = (
    <Document title={`Working hours — ${input.monthLabel}`}>
      <Page size="A4" orientation="landscape" style={s.page}>
        <View fixed>
          <View style={s.headBand}>
            {input.letterhead.logo ? (
              // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt
              <Image src={input.letterhead.logo} style={s.logo} />
            ) : (
              <View style={s.logo} />
            )}
            <View style={s.companyBlock}>
              <Text style={s.companyName}>{input.letterhead.name.toUpperCase()}</Text>
              {input.letterhead.addressLines.map((line, i) => <Text key={i} style={{ fontSize: 6.5 }}>{line}</Text>)}
            </View>
          </View>
          <View style={s.rule} />
          <Text style={s.title}>WORKING HOURS — {input.monthLabel.toUpperCase()}</Text>
        </View>
        <View style={s.table}>
          <Header />
          {body}
          <View style={[s.row, { backgroundColor: "#E8EAF6", borderBottomWidth: 0 }]} wrap={false}>
            <View style={{ flex: 1 }}><Text style={[s.bandText, { textAlign: "right", paddingRight: 4 }]}>Total — {rows.length} employee{rows.length === 1 ? "" : "s"}</Text></View>
            <View style={[s.cell, { width: W.total, borderRightWidth: 0 }]}><Text style={[s.td, { fontFamily: "Helvetica-Bold" }]}>{fmt(grand)}</Text></View>
          </View>
        </View>
        <Text style={s.footer} render={({ pageNumber, totalPages }) => `${input.preparedBy ? `Prepared by ${input.preparedBy} · ` : ""}Page ${pageNumber} of ${totalPages}`} fixed />
      </Page>
    </Document>
  );
  return renderToBuffer(doc);
}

export async function generateHoursReportXlsx(input: HoursReportInput): Promise<Buffer> {
  const rows = ordered(input);
  const { show, dayCount } = input;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(`Hours ${input.monthLabel}`.slice(0, 31));
  const head = ["#", "ID", "Employee", "Trade", ...(show.supplier ? ["Supplier"] : []), ...(show.project ? ["Project"] : []), ...(show.client ? ["Client"] : []), ...Array.from({ length: dayCount }, (_, i) => String(i + 1)), "Total"];
  ws.addRow(head).font = { bold: true };
  rows.forEach((r, i) => {
    ws.addRow([i + 1, r.employeeIdNo, r.name, r.trade ?? "", ...(show.supplier ? [r.supplier] : []), ...(show.project ? [r.project ?? ""] : []), ...(show.client ? [r.client ?? ""] : []), ...Array.from({ length: dayCount }, (_, d) => { const v = r.days[d] ?? ""; return v !== "" && !Number.isNaN(Number(v)) ? Number(v) : marker(v); }), totalOf(r)]);
  });
  ws.addRow([]);
  const t = ws.addRow(["", "", `Total — ${rows.length} employees`]);
  t.getCell(head.length).value = rows.reduce((a, r) => a + totalOf(r), 0);
  t.font = { bold: true };
  ws.views = [{ state: "frozen", xSplit: 3, ySplit: 1 }];
  return Buffer.from(await wb.xlsx.writeBuffer());
}
