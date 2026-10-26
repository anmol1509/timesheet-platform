import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { Letterhead } from "@/lib/letterhead";
import { splitAtWorkerTable } from "@/lib/letterHtml";
import { RichHtml } from "@/lib/richPdf";

export type CheckInPdfRow = {
  slNo: number;
  checkInNo: string;
  employeeName: string;
  employeeCode: string;
  nationality: string | null;
  trade: string | null;
  supplierName: string | null;
  coordinator: string | null;
  status: string;
};

export type CheckInPdfInput = {
  letterhead: Letterhead;
  title: string;
  date: string;
  campName: string;
  /** The template's wording with its merge fields filled; the worker-table marker splits it into before and after. */
  bodyHtml: string;
  rows: CheckInPdfRow[];
};

const NAVY = "#0B1530";
const ACCENT = "#4F3FD8";
const INK = "#1E293B";
const MUTED = "#64748B";
const LINE = "#E2E8F0";

const s = StyleSheet.create({
  page: { paddingTop: 36, paddingBottom: 56, paddingHorizontal: 40, fontSize: 9, fontFamily: "Helvetica", color: INK },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingBottom: 14, borderBottomWidth: 2, borderColor: ACCENT },
  brand: { flexDirection: "row", alignItems: "center", flex: 1 },
  logo: { width: 46, height: 46, objectFit: "contain", marginRight: 12 },
  company: { fontSize: 15, fontFamily: "Helvetica-Bold", color: NAVY },
  contact: { fontSize: 8, color: MUTED, marginTop: 2, lineHeight: 1.4 },
  titleBox: { alignItems: "flex-end" },
  title: { fontSize: 17, fontFamily: "Helvetica-Bold", color: NAVY, letterSpacing: 0.5, textTransform: "uppercase" },
  titleDate: { fontSize: 9, color: MUTED, marginTop: 3 },
  body: { marginTop: 14 },
  table: { marginTop: 12, borderWidth: 0.75, borderColor: LINE, borderRadius: 4 },
  headRow: { flexDirection: "row", backgroundColor: NAVY },
  row: { flexDirection: "row", borderTopWidth: 0.5, borderColor: LINE },
  rowAlt: { backgroundColor: "#F8FAFC" },
  headCell: { fontSize: 7.5, fontFamily: "Helvetica-Bold", color: "#FFFFFF", paddingVertical: 6, paddingHorizontal: 5, textTransform: "uppercase" },
  cell: { fontSize: 8.5, paddingVertical: 5, paddingHorizontal: 5 },
  strong: { fontFamily: "Helvetica-Bold" },
  after: { marginTop: 12 },
  signs: { flexDirection: "row", gap: 18, marginTop: 38 },
  sign: { flex: 1 },
  signLine: { borderTopWidth: 0.75, borderColor: "#94A3B8", paddingTop: 4 },
  signLabel: { fontSize: 8, fontFamily: "Helvetica-Bold", color: INK },
  signHint: { fontSize: 7.5, color: MUTED, marginTop: 1 },
  footer: { position: "absolute", left: 40, right: 40, bottom: 24, flexDirection: "row", justifyContent: "space-between", fontSize: 7.5, color: MUTED, borderTopWidth: 0.5, borderColor: LINE, paddingTop: 6 },
});

const COLS: { key: keyof CheckInPdfRow; label: string; flex: number }[] = [
  { key: "slNo", label: "No.", flex: 0.4 },
  { key: "checkInNo", label: "Check-in no.", flex: 0.95 },
  { key: "employeeName", label: "Employee", flex: 1.7 },
  { key: "employeeCode", label: "Emp code", flex: 0.9 },
  { key: "trade", label: "Trade", flex: 1.2 },
  { key: "nationality", label: "Nationality", flex: 0.9 },
  { key: "supplierName", label: "Company", flex: 1.5 },
  { key: "coordinator", label: "Coordinator", flex: 1.2 },
  { key: "status", label: "Status", flex: 0.95 },
];

const statusColor = (status: string) => (/out/i.test(status) ? "#B42318" : /bed|allocated/i.test(status) ? "#146C43" : "#2A4AA8");

export async function generateCheckInPdf(input: CheckInPdfInput): Promise<Buffer> {
  const { letterhead: lh } = input;
  const { before, after, hasTable } = splitAtWorkerTable(input.bodyHtml);
  const contact = [lh.phone && `Tel ${lh.phone}`, lh.email, lh.poBox && `P.O. Box ${lh.poBox}`, lh.trn && `TRN ${lh.trn}`].filter(Boolean).join("   ·   ");
  const doc = (
    <Document title={`${input.title} - ${input.campName}`}>
      <Page size="A4" orientation="landscape" style={s.page}>
        <View style={s.header}>
          <View style={s.brand}>
            {lh.logo && (
              // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt prop
              <Image src={lh.logo} style={s.logo} />
            )}
            <View>
              <Text style={s.company}>{lh.name}</Text>
              {lh.addressLines.length > 0 && <Text style={s.contact}>{lh.addressLines.join(", ")}</Text>}
              {contact && <Text style={s.contact}>{contact}</Text>}
            </View>
          </View>
          <View style={s.titleBox}>
            <Text style={s.title}>{input.title}</Text>
            <Text style={s.titleDate}>{input.date}</Text>
          </View>
        </View>

        <View style={s.body}>
          <RichHtml html={before} baseSize={9.5} />
        </View>

        <View style={s.table}>
          <View style={s.headRow} fixed>
            {COLS.map((c) => (
              <Text key={c.key} style={[s.headCell, { flex: c.flex }]}>
                {c.label}
              </Text>
            ))}
          </View>
          {input.rows.map((r, i) => (
            <View key={r.checkInNo} style={[s.row, i % 2 ? s.rowAlt : {}]} wrap={false}>
              {COLS.map((c) => (
                <Text
                  key={c.key}
                  style={[s.cell, { flex: c.flex }, c.key === "employeeName" ? s.strong : {}, c.key === "status" ? { color: statusColor(r.status), fontFamily: "Helvetica-Bold" } : {}]}
                >
                  {c.key === "slNo" ? String(r.slNo) : (r[c.key] as string | null) || "—"}
                </Text>
              ))}
            </View>
          ))}
        </View>

        {hasTable && after.trim() && (
          <View style={s.after}>
            <RichHtml html={after} baseSize={9.5} />
          </View>
        )}

        <View style={s.signs} wrap={false}>
          {[
            ["Prepared by", "Name, signature and date"],
            ["Camp manager", "Name, signature and date"],
            ["Received by", "Name, signature and date"],
          ].map(([label, hint]) => (
            <View key={label} style={s.sign}>
              <View style={s.signLine}>
                <Text style={s.signLabel}>{label}</Text>
                <Text style={s.signHint}>{hint}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={s.footer} fixed>
          <Text>
            {lh.name} · {input.campName}
          </Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );

  return renderToBuffer(doc);
}
