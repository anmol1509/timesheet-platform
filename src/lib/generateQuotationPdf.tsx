import { Document, Image, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import type { Letterhead } from "@/lib/letterhead";
import { conversionNote, monthlyEach, monthlyTotal, quoteTotals, unitWord, type Adjustment, type PricedLine, type QuoteSettings } from "@/lib/quotationMath";

export type QuotationPdfLine = PricedLine & {
  trade: string;
  otRate: number | null;
  nationality: string | null;
  workingHours: string | null;
};

export type QuotationPdfInput = {
  letterhead: Letterhead;
  /** Full-page artwork to print on. Null prints the company name and address at the top instead. */
  artwork: string | null;
  topMm: number;
  bottomMm: number;
  signature: string | null;
  stamp: string | null;
  signatoryName: string | null;
  signatoryTitle: string | null;
  quotationNumber: string;
  version: number;
  date: string;
  clientName: string;
  contactName: string | null;
  validUntil: string | null;
  currency: string;
  terms: string | null;
  accommodationResponsibility: string | null;
  transportationResponsibility: string | null;
  ppeResponsibility: string | null;
  lines: QuotationPdfLine[];
  adjustments: Adjustment[];
  settings: QuoteSettings;
  options: { layout: "STANDARD" | "COMPACT"; showTerms: boolean; showOt: boolean };
  /** Opening and closing paragraphs from a saved cover text, already filled in. */
  intro: string | null;
  closing: string | null;
};

const MM = 2.8346;
const money = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const s = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica", color: "#0F172A" },
  background: { position: "absolute", top: 0, left: 0, width: "100%", height: "100%" },
  name: { fontSize: 16, fontWeight: 700, color: "#2563eb" },
  addr: { fontSize: 8, color: "#475569", marginTop: 2 },
  title: { fontSize: 15, fontWeight: 700, marginTop: 14 },
  meta: { marginTop: 8, marginBottom: 10 },
  metaRow: { fontSize: 9, marginBottom: 2, color: "#334155" },
  para: { marginBottom: 6, lineHeight: 1.5, color: "#334155" },
  table: { marginTop: 8, borderWidth: 0.5, borderColor: "#94A3B8" },
  head: { flexDirection: "row", backgroundColor: "#2563eb" },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderColor: "#E2E8F0" },
  cell: { padding: 5, justifyContent: "center" },
  th: { fontSize: 8, fontWeight: 700, color: "#FFFFFF" },
  sub: { fontSize: 7.5, color: "#64748B", marginTop: 1 },
  totals: { marginTop: 8, alignSelf: "flex-end", width: 230 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  grand: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, marginTop: 3, borderTopWidth: 1, borderColor: "#0F172A", fontWeight: 700 },
  section: { marginTop: 14 },
  sectionTitle: { fontSize: 10, fontWeight: 700, marginBottom: 3 },
  sign: { marginTop: 28, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
});

export async function generateQuotationPdf(i: QuotationPdfInput): Promise<Buffer> {
  const totals = quoteTotals(i.lines, i.adjustments, i.settings);
  const compact = i.options.layout === "COMPACT";
  const showOt = i.options.showOt && i.lines.some((l) => l.otRate);
  const showDuration = i.lines.some((l) => l.durationMonths);
  const cur = i.currency;

  // Column widths (flex) differ with what is shown, so the table always fills the page.
  const cols = [
    { key: "trade", label: "TRADE", flex: 3 },
    { key: "qty", label: "QTY", flex: 1 },
    { key: "price", label: "PRICE", flex: 2 },
    ...(showOt ? [{ key: "ot", label: "OT RATE", flex: 1.5 }] : []),
    ...(showDuration ? [{ key: "dur", label: "MONTHS", flex: 1.2 }] : []),
    { key: "month", label: `PER MONTH (${cur})`, flex: 2.2 },
  ];

  const cell = (l: QuotationPdfLine, key: string) => {
    switch (key) {
      case "trade":
        return (
          <>
            <Text>{l.trade}</Text>
            {!compact && (l.nationality || l.workingHours) && <Text style={s.sub}>{[l.nationality, l.workingHours].filter(Boolean).join(" · ")}</Text>}
          </>
        );
      case "qty":
        return <Text>{l.quantity}</Text>;
      case "price":
        return (
          <>
            <Text>{money(l.rate)} / {unitWord(l)}</Text>
            {!compact && conversionNote(l, i.settings) && <Text style={s.sub}>{conversionNote(l, i.settings)}</Text>}
          </>
        );
      case "ot":
        return <Text>{l.otRate ? money(l.otRate) : "—"}</Text>;
      case "dur":
        return <Text>{l.durationMonths ?? "—"}</Text>;
      default:
        return (
          <>
            <Text>{money(monthlyTotal(l, i.settings))}</Text>
            {l.quantity > 1 && <Text style={s.sub}>{money(monthlyEach(l, i.settings))} each</Text>}
          </>
        );
    }
  };

  const onArt = !!i.artwork;
  const doc = (
    <Document>
      <Page
        size="A4"
        style={[s.page, onArt ? { paddingTop: i.topMm * MM, paddingBottom: i.bottomMm * MM } : {}]}
      >
        {i.artwork && <Image src={i.artwork} style={s.background} fixed />}
        {!onArt && (
          <View style={{ borderBottomWidth: 1, borderColor: "#2563eb", paddingBottom: 8, flexDirection: "row", justifyContent: "space-between" }}>
            <View>
              <Text style={s.name}>{i.letterhead.name}</Text>
              {i.letterhead.addressLines.length > 0 && <Text style={s.addr}>{i.letterhead.addressLines.join(", ")}</Text>}
              {(i.letterhead.phone || i.letterhead.email) && <Text style={s.addr}>{[i.letterhead.phone && `Tel ${i.letterhead.phone}`, i.letterhead.email].filter(Boolean).join(" · ")}</Text>}
              {i.letterhead.trn && <Text style={s.addr}>TRN {i.letterhead.trn}</Text>}
            </View>
            {i.letterhead.logo && <Image src={i.letterhead.logo} style={{ width: 54, height: 54, objectFit: "contain" }} />}
          </View>
        )}

        <Text style={s.title}>QUOTATION</Text>
        <View style={s.meta}>
          <Text style={s.metaRow}>Ref: {i.quotationNumber}{i.version > 1 ? ` (version ${i.version})` : ""}   ·   Date: {i.date}</Text>
          <Text style={s.metaRow}>To: {i.clientName}{i.contactName ? `, Attn ${i.contactName}` : ""}</Text>
          {i.validUntil && <Text style={s.metaRow}>Valid until: {i.validUntil}</Text>}
        </View>

        {i.intro && <Text style={s.para}>{i.intro}</Text>}

        <View style={s.table}>
          <View style={s.head}>
            {cols.map((c) => (
              <View key={c.key} style={[s.cell, { flex: c.flex }]}>
                <Text style={s.th}>{c.label}</Text>
              </View>
            ))}
          </View>
          {i.lines.map((l, idx) => (
            <View key={idx} style={s.row} wrap={false}>
              {cols.map((c) => (
                <View key={c.key} style={[s.cell, { flex: c.flex }]}>{cell(l, c.key)}</View>
              ))}
            </View>
          ))}
        </View>

        <View style={s.totals} wrap={false}>
          <View style={s.totalRow}><Text>Subtotal, per month</Text><Text>{cur} {money(totals.subtotal)}</Text></View>
          {totals.rows.map((r, idx) => (
            <View key={idx} style={s.totalRow}><Text>{r.label}</Text><Text>{r.amount < 0 ? "−" : ""}{cur} {money(Math.abs(r.amount))}</Text></View>
          ))}
          <View style={s.grand}><Text>Total per month</Text><Text>{cur} {money(totals.total)}</Text></View>
          {totals.contractSubtotal != null && <View style={s.totalRow}><Text style={s.sub}>Contract value before extras</Text><Text style={s.sub}>{cur} {money(totals.contractSubtotal)}</Text></View>}
        </View>

        {i.options.showTerms && (i.accommodationResponsibility || i.transportationResponsibility || i.ppeResponsibility || i.terms) && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Terms</Text>
            {i.accommodationResponsibility && <Text style={s.para}>Accommodation: {i.accommodationResponsibility}</Text>}
            {i.transportationResponsibility && <Text style={s.para}>Transport: {i.transportationResponsibility}</Text>}
            {i.ppeResponsibility && <Text style={s.para}>PPE: {i.ppeResponsibility}</Text>}
            {i.terms && <Text style={s.para}>{i.terms}</Text>}
          </View>
        )}

        {i.closing && <Text style={[s.para, { marginTop: 10 }]}>{i.closing}</Text>}

        {(i.signature || i.stamp || i.signatoryName) && (
          <View style={s.sign} wrap={false}>
            <View>
              {i.signature && <Image src={i.signature} style={{ width: 90, height: 40, objectFit: "contain" }} />}
              <Text style={{ borderTopWidth: 0.5, borderColor: "#94A3B8", paddingTop: 3, width: 150 }}>{i.signatoryName || "Authorised signatory"}</Text>
              {i.signatoryTitle && <Text style={s.sub}>{i.signatoryTitle}</Text>}
            </View>
            {i.stamp && <Image src={i.stamp} style={{ width: 70, height: 70, objectFit: "contain" }} />}
          </View>
        )}
      </Page>
    </Document>
  );
  return renderToBuffer(doc);
}
