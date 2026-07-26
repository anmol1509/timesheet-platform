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
