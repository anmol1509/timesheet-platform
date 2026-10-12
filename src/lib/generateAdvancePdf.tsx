import { Document, Page, Text, View, Image, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import type { AdvanceDoc } from "@/lib/advanceDoc";
import type { PayslipLayout } from "@/lib/payslipPrint";
import { overlayOnLetterheadPdf } from "@/lib/letterheadOverlay";
import { RichHtml } from "@/lib/richPdf";

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
        <Text>Date: {(doc.given?.date ?? doc.requestedOn).split("-").reverse().join("-")}</Text>
      </View>

      <RichHtml html={doc.bodyHtml} />

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
