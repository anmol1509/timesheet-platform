import { Document, Page, Text, View, Image, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import type { AdvanceDoc } from "@/lib/advanceDoc";
import type { PayslipLayout } from "@/lib/payslipPrint";
import { methodLabel } from "@/lib/advances";
import { overlayOnLetterheadPdf } from "@/lib/letterheadOverlay";

const MM = 72 / 25.4;
const INK = "#0f172a";
const MUTED = "#64748b";
const LINE = "#e2e8f0";
const s = StyleSheet.create({
  page: { padding: 40, fontSize: 10, color: INK, fontFamily: "Helvetica" },
  background: { position: "absolute", top: 0, left: 0, width: 595.28, height: 841.89 },
  head: { flexDirection: "row", gap: 10, borderBottomWidth: 1, borderBottomColor: LINE, paddingBottom: 10, marginBottom: 14 },
  company: { fontSize: 13, fontFamily: "Helvetica-Bold" },
  small: { fontSize: 8, color: MUTED, marginTop: 2 },
  title: { fontSize: 14, fontFamily: "Helvetica-Bold", textAlign: "center", textDecoration: "underline", marginBottom: 10 },
  meta: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
  grid: { flexDirection: "row", flexWrap: "wrap", marginBottom: 10 },
  cell: { width: "50%", flexDirection: "row", paddingVertical: 3 },
  key: { width: 82, color: MUTED },
  amount: { backgroundColor: "#f1f5f9", padding: 10, marginBottom: 12 },
  h2: { fontFamily: "Helvetica-Bold", marginBottom: 4, marginTop: 6 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3, borderBottomWidth: 0.5, borderBottomColor: LINE },
  para: { lineHeight: 1.25, marginTop: 8 },
  sigs: { flexDirection: "row", gap: 16, marginTop: 26 },
  sig: { flex: 1 },
  sigLine: { borderBottomWidth: 1, borderBottomColor: INK, height: 34 },
  foot: { position: "absolute", bottom: 24, left: 40, right: 40, textAlign: "center", fontSize: 7.5, color: MUTED },
});
const aed = (v: number) => v.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function AdvancePage({ doc, layout }: { doc: AdvanceDoc; layout?: PayslipLayout }) {
  const h = doc.letterhead;
  const onLetterhead = !!layout?.onLetterhead;
  const contact = [h.phone && `Tel ${h.phone}`, h.email, h.poBox && `P.O. Box ${h.poBox}`, h.trn && `TRN ${h.trn}`].filter(Boolean).join("  ·  ");
  const decided = doc.approval.status === "APPROVED";
  return (
    <Page size="A4" style={onLetterhead ? [s.page, { paddingTop: layout!.topMm * MM, paddingBottom: layout!.bottomMm * MM }] : s.page}>
      {onLetterhead && layout!.letterheadImage && <Image src={layout!.letterheadImage} style={s.background} fixed />}
      {!onLetterhead && (
        <View style={s.head}>
          {h.logo && <Image src={h.logo} style={{ width: 42, height: 42, objectFit: "contain" }} />}
          <View>
            <Text style={s.company}>{h.name}</Text>
            {h.addressLines.length > 0 && <Text style={s.small}>{h.addressLines.join(", ")}</Text>}
            {contact !== "" && <Text style={s.small}>{contact}</Text>}
          </View>
        </View>
      )}
      <Text style={s.title}>{doc.title}</Text>
      <View style={s.meta}>
        <Text>Ref: {doc.ref}</Text>
        <Text>Date: {doc.given?.date ?? doc.requestedOn}</Text>
      </View>

      <View style={s.grid}>
        <View style={s.cell}><Text style={s.key}>Employee</Text><Text>{doc.employee.name}</Text></View>
        <View style={s.cell}><Text style={s.key}>Employee ID</Text><Text>{doc.employee.idNo}</Text></View>
        {doc.employee.trade && <View style={s.cell}><Text style={s.key}>Trade</Text><Text>{doc.employee.trade}</Text></View>}
        <View style={s.cell}><Text style={s.key}>Type</Text><Text>{doc.kind}</Text></View>
        <View style={s.cell}><Text style={s.key}>Requested</Text><Text>{doc.requestedOn} by {doc.requestedBy}</Text></View>
        {doc.reason && <View style={s.cell}><Text style={s.key}>Reason</Text><Text style={{ flex: 1 }}>{doc.reason}</Text></View>}
      </View>

      <View style={s.amount}>
        <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 13 }}>AED {aed(doc.amount)}</Text>
        <Text style={{ color: MUTED, marginTop: 2 }}>{doc.words}</Text>
      </View>

      <View style={s.grid}>
        <View style={s.cell}>
          <Text style={s.key}>Approval</Text>
          <Text>{decided ? `Approved${doc.approval.by ? ` by ${doc.approval.by}` : ""}${doc.approval.on ? ` on ${doc.approval.on}` : ""}` : doc.approval.status === "REJECTED" ? `Not approved${doc.approval.note ? `: ${doc.approval.note}` : ""}` : "Awaiting approval"}</Text>
        </View>
        <View style={s.cell}>
          <Text style={s.key}>Handed over</Text>
          <Text>{doc.given ? `${doc.given.date}, ${methodLabel(doc.given.method).toLowerCase()}${doc.given.reference ? `, ref ${doc.given.reference}` : ""}` : "Not yet"}</Text>
        </View>
      </View>

      <Text style={s.h2}>How it is deducted from salary</Text>
      {doc.plan.map((r) => (
        <View key={r.month} style={s.row}><Text>{r.month}</Text><Text>AED {aed(r.amount)}</Text></View>
      ))}
      {doc.planNote && <Text style={[s.small, { marginTop: 4 }]}>{doc.planNote}</Text>}
      {doc.recovered.length > 0 && (
        <>
          <Text style={s.h2}>Already deducted</Text>
          {doc.recovered.map((r) => <View key={r.month} style={s.row}><Text>{r.month}</Text><Text>AED {aed(r.amount)}</Text></View>)}
          <View style={s.row}><Text style={{ fontFamily: "Helvetica-Bold" }}>Balance still to deduct</Text><Text style={{ fontFamily: "Helvetica-Bold" }}>AED {aed(doc.balance)}</Text></View>
        </>
      )}

      <Text style={s.para}>
        {doc.given
          ? `I, ${doc.employee.name}, acknowledge that I received AED ${aed(doc.amount)} (${doc.words.replace(/ only$/, "")}) on ${doc.given.date} as ${doc.kind === "Loan" ? "a loan" : "an advance"} against my salary, and I authorise ${h.name} to deduct it from my salary as set out above.`
          : `I, ${doc.employee.name}, request ${doc.kind === "Loan" ? "a loan" : "an advance"} of AED ${aed(doc.amount)} against my salary, and I authorise ${h.name} to deduct it from my salary as set out above.`}
      </Text>

      <View style={s.sigs} wrap={false}>
        <View style={s.sig}><View style={s.sigLine} /><Text style={s.small}>Employee: {doc.employee.name}</Text><Text style={s.small}>Date:</Text></View>
        <View style={s.sig}>
          <View style={s.sigLine}>{layout?.signatureImage && <Image src={layout.signatureImage} style={{ width: 100, height: 34, objectFit: "contain" }} />}</View>
          <Text style={s.small}>For {h.name}: {layout?.signatoryName || "Authorised signatory"}{layout?.signatoryTitle ? `, ${layout.signatoryTitle}` : ""}</Text>
          {doc.approval.by && decided && <Text style={s.small}>Approved by {doc.approval.by}</Text>}
        </View>
        {layout?.stampImage && <Image src={layout.stampImage} style={{ width: 80, height: 80, objectFit: "contain" }} />}
      </View>
      <Text style={s.foot}>{doc.ref} · {doc.given ? "Receipt" : "Request"} · generated from the payroll records</Text>
    </Page>
  );
}

export async function generateAdvancePdf(doc: AdvanceDoc, layout?: PayslipLayout): Promise<Buffer | Uint8Array> {
  const pdf = await renderToBuffer(<Document title={`${doc.title} ${doc.ref}`}><AdvancePage doc={doc} layout={layout} /></Document>);
  if (layout?.onLetterhead && layout.letterheadPdf && !layout.letterheadImage) return overlayOnLetterheadPdf(pdf, layout.letterheadPdf);
  return pdf;
}
