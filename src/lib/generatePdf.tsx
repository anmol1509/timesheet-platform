import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import type { DailyHourCell } from "@/lib/parseTimesheet";

export type PdfEntry = {
  employeeIdNo: string;
  employeeName: string;
  trade: string;
  rate: number;
  dailyHours: DailyHourCell[];
  absentDeduction: number;
};

export type PdfInput = {
  fullName: string;
  monthLabel: string;
  issuedTo: string;
  gasDeduction: number;
  entries: PdfEntry[];
};

const styles = StyleSheet.create({
  page: { padding: 24, fontSize: 7, fontFamily: "Helvetica" },
  title: { fontSize: 14, fontWeight: 700, textAlign: "center", marginBottom: 6 },
  subtitle: { fontSize: 10, fontWeight: 700, textAlign: "center", marginBottom: 6 },
  issuedTo: { fontSize: 9, fontWeight: 700, marginBottom: 8 },
  table: { display: "flex", flexDirection: "column", borderWidth: 0.5, borderColor: "#94A3B8" },
  headerRow: {
    flexDirection: "row",
    backgroundColor: "#E2E8F0",
    borderBottomWidth: 0.5,
    borderColor: "#94A3B8",
  },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderColor: "#CBD5E1" },
  cell: {
    borderRightWidth: 0.5,
    borderColor: "#CBD5E1",
    paddingVertical: 2,
    paddingHorizontal: 2,
    textAlign: "center",
    justifyContent: "center",
  },
  headerCell: { fontWeight: 700, fontSize: 6 },
  sectionTitle: { fontSize: 9, fontWeight: 700, marginTop: 14, marginBottom: 4 },
  summaryTable: { width: 260, borderWidth: 0.5, borderColor: "#94A3B8" },
  summaryRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderColor: "#CBD5E1",
  },
  summaryCell: { padding: 3, flex: 1, fontSize: 8 },
  footer: { marginTop: 40, flexDirection: "row", justifyContent: "space-between" },
});

const WEEKDAY_ABBR = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function fmt(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export async function generateSupplierPdf(input: PdfInput): Promise<Buffer> {
  const dayCount = input.entries[0]?.dailyHours.length ?? 30;
  const idW = 34,
    nameW = 68,
    tradeW = 46,
    totalW = 22,
    dayW = 16,
    absentW = 24,
    dedW = 30;
  const snW = 16;

  const tradeMap = new Map<
    string,
    { trade: string; rate: number; hours: number; amount: number }
  >();
  for (const e of input.entries) {
    const total = e.dailyHours.reduce((sum, d) => {
      const n = Number(d.value);
      return d.value !== "" && !Number.isNaN(n) ? sum + n : sum;
    }, 0);
    const key = `${e.trade}__${e.rate}`;
    const existing = tradeMap.get(key);
    if (existing) {
      existing.hours += total;
      existing.amount += total * e.rate;
    } else {
      tradeMap.set(key, { trade: e.trade, rate: e.rate, hours: total, amount: total * e.rate });
    }
  }
  const tradeSummary = [...tradeMap.values()].sort((a, b) => a.trade.localeCompare(b.trade));
  const totalAmount = tradeSummary.reduce((s, r) => s + r.amount, 0);
  const totalAbsentDeduction = input.entries.reduce((s, e) => s + (e.absentDeduction || 0), 0);
  const totalDeduction = totalAbsentDeduction + (input.gasDeduction || 0);
  const netPayable = totalAmount - totalDeduction;

  const doc = (
    <Document>
      <Page size="A3" orientation="landscape" style={styles.page}>
        <Text style={styles.title}>{input.fullName.toUpperCase()}</Text>
        <Text style={styles.subtitle}>
          Time Sheet For The Month Of {input.monthLabel}
        </Text>
        <Text style={styles.issuedTo}>Issued To : {input.issuedTo}.</Text>

        <View style={styles.table}>
          <View style={styles.headerRow}>
            <View style={[styles.cell, { width: snW }]}>
              <Text style={styles.headerCell}>S.N.</Text>
            </View>
            <View style={[styles.cell, { width: idW }]}>
              <Text style={styles.headerCell}>ID No</Text>
            </View>
            <View style={[styles.cell, { width: nameW, textAlign: "left" }]}>
              <Text style={styles.headerCell}>EMPLOYEE NAME</Text>
            </View>
            <View style={[styles.cell, { width: tradeW }]}>
              <Text style={styles.headerCell}>TRADE</Text>
            </View>
            <View style={[styles.cell, { width: totalW }]}>
              <Text style={styles.headerCell}>TOTAL</Text>
            </View>
            {Array.from({ length: dayCount }).map((_, i) => {
              const dateStr = input.entries[0]?.dailyHours[i]?.date;
              const label = dateStr
                ? WEEKDAY_ABBR[new Date(dateStr + "T00:00:00Z").getUTCDay()]
                : "";
              const dayNum = dateStr ? Number(dateStr.slice(8, 10)) : i + 1;
              return (
                <View key={i} style={[styles.cell, { width: dayW }]}>
                  <Text style={styles.headerCell}>{label}</Text>
                  <Text style={{ fontSize: 5 }}>{dayNum}</Text>
                </View>
              );
            })}
            <View style={[styles.cell, { width: absentW }]}>
              <Text style={styles.headerCell}>Absent</Text>
            </View>
            <View style={[styles.cell, { width: dedW, borderRightWidth: 0 }]}>
              <Text style={styles.headerCell}>Deduction</Text>
            </View>
          </View>

          {input.entries.map((e, idx) => {
            const total = e.dailyHours.reduce((sum, d) => {
              const n = Number(d.value);
              return d.value !== "" && !Number.isNaN(n) ? sum + n : sum;
            }, 0);
            const absentCount = e.dailyHours.filter((d) => /^a$/i.test(d.value)).length;
            return (
              <View key={idx} style={styles.row} wrap={false}>
                <View style={[styles.cell, { width: snW }]}>
                  <Text>{idx + 1}</Text>
                </View>
                <View style={[styles.cell, { width: idW }]}>
                  <Text>{e.employeeIdNo}</Text>
                </View>
                <View style={[styles.cell, { width: nameW, textAlign: "left" }]}>
                  <Text>{e.employeeName}</Text>
                </View>
                <View style={[styles.cell, { width: tradeW }]}>
                  <Text>{e.trade}</Text>
                </View>
                <View style={[styles.cell, { width: totalW }]}>
                  <Text>{total}</Text>
                </View>
                {e.dailyHours.map((d, i) => (
                  <View key={i} style={[styles.cell, { width: dayW }]}>
                    <Text>{d.value}</Text>
                  </View>
                ))}
                <View style={[styles.cell, { width: absentW }]}>
                  <Text>{absentCount}</Text>
                </View>
                <View style={[styles.cell, { width: dedW, borderRightWidth: 0 }]}>
                  <Text>{fmt(e.absentDeduction)}</Text>
                </View>
              </View>
            );
          })}
        </View>

        <Text style={styles.sectionTitle}>Trade Summary</Text>
        <View style={[styles.table, { width: 320 }]}>
          <View style={styles.headerRow}>
            <View style={[styles.cell, { width: 120, textAlign: "left" }]}>
              <Text style={styles.headerCell}>TRADE</Text>
            </View>
            <View style={[styles.cell, { width: 60 }]}>
              <Text style={styles.headerCell}>HOUR</Text>
            </View>
            <View style={[styles.cell, { width: 60 }]}>
              <Text style={styles.headerCell}>RATE</Text>
            </View>
            <View style={[styles.cell, { width: 80, borderRightWidth: 0 }]}>
              <Text style={styles.headerCell}>AMOUNT</Text>
            </View>
          </View>
          {tradeSummary.map((row, i) => (
            <View key={i} style={styles.row}>
              <View style={[styles.cell, { width: 120, textAlign: "left" }]}>
                <Text>{row.trade}</Text>
              </View>
              <View style={[styles.cell, { width: 60 }]}>
                <Text>{row.hours}</Text>
              </View>
              <View style={[styles.cell, { width: 60 }]}>
                <Text>{row.rate.toFixed(2)}</Text>
              </View>
              <View style={[styles.cell, { width: 80, borderRightWidth: 0 }]}>
                <Text>{fmt(row.amount)}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={{ marginTop: 12 }}>
          <View style={styles.summaryTable}>
            <SummaryRow label="Total Amount AED" value={totalAmount} />
            <SummaryRow label="Absent Deduction" value={totalAbsentDeduction} />
            <SummaryRow label="Gas Deduction" value={input.gasDeduction} />
            <SummaryRow label="Total Deduction AED" value={totalDeduction} bold />
            <SummaryRow label="Net Amount Payable AED" value={netPayable} bold last />
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={{ fontSize: 9 }}>Prepared &amp; Verified By</Text>
          <Text style={{ fontSize: 9 }}>Approved By:</Text>
        </View>
      </Page>
    </Document>
  );

  return renderToBuffer(doc);
}

function SummaryRow({
  label,
  value,
  bold,
  last,
}: {
  label: string;
  value: number;
  bold?: boolean;
  last?: boolean;
}) {
  const styles2 = StyleSheet.create({
    row: {
      flexDirection: "row",
      borderBottomWidth: last ? 0 : 0.5,
      borderColor: "#CBD5E1",
    },
    label: { padding: 4, flex: 1, fontSize: bold ? 9 : 8, fontWeight: bold ? 700 : 400 },
    value: {
      padding: 4,
      width: 90,
      fontSize: bold ? 9 : 8,
      fontWeight: bold ? 700 : 400,
      textAlign: "right",
    },
  });
  return (
    <View style={styles2.row}>
      <Text style={styles2.label}>{label}</Text>
      <Text style={styles2.value}>{fmt(value)}</Text>
    </View>
  );
}

export type ClientInvoiceLine = {
  employeeIdNo: string;
  employeeName: string;
  trade: string;
  totalHours: number;
  billRate: number;
};

export type ClientInvoiceInput = {
  invoiceNumber: string;
  issuedByName: string;
  issuedByTrn: string | null;
  monthLabel: string;
  issueDate: Date;
  dueDate: Date | null;
  clientName: string;
  clientTrn: string | null;
  clientBillingAddress: string | null;
  lines: ClientInvoiceLine[];
};

const invStyles = StyleSheet.create({
  page: { padding: 36, fontSize: 9, fontFamily: "Helvetica" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 20 },
  title: { fontSize: 20, fontWeight: 700, color: "#2563eb" },
  small: { fontSize: 8, color: "#475569", marginTop: 2 },
  metaBlock: { alignItems: "flex-end" },
  billTo: { marginBottom: 16 },
  billToLabel: { fontSize: 8, fontWeight: 700, color: "#94A3B8", marginBottom: 3 },
  table: { display: "flex", flexDirection: "column", borderWidth: 0.5, borderColor: "#94A3B8" },
  headerRow2: { flexDirection: "row", backgroundColor: "#2563eb" },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderColor: "#E2E8F0" },
  cell: { padding: 5, justifyContent: "center" },
  headerCell: { fontSize: 8, fontWeight: 700, color: "#FFFFFF" },
  summaryBlock: { marginTop: 16, alignItems: "flex-end" },
  summaryTable: { width: 220 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5,
    borderTopWidth: 1,
    borderColor: "#2563eb",
    marginTop: 2,
  },
});

export async function generateClientInvoicePdf(input: ClientInvoiceInput): Promise<Buffer> {
  const nameW = 130,
    tradeW = 80,
    hoursW = 55,
    rateW = 65,
    amountW = 75;

  const doc = (
    <Document>
      <Page size="A4" style={invStyles.page}>
        <View style={invStyles.headerRow}>
          <View>
            <Text style={invStyles.title}>{input.issuedByName}</Text>
            {input.issuedByTrn && <Text style={invStyles.small}>TRN: {input.issuedByTrn}</Text>}
          </View>
          <View style={invStyles.metaBlock}>
            <Text style={{ fontSize: 14, fontWeight: 700 }}>TAX INVOICE</Text>
            <Text style={invStyles.small}>No: {input.invoiceNumber}</Text>
            <Text style={invStyles.small}>
              Issued: {input.issueDate.toLocaleDateString("en-GB")}
            </Text>
            {input.dueDate && (
              <Text style={invStyles.small}>
                Due: {input.dueDate.toLocaleDateString("en-GB")}
              </Text>
            )}
            <Text style={invStyles.small}>Period: {input.monthLabel}</Text>
          </View>
        </View>

        <View style={invStyles.billTo}>
          <Text style={invStyles.billToLabel}>BILL TO</Text>
          <Text style={{ fontSize: 11, fontWeight: 700 }}>{input.clientName}</Text>
          {input.clientBillingAddress && (
            <Text style={invStyles.small}>{input.clientBillingAddress}</Text>
          )}
          {input.clientTrn && <Text style={invStyles.small}>TRN: {input.clientTrn}</Text>}
        </View>

        <View style={invStyles.table}>
          <View style={invStyles.headerRow2}>
            <View style={[invStyles.cell, { width: nameW }]}>
              <Text style={invStyles.headerCell}>EMPLOYEE</Text>
            </View>
            <View style={[invStyles.cell, { width: tradeW }]}>
              <Text style={invStyles.headerCell}>TRADE</Text>
            </View>
            <View style={[invStyles.cell, { width: hoursW, textAlign: "right" }]}>
              <Text style={invStyles.headerCell}>HOURS</Text>
            </View>
            <View style={[invStyles.cell, { width: rateW, textAlign: "right" }]}>
              <Text style={invStyles.headerCell}>RATE (AED)</Text>
            </View>
            <View style={[invStyles.cell, { width: amountW, textAlign: "right" }]}>
              <Text style={invStyles.headerCell}>AMOUNT (AED)</Text>
            </View>
          </View>
          {input.lines.map((l, i) => (
            <View key={i} style={invStyles.row} wrap={false}>
              <View style={[invStyles.cell, { width: nameW }]}>
                <Text>{l.employeeName}</Text>
                <Text style={{ fontSize: 7, color: "#94A3B8" }}>{l.employeeIdNo}</Text>
              </View>
              <View style={[invStyles.cell, { width: tradeW }]}>
                <Text>{l.trade}</Text>
              </View>
              <View style={[invStyles.cell, { width: hoursW, alignItems: "flex-end" }]}>
                <Text>{l.totalHours}</Text>
              </View>
              <View style={[invStyles.cell, { width: rateW, alignItems: "flex-end" }]}>
                <Text>{fmt(l.billRate)}</Text>
              </View>
              <View style={[invStyles.cell, { width: amountW, alignItems: "flex-end" }]}>
                <Text>{fmt(l.totalHours * l.billRate)}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={invStyles.summaryBlock}>
          <View style={invStyles.summaryTable}>
            <View style={invStyles.summaryRow}>
              <Text>Subtotal</Text>
              <Text>
                {fmt(input.lines.reduce((s, l) => s + l.totalHours * l.billRate, 0))}
              </Text>
            </View>
            <View style={invStyles.summaryRow}>
              <Text>VAT (5%)</Text>
              <Text>
                {fmt(
                  input.lines.reduce((s, l) => s + l.totalHours * l.billRate, 0) * 0.05
                )}
              </Text>
            </View>
            <View style={invStyles.totalRow}>
              <Text style={{ fontWeight: 700, fontSize: 11 }}>Total Due (AED)</Text>
              <Text style={{ fontWeight: 700, fontSize: 11 }}>
                {fmt(
                  input.lines.reduce((s, l) => s + l.totalHours * l.billRate, 0) * 1.05
                )}
              </Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );

  return renderToBuffer(doc);
}
