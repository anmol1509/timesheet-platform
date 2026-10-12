import { Document, Page, Text, View, Image, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import type { PayslipDoc } from "@/lib/payslipData";
import type { PayslipLayout } from "@/lib/payslipPrint";
import { overlayOnLetterheadPdf } from "@/lib/letterheadOverlay";

const MM = 72 / 25.4; // millimetres to points

const INK = "#0f172a";
const MUTED = "#64748b";
const LINE = "#e2e8f0";
const s = StyleSheet.create({
  page: { padding: 36, fontSize: 9.5, color: INK, fontFamily: "Helvetica" },
  head: { flexDirection: "row", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: LINE, paddingBottom: 10, marginBottom: 12 },
  company: { fontSize: 13, fontFamily: "Helvetica-Bold" },
  small: { fontSize: 8, color: MUTED, marginTop: 2 },
  title: { fontSize: 13, fontFamily: "Helvetica-Bold", textAlign: "right" },
  meta: { flexDirection: "row", flexWrap: "wrap", marginBottom: 12 },
  metaItem: { width: "50%", flexDirection: "row", paddingVertical: 2 },
  metaKey: { width: 70, color: MUTED },
  cols: { flexDirection: "row", gap: 14 },
  col: { flex: 1 },
  colHead: { fontFamily: "Helvetica-Bold", paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: INK, flexDirection: "row", justifyContent: "space-between" },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, borderBottomWidth: 0.5, borderBottomColor: LINE },
  note: { color: MUTED, fontSize: 8 },
  total: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5, fontFamily: "Helvetica-Bold" },
  net: { flexDirection: "row", justifyContent: "space-between", backgroundColor: "#f1f5f9", padding: 9, marginTop: 12, fontFamily: "Helvetica-Bold", fontSize: 12 },
  ytd: { marginTop: 14, borderTopWidth: 1, borderTopColor: LINE, paddingTop: 8 },
  background: { position: "absolute", top: 0, left: 0, width: 595.28, height: 841.89 },
  foot: { position: "absolute", bottom: 24, left: 36, right: 36, textAlign: "center", fontSize: 7.5, color: MUTED },
});
const aed = (n: number) => n.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function monthName(m: string) {
  return new Date(`${m}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
}

function PayslipPage({ doc, i, layout }: { doc: PayslipDoc; i: number; layout?: PayslipLayout }) {
  const { slip, ytd, employee } = doc.slips[i];
  const h = doc.letterhead;
  const contact = [h.phone && `Tel ${h.phone}`, h.email, h.poBox && `P.O. Box ${h.poBox}`, h.trn && `TRN ${h.trn}`].filter(Boolean).join("  ·  ");
  return (
    <Page size="A4" style={layout?.onLetterhead ? [s.page, { paddingTop: layout.topMm * MM, paddingBottom: layout.bottomMm * MM }] : s.page}>
      {layout?.onLetterhead && layout.letterheadImage && <Image src={layout.letterheadImage} style={s.background} fixed />}
      {/* On a letterhead the company's own header is already printed, so only the title and month are drawn. */}
      <View style={s.head}>
        {layout?.onLetterhead ? <View /> : (
          <View style={{ flexDirection: "row", gap: 10 }}>
            {h.logo && <Image src={h.logo} style={{ width: 42, height: 42, objectFit: "contain" }} />}
            <View>
              <Text style={s.company}>{h.name}</Text>
              {h.addressLines.length > 0 && <Text style={s.small}>{h.addressLines.join(", ")}</Text>}
              {contact !== "" && <Text style={s.small}>{contact}</Text>}
            </View>
          </View>
        )}
        <View>
          <Text style={s.title}>PAYSLIP</Text>
          <Text style={[s.small, { textAlign: "right" }]}>{monthName(doc.month)}</Text>
        </View>
      </View>

      <View style={s.meta}>
        <View style={s.metaItem}><Text style={s.metaKey}>Employee</Text><Text>{employee.name}</Text></View>
        <View style={s.metaItem}><Text style={s.metaKey}>ID</Text><Text>{employee.idNo}</Text></View>
        <View style={s.metaItem}><Text style={s.metaKey}>{employee.department ? "Designation" : "Trade"}</Text><Text>{employee.role}</Text></View>
        <View style={s.metaItem}><Text style={s.metaKey}>{employee.department ? "Department" : "Paid by"}</Text><Text>{employee.department ?? doc.slips[i].paidBy}</Text></View>
      </View>

      <View style={s.cols}>
        <View style={s.col}>
          <View style={s.colHead}><Text>Earnings</Text><Text>AED</Text></View>
          {slip.earnings.map((r, k) => (
            <View key={k} style={s.row}><View><Text>{r.label}</Text>{r.note && <Text style={s.note}>{r.note}</Text>}</View><Text>{aed(r.amount)}</Text></View>
          ))}
          <View style={s.total}><Text>Total earnings</Text><Text>{aed(slip.gross)}</Text></View>
        </View>
        <View style={s.col}>
          <View style={s.colHead}><Text>Deductions</Text><Text>AED</Text></View>
          {slip.deductions.length === 0 && <View style={s.row}><Text style={s.note}>None this month</Text><Text>—</Text></View>}
          {slip.deductions.map((r, k) => (
            <View key={k} style={s.row}><View><Text>{r.label}</Text>{r.note && <Text style={s.note}>{r.note}</Text>}</View><Text>{aed(r.amount)}</Text></View>
          ))}
          <View style={s.total}><Text>Total deductions</Text><Text>{aed(slip.totalDeductions)}</Text></View>
        </View>
      </View>

      <View style={s.net}><Text>Net pay (AED)</Text><Text>{aed(slip.net)}</Text></View>

      {ytd.months > 0 && (
        <View style={s.ytd}>
          <Text style={{ fontFamily: "Helvetica-Bold", marginBottom: 3 }}>Year to date ({ytd.months} month{ytd.months === 1 ? "" : "s"} of {doc.month.slice(0, 4)})</Text>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text>Earnings {aed(ytd.gross)}</Text><Text>Deductions {aed(ytd.deductions)}</Text><Text>Net pay {aed(ytd.net)}</Text>
          </View>
        </View>
      )}
      {layout && (layout.signatureImage || layout.stampImage) ? (
        <View wrap={false} style={{ marginTop: 22, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" }}>
          <View>
            <Text>For and on behalf of</Text>
            <Text style={{ fontFamily: "Helvetica-Bold" }}>{h.name}</Text>
            {layout.signatureImage ? <Image src={layout.signatureImage} style={{ width: 120, height: 44, objectFit: "contain", marginTop: 6, marginBottom: 2 }} /> : <View style={{ height: 30 }} />}
            <Text style={{ fontFamily: "Helvetica-Bold" }}>{layout.signatoryName || "Authorised Signatory"}</Text>
            {layout.signatoryTitle && <Text>{layout.signatoryTitle}</Text>}
          </View>
          {layout.stampImage && <Image src={layout.stampImage} style={{ width: 92, height: 92, objectFit: "contain" }} />}
        </View>
      ) : <Text style={s.foot}>Computer-generated payslip. No signature required.</Text>}
    </Page>
  );
}

export async function generatePayslipPdf(doc: PayslipDoc, layout?: PayslipLayout): Promise<Buffer | Uint8Array> {
  const pdf = await renderToBuffer(<Document title={`Payslips ${doc.month}`}>{doc.slips.map((_, i) => <PayslipPage key={doc.slips[i].lineId} doc={doc} i={i} layout={layout} />)}</Document>);
  // A letterhead kept as a PDF is laid under the finished pages rather than drawn as an image.
  if (layout?.onLetterhead && layout.letterheadPdf && !layout.letterheadImage) return overlayOnLetterheadPdf(pdf, layout.letterheadPdf);
  return pdf;
}
