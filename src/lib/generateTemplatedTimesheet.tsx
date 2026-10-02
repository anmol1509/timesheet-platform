import { Document, Page, Text, View, Image, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import ExcelJS from "exceljs";
import type { DailyHourCell } from "@/lib/parseTimesheet";
import type { Letterhead } from "@/lib/letterhead";
import type { TimesheetTemplateKey } from "@/lib/timesheetTemplates";

/** The non-standard layouts. The standard one keeps its own generators. */
export type TemplatedKey = Exclude<TimesheetTemplateKey, "standard">;

export type TemplatedInput = {
  template: TemplatedKey;
  letterhead: Letterhead;
  subContractor: string;
  monthLabel: string;
  periodFrom: string;
  periodTo: string;
  issuedTo: string;
  entries: { employeeIdNo: string; employeeName: string; trade: string; rate: number; projectCode: string | null; dailyHours: DailyHourCell[]; absentDeduction: number }[];
  gasDeduction: number;
  vatPercent: number;
  preparedBy: string | null;
};

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const money = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function figures(e: TemplatedInput["entries"][number]) {
  let hours = 0, days = 0, absent = 0;
  for (const c of e.dailyHours) {
    const v = c.value.trim();
    const n = Number(v);
    if (v !== "" && Number.isFinite(n)) { hours += n; if (n > 0) days++; }
    else if (v.toUpperCase() === "A") absent++;
  }
  const gross = r2(hours * e.rate);
  return { hours: r2(hours), days, absent, gross, deduction: e.absentDeduction, net: r2(gross - e.absentDeduction) };
}

function totals(input: TemplatedInput) {
  const rows = input.entries.map((e) => ({ e, f: figures(e) }));
  const gross = r2(rows.reduce((s, r) => s + r.f.gross, 0));
  const absentDed = r2(rows.reduce((s, r) => s + r.f.deduction, 0));
  const subtotal = r2(gross - absentDed - input.gasDeduction);
  const vat = r2((subtotal * input.vatPercent) / 100);
  return { rows, hours: r2(rows.reduce((s, r) => s + r.f.hours, 0)), gross, absentDed, gas: input.gasDeduction, subtotal, vat, total: r2(subtotal + vat) };
}

function byTrade(rows: ReturnType<typeof totals>["rows"]) {
  const map = new Map<string, { trade: string; rate: number; workers: number; hours: number; amount: number }>();
  for (const { e, f } of rows) {
    const k = `${e.trade}__${e.rate}`;
    const cur = map.get(k) ?? { trade: e.trade || "—", rate: e.rate, workers: 0, hours: 0, amount: 0 };
    cur.workers++; cur.hours = r2(cur.hours + f.hours); cur.amount = r2(cur.amount + f.gross);
    map.set(k, cur);
  }
  return [...map.values()].sort((a, b) => a.trade.localeCompare(b.trade) || a.rate - b.rate);
}

const TITLES: Record<TemplatedKey, string> = { summary: "MONTHLY TIMESHEET SUMMARY", trade: "TRADE-WISE BILLING SUMMARY", signoff: "SITE TIMESHEET SIGN-OFF" };

/* ------------------------------------------------------------------ PDF */
const NAVY = "#2B3187";
const s = StyleSheet.create({
  page: { paddingTop: 28, paddingBottom: 36, paddingHorizontal: 30, fontSize: 8, fontFamily: "Helvetica", color: "#000" },
  head: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  logo: { width: 60, height: 44, objectFit: "contain", marginRight: 8 },
  company: { fontSize: 12, fontFamily: "Helvetica-Bold", color: NAVY },
  small: { fontSize: 7, color: "#444" },
  rule: { height: 1.4, backgroundColor: NAVY, marginVertical: 5 },
  title: { fontSize: 11, fontFamily: "Helvetica-Bold", textAlign: "center", marginTop: 4 },
  meta: { flexDirection: "row", justifyContent: "space-between", marginTop: 8, marginBottom: 8 },
  metaText: { fontSize: 8 },
  table: { borderWidth: 0.6, borderColor: "#000" },
  tr: { flexDirection: "row", borderBottomWidth: 0.4, borderColor: "#000" },
  th: { fontFamily: "Helvetica-Bold", fontSize: 7, backgroundColor: "#E8EAF6", paddingVertical: 3, paddingHorizontal: 3, borderRightWidth: 0.4, borderColor: "#000" },
  td: { fontSize: 7.5, paddingVertical: 2.5, paddingHorizontal: 3, borderRightWidth: 0.4, borderColor: "#000" },
  num: { textAlign: "right" },
  ctr: { textAlign: "center" },
  boldRow: { backgroundColor: "#F3F4F6", fontFamily: "Helvetica-Bold" },
  sumBox: { alignSelf: "flex-end", width: 230, marginTop: 10 },
  sumRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2, borderBottomWidth: 0.4, borderColor: "#999" },
  sumTotal: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3, backgroundColor: "#E8EAF6", fontFamily: "Helvetica-Bold" },
  sigRow: { flexDirection: "row", marginTop: 34, gap: 14 },
  sig: { flex: 1 },
  sigLine: { borderTopWidth: 0.8, borderColor: "#000", marginBottom: 3 },
  footer: { position: "absolute", bottom: 14, left: 0, right: 0, textAlign: "center", fontSize: 7, color: "#555" },
});

type Col = { head: string; w: number; align?: "num" | "ctr"; get: (i: number) => string };

function Table({ cols, rows, foot }: { cols: Col[]; rows: number; foot?: string[] }) {
  return (
    <View style={s.table}>
      <View style={s.tr} fixed>
        {cols.map((c, i) => <Text key={i} style={[s.th, { width: c.w, flexGrow: i === cols.length - 1 ? 1 : 0 }, c.align === "num" ? s.num : c.align === "ctr" ? s.ctr : {}]}>{c.head}</Text>)}
      </View>
      {Array.from({ length: rows }, (_, r) => (
        <View key={r} style={s.tr} wrap={false}>
          {cols.map((c, i) => <Text key={i} style={[s.td, { width: c.w, flexGrow: i === cols.length - 1 ? 1 : 0 }, c.align === "num" ? s.num : c.align === "ctr" ? s.ctr : {}]}>{c.get(r)}</Text>)}
        </View>
      ))}
      {foot && (
        <View style={[s.tr, s.boldRow]} wrap={false}>
          {cols.map((c, i) => <Text key={i} style={[s.td, { width: c.w, flexGrow: i === cols.length - 1 ? 1 : 0, fontFamily: "Helvetica-Bold" }, c.align === "num" ? s.num : c.align === "ctr" ? s.ctr : {}]}>{foot[i] ?? ""}</Text>)}
        </View>
      )}
    </View>
  );
}

function Summary({ t, input }: { t: ReturnType<typeof totals>; input: TemplatedInput }) {
  const line = (a: string, b: string, total = false) => (
    <View style={total ? s.sumTotal : s.sumRow}><Text>{a}</Text><Text>{b}</Text></View>
  );
  return (
    <View style={s.sumBox} wrap={false}>
      {line("Gross amount (AED)", money(t.gross))}
      {t.absentDed > 0 && line("Less: absence deductions", `- ${money(t.absentDed)}`)}
      {t.gas > 0 && line("Less: gas charges", `- ${money(t.gas)}`)}
      {line("Sub-total", money(t.subtotal))}
      {line(`VAT ${input.vatPercent}%`, money(t.vat))}
      {line("TOTAL PAYABLE (AED)", money(t.total), true)}
    </View>
  );
}

function Sigs({ prepared }: { prepared: string | null }) {
  return (
    <View style={s.sigRow} wrap={false}>
      {[["Prepared by", prepared ?? ""], ["Verified by", ""], ["Client approval (name, signature, stamp)", ""]].map(([label, name]) => (
        <View key={label} style={s.sig}>
          <View style={s.sigLine} />
          <Text style={{ fontSize: 7.5, fontFamily: "Helvetica-Bold" }}>{label}</Text>
          {name ? <Text style={s.small}>{name}</Text> : <Text style={s.small}>Date: ____ / ____ / ________</Text>}
        </View>
      ))}
    </View>
  );
}

export async function generateTemplatedPdf(input: TemplatedInput): Promise<Buffer> {
  const t = totals(input);
  const L = input.letterhead;
  let table: React.ReactNode;

  if (input.template === "trade") {
    const g = byTrade(t.rows);
    table = (
      <Table
        rows={g.length}
        cols={[
          { head: "SN", w: 30, align: "ctr", get: (i) => String(i + 1) },
          { head: "Trade", w: 190, get: (i) => g[i].trade },
          { head: "Workers", w: 55, align: "ctr", get: (i) => String(g[i].workers) },
          { head: "Hours", w: 70, align: "num", get: (i) => String(g[i].hours) },
          { head: "Rate (AED/hr)", w: 80, align: "num", get: (i) => money(g[i].rate) },
          { head: "Amount (AED)", w: 100, align: "num", get: (i) => money(g[i].amount) },
        ]}
        foot={["", "TOTAL", String(g.reduce((a, x) => a + x.workers, 0)), String(t.hours), "", money(t.gross)]}
      />
    );
  } else if (input.template === "summary") {
    table = (
      <Table
        rows={t.rows.length}
        cols={[
          { head: "SN", w: 24, align: "ctr", get: (i) => String(i + 1) },
          { head: "ID", w: 52, get: (i) => t.rows[i].e.employeeIdNo },
          { head: "Name", w: 125, get: (i) => t.rows[i].e.employeeName },
          { head: "Trade", w: 78, get: (i) => t.rows[i].e.trade },
          { head: "Days", w: 30, align: "ctr", get: (i) => String(t.rows[i].f.days) },
          { head: "Abs.", w: 28, align: "ctr", get: (i) => String(t.rows[i].f.absent) },
          { head: "Hours", w: 40, align: "num", get: (i) => String(t.rows[i].f.hours) },
          { head: "Rate", w: 38, align: "num", get: (i) => money(t.rows[i].e.rate) },
          { head: "Amount (AED)", w: 66, align: "num", get: (i) => money(t.rows[i].f.net) },
        ]}
        foot={["", "", "TOTAL", "", "", "", String(t.hours), "", money(t.rows.reduce((a, r) => a + r.f.net, 0))]}
      />
    );
  } else {
    table = (
      <Table
        rows={t.rows.length}
        cols={[
          { head: "SN", w: 24, align: "ctr", get: (i) => String(i + 1) },
          { head: "ID", w: 52, get: (i) => t.rows[i].e.employeeIdNo },
          { head: "Name", w: 130, get: (i) => t.rows[i].e.employeeName },
          { head: "Trade", w: 80, get: (i) => t.rows[i].e.trade },
          { head: "Project", w: 55, get: (i) => t.rows[i].e.projectCode ?? "" },
          { head: "Days", w: 30, align: "ctr", get: (i) => String(t.rows[i].f.days) },
          { head: "Hours", w: 38, align: "num", get: (i) => String(t.rows[i].f.hours) },
          { head: "Site engineer initials", w: 112, get: () => "" },
        ]}
        foot={["", "", "TOTAL", "", "", "", String(t.hours), ""]}
      />
    );
  }

  const doc = (
    <Document title={`${TITLES[input.template]} ${input.monthLabel}`}>
      <Page size="A4" style={s.page}>
        <View style={s.head} fixed>
          {L.logo ? <Image src={L.logo} style={s.logo} /> : null}
          <View style={{ flex: 1 }}>
            <Text style={s.company}>{L.name}</Text>
            <Text style={s.small}>{[...L.addressLines, L.phone ? `Tel: ${L.phone}` : "", L.email ?? "", L.trn ? `TRN: ${L.trn}` : ""].filter(Boolean).join("  ·  ")}</Text>
          </View>
        </View>
        <View style={s.rule} fixed />
        <Text style={s.title}>{TITLES[input.template]}</Text>
        <View style={s.meta}>
          <View>
            <Text style={s.metaText}>Sub-contractor: {input.subContractor}</Text>
            <Text style={s.metaText}>Issued to: {input.issuedTo}</Text>
          </View>
          <View>
            <Text style={[s.metaText, { textAlign: "right" }]}>Month: {input.monthLabel}</Text>
            <Text style={[s.metaText, { textAlign: "right" }]}>Period: {input.periodFrom} – {input.periodTo}</Text>
          </View>
        </View>
        {table}
        {input.template !== "signoff" && <Summary t={t} input={input} />}
        {input.template === "signoff" && <Text style={[s.small, { marginTop: 8 }]}>Hours above are the hours recorded for the month. By signing, the client confirms them.</Text>}
        <Sigs prepared={input.preparedBy} />
        <Text style={s.footer} render={({ pageNumber, totalPages }) => `${L.name}  ·  Page ${pageNumber} of ${totalPages}`} fixed />
      </Page>
    </Document>
  );
  return renderToBuffer(doc);
}

/* ----------------------------------------------------------------- XLSX */
export async function generateTemplatedXlsx(input: TemplatedInput): Promise<Buffer> {
  const t = totals(input);
  const wb = new ExcelJS.Workbook();
  wb.creator = "ManpowerSync";
  const ws = wb.addWorksheet(TITLES[input.template].slice(0, 28), { pageSetup: { orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
  const bold = { name: "Arial", bold: true, size: 10 };
  const thin = { style: "thin" as const, color: { argb: "FF94A3B8" } };
  const box = { top: thin, left: thin, bottom: thin, right: thin };

  let cols: { header: string; width: number; align?: "right" | "center" }[];
  let data: (string | number)[][];
  let foot: (string | number)[];

  if (input.template === "trade") {
    const g = byTrade(t.rows);
    cols = [{ header: "SN", width: 6, align: "center" }, { header: "Trade", width: 30 }, { header: "Workers", width: 10, align: "center" }, { header: "Hours", width: 12, align: "right" }, { header: "Rate (AED/hr)", width: 14, align: "right" }, { header: "Amount (AED)", width: 16, align: "right" }];
    data = g.map((x, i) => [i + 1, x.trade, x.workers, x.hours, x.rate, x.amount]);
    foot = ["", "TOTAL", g.reduce((a, x) => a + x.workers, 0), t.hours, "", t.gross];
  } else if (input.template === "summary") {
    cols = [{ header: "SN", width: 6, align: "center" }, { header: "ID", width: 12 }, { header: "Name", width: 26 }, { header: "Trade", width: 16 }, { header: "Days", width: 7, align: "center" }, { header: "Absent", width: 8, align: "center" }, { header: "Hours", width: 10, align: "right" }, { header: "Rate", width: 9, align: "right" }, { header: "Amount (AED)", width: 14, align: "right" }];
    data = t.rows.map((r, i) => [i + 1, r.e.employeeIdNo, r.e.employeeName, r.e.trade, r.f.days, r.f.absent, r.f.hours, r.e.rate, r.f.net]);
    foot = ["", "", "TOTAL", "", "", "", t.hours, "", r2(t.rows.reduce((a, r) => a + r.f.net, 0))];
  } else {
    cols = [{ header: "SN", width: 6, align: "center" }, { header: "ID", width: 12 }, { header: "Name", width: 26 }, { header: "Trade", width: 16 }, { header: "Project", width: 10 }, { header: "Days", width: 7, align: "center" }, { header: "Hours", width: 10, align: "right" }, { header: "Site engineer initials", width: 22 }];
    data = t.rows.map((r, i) => [i + 1, r.e.employeeIdNo, r.e.employeeName, r.e.trade, r.e.projectCode ?? "", r.f.days, r.f.hours, ""]);
    foot = ["", "", "TOTAL", "", "", "", t.hours, ""];
  }
  cols.forEach((c, i) => { ws.getColumn(i + 1).width = c.width; });
  const n = cols.length;
  const put = (row: number, text: string, font: Partial<ExcelJS.Font> = bold, merge = true) => {
    const c = ws.getCell(row, 1); c.value = text; c.font = font;
    if (merge) ws.mergeCells(row, 1, row, n);
  };
  put(1, input.letterhead.name, { name: "Arial", bold: true, size: 14, color: { argb: "FF2B3187" } });
  put(2, [...input.letterhead.addressLines, input.letterhead.trn ? `TRN: ${input.letterhead.trn}` : ""].filter(Boolean).join("  ·  "), { name: "Arial", size: 9 });
  put(4, TITLES[input.template], { name: "Arial", bold: true, size: 12 });
  ws.getCell(4, 1).alignment = { horizontal: "center" };
  put(5, `Sub-contractor: ${input.subContractor}`, { name: "Arial", size: 10 });
  put(6, `Issued to: ${input.issuedTo}`, { name: "Arial", size: 10 });
  put(7, `Month: ${input.monthLabel}   Period: ${input.periodFrom} – ${input.periodTo}`, { name: "Arial", size: 10 });

  const hr = 9;
  cols.forEach((c, i) => {
    const cell = ws.getCell(hr, i + 1);
    cell.value = c.header; cell.font = bold; cell.border = box; cell.alignment = { horizontal: c.align ?? "left", vertical: "middle", wrapText: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8EAF6" } };
  });
  const place = (row: number, vals: (string | number)[], isFoot = false) => {
    vals.forEach((v, i) => {
      const cell = ws.getCell(row, i + 1);
      cell.value = v === "" ? null : v; cell.border = box;
      cell.font = isFoot ? bold : { name: "Arial", size: 10 };
      cell.alignment = { horizontal: cols[i].align ?? "left", vertical: "middle" };
      if (typeof v === "number" && cols[i].align === "right" && /Amount|Rate/.test(cols[i].header)) cell.numFmt = "#,##0.00";
      if (isFoot) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F4F6" } };
    });
  };
  data.forEach((d, i) => place(hr + 1 + i, d));
  let r = hr + 1 + data.length;
  place(r, foot, true);
  r += 2;
  if (input.template !== "signoff") {
    const lines: [string, number, boolean?][] = [["Gross amount (AED)", t.gross]];
    if (t.absentDed > 0) lines.push(["Less: absence deductions", -t.absentDed]);
    if (t.gas > 0) lines.push(["Less: gas charges", -t.gas]);
    lines.push(["Sub-total", t.subtotal], [`VAT ${input.vatPercent}%`, t.vat], ["TOTAL PAYABLE (AED)", t.total, true]);
    for (const [label, val, strong] of lines) {
      const a = ws.getCell(r, n - 1), b = ws.getCell(r, n);
      a.value = label; b.value = val; b.numFmt = "#,##0.00;-#,##0.00";
      a.font = b.font = strong ? bold : { name: "Arial", size: 10 };
      a.alignment = { horizontal: "right" };
      a.border = b.border = box;
      r++;
    }
    r++;
  }
  r += 2;
  ["Prepared by" + (input.preparedBy ? `: ${input.preparedBy}` : ""), "Verified by", "Client approval (name, signature, stamp)"].forEach((label, i) => {
    const c = ws.getCell(r, 1 + i * Math.floor(n / 3)); c.value = label; c.font = bold; c.border = { top: thin };
  });
  return Buffer.from(await wb.xlsx.writeBuffer());
}
