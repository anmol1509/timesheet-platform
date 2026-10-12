import { Document, Page, Text, View, Image, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import ExcelJS from "exceljs";
import type { DailyHourCell } from "@/lib/parseTimesheet";
import type { Letterhead } from "@/lib/letterhead";
import type { TimesheetTemplateKey } from "@/lib/timesheetTemplates";
import { visibleColumns, type TemplateConfig } from "@/lib/timesheetTemplateConfig";

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
  /** A company's own version of the layout. Missing = the layout exactly as shipped. */
  config?: TemplateConfig | null;
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

/** The VAT % actually used: the template's own, none when the VAT line is switched off, else the sheet's. */
function vatOf(input: TemplatedInput) {
  const c = input.config;
  if (c && !c.blocks.vat) return 0;
  return c?.vatPercent ?? input.vatPercent;
}

function totals(input: TemplatedInput) {
  const rows = input.entries.map((e) => ({ e, f: figures(e) }));
  const gross = r2(rows.reduce((s, r) => s + r.f.gross, 0));
  const absentDed = r2(rows.reduce((s, r) => s + r.f.deduction, 0));
  const subtotal = r2(gross - absentDed - input.gasDeduction);
  const vat = r2((subtotal * vatOf(input)) / 100);
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
  const c = input.config;
  const line = (a: string, b: string, total = false) => (
    <View style={total ? s.sumTotal : s.sumRow}><Text>{a}</Text><Text>{b}</Text></View>
  );
  const showDed = !c || c.blocks.deductions;
  const showVat = !c || c.blocks.vat;
  return (
    <View style={s.sumBox} wrap={false}>
      {line("Gross amount (AED)", money(t.gross))}
      {showDed && t.absentDed > 0 && line("Less: absence deductions", `- ${money(t.absentDed)}`)}
      {showDed && t.gas > 0 && line("Less: gas charges", `- ${money(t.gas)}`)}
      {(showDed || showVat) && line("Sub-total", money(t.subtotal))}
      {showVat && line(`VAT ${vatOf(input)}%`, money(t.vat))}
      {line("TOTAL PAYABLE (AED)", money(t.total), true)}
    </View>
  );
}

function Sigs({ labels, prepared }: { labels: string[]; prepared: string | null }) {
  if (labels.length === 0) return null;
  return (
    <View style={s.sigRow} wrap={false}>
      {labels.map((label, i) => (
        <View key={i} style={s.sig}>
          <View style={s.sigLine} />
          <Text style={{ fontSize: 7.5, fontFamily: "Helvetica-Bold" }}>{label}</Text>
          {i === 0 && prepared ? <Text style={s.small}>{prepared}</Text> : <Text style={s.small}>Date: ____ / ____ / ________</Text>}
        </View>
      ))}
    </View>
  );
}

type Layout = { cols: Record<string, Col>; foot: Record<string, string>; rows: number };

/** Every column of a layout, by key, so a template can hide or reword them. */
function layoutOf(input: TemplatedInput, t: ReturnType<typeof totals>): Layout {
  if (input.template === "trade") {
    const g = byTrade(t.rows);
    return {
      rows: g.length,
      cols: {
        sn: { head: "SN", w: 30, align: "ctr", get: (i) => String(i + 1) },
        trade: { head: "Trade", w: 190, get: (i) => g[i].trade },
        workers: { head: "Workers", w: 55, align: "ctr", get: (i) => String(g[i].workers) },
        hours: { head: "Hours", w: 70, align: "num", get: (i) => String(g[i].hours) },
        rate: { head: "Rate (AED/hr)", w: 80, align: "num", get: (i) => money(g[i].rate) },
        amount: { head: "Amount (AED)", w: 100, align: "num", get: (i) => money(g[i].amount) },
      },
      foot: { trade: "TOTAL", workers: String(g.reduce((a, x) => a + x.workers, 0)), hours: String(t.hours), amount: money(t.gross) },
    };
  }
  if (input.template === "summary") {
    return {
      rows: t.rows.length,
      cols: {
        sn: { head: "SN", w: 24, align: "ctr", get: (i) => String(i + 1) },
        id: { head: "ID", w: 52, get: (i) => t.rows[i].e.employeeIdNo },
        name: { head: "Name", w: 125, get: (i) => t.rows[i].e.employeeName },
        trade: { head: "Trade", w: 78, get: (i) => t.rows[i].e.trade },
        days: { head: "Days", w: 30, align: "ctr", get: (i) => String(t.rows[i].f.days) },
        absent: { head: "Abs.", w: 28, align: "ctr", get: (i) => String(t.rows[i].f.absent) },
        hours: { head: "Hours", w: 40, align: "num", get: (i) => String(t.rows[i].f.hours) },
        rate: { head: "Rate", w: 38, align: "num", get: (i) => money(t.rows[i].e.rate) },
        amount: { head: "Amount (AED)", w: 66, align: "num", get: (i) => money(t.rows[i].f.net) },
      },
      foot: { name: "TOTAL", hours: String(t.hours), amount: money(t.rows.reduce((a, r) => a + r.f.net, 0)) },
    };
  }
  return {
    rows: t.rows.length,
    cols: {
      sn: { head: "SN", w: 24, align: "ctr", get: (i) => String(i + 1) },
      id: { head: "ID", w: 52, get: (i) => t.rows[i].e.employeeIdNo },
      name: { head: "Name", w: 130, get: (i) => t.rows[i].e.employeeName },
      trade: { head: "Trade", w: 80, get: (i) => t.rows[i].e.trade },
      project: { head: "Project", w: 55, get: (i) => t.rows[i].e.projectCode ?? "" },
      days: { head: "Days", w: 30, align: "ctr", get: (i) => String(t.rows[i].f.days) },
      hours: { head: "Hours", w: 38, align: "num", get: (i) => String(t.rows[i].f.hours) },
      engineer: { head: "Site engineer initials", w: 112, get: () => "" },
    },
    foot: { name: "TOTAL", hours: String(t.hours) },
  };
}

export async function generateTemplatedPdf(input: TemplatedInput): Promise<Buffer> {
  const t = totals(input);
  const L = input.letterhead;
  const c = input.config ?? null;
  const layout = layoutOf(input, t);
  const visible = visibleColumns(input.template, c);
  const cols = visible.map((v) => ({ ...layout.cols[v.key], head: v.label }));
  const table = <Table rows={layout.rows} cols={cols} foot={visible.map((v) => layout.foot[v.key] ?? "")} />;
  const h = c?.header;
  const contact = [
    ...(h && !h.address ? [] : L.addressLines),
    !h || h.phone ? (L.phone ? `Tel: ${L.phone}` : "") : "",
    !h || h.email ? (L.email ?? "") : "",
    h?.poBox && L.poBox ? `P.O. Box ${L.poBox}` : "",
    !h || h.trn ? (L.trn ? `TRN: ${L.trn}` : "") : "",
  ].filter(Boolean).join("  ·  ");
  const title = c?.title || TITLES[input.template];
  const sigLabels = c ? c.signatures : ["Prepared by", "Verified by", "Client approval (name, signature, stamp)"];
  const showSummary = input.template !== "signoff" && (!c || c.blocks.totals);
  const noteParas = c && c.blocks.notes ? c.notes.split(/\n+/).map((x) => x.trim()).filter(Boolean) : [];

  const doc = (
    <Document title={`${title} ${input.monthLabel}`}>
      <Page size="A4" style={s.page}>
        <View style={s.head} fixed>
          {(!h || h.logo) && L.logo ? <Image src={L.logo} style={s.logo} /> : null}
          <View style={{ flex: 1 }}>
            <Text style={s.company}>{L.name}</Text>
            <Text style={s.small}>{contact}</Text>
          </View>
        </View>
        <View style={s.rule} fixed />
        <Text style={s.title}>{title}</Text>
        <View style={s.meta}>
          <View>
            {(!h || h.subContractor) && <Text style={s.metaText}>Sub-contractor: {input.subContractor}</Text>}
            {(!h || h.issuedTo) && <Text style={s.metaText}>Issued to: {input.issuedTo}</Text>}
          </View>
          <View>
            <Text style={[s.metaText, { textAlign: "right" }]}>Month: {input.monthLabel}</Text>
            {(!h || h.period) && <Text style={[s.metaText, { textAlign: "right" }]}>Period: {input.periodFrom} – {input.periodTo}</Text>}
          </View>
        </View>
        {table}
        {showSummary && <Summary t={t} input={input} />}
        {input.template === "signoff" && !c && <Text style={[s.small, { marginTop: 8 }]}>Hours above are the hours recorded for the month. By signing, the client confirms them.</Text>}
        {noteParas.map((p, i) => <Text key={i} style={[s.small, { marginTop: i === 0 ? 10 : 3 }]}>{p}</Text>)}
        <Sigs labels={sigLabels} prepared={input.preparedBy} />
        <Text style={s.footer} render={({ pageNumber, totalPages }) => `${c?.footer || L.name}  ·  Page ${pageNumber} of ${totalPages}`} fixed />
      </Page>
    </Document>
  );
  return renderToBuffer(doc);
}

/* ----------------------------------------------------------------- XLSX */
export async function generateTemplatedXlsx(input: TemplatedInput): Promise<Buffer> {
  const t = totals(input);
  const c = input.config ?? null;
  const title = c?.title || TITLES[input.template];
  const wb = new ExcelJS.Workbook();
  wb.creator = "ManpowerSync";
  const ws = wb.addWorksheet(title.slice(0, 28).replace(/[\\/*?:[\]]/g, " "), { pageSetup: { orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
  const bold = { name: "Arial", bold: true, size: 10 };
  const thin = { style: "thin" as const, color: { argb: "FF94A3B8" } };
  const box = { top: thin, left: thin, bottom: thin, right: thin };

  type XCol = { key: string; header: string; width: number; align?: "right" | "center" };
  let all: XCol[];
  let rowsOf: (r: ReturnType<typeof totals>["rows"][number], i: number) => Record<string, string | number>;
  let data: Record<string, string | number>[];
  let foot: Record<string, string | number>;

  if (input.template === "trade") {
    const g = byTrade(t.rows);
    all = [{ key: "sn", header: "SN", width: 6, align: "center" }, { key: "trade", header: "Trade", width: 30 }, { key: "workers", header: "Workers", width: 10, align: "center" }, { key: "hours", header: "Hours", width: 12, align: "right" }, { key: "rate", header: "Rate (AED/hr)", width: 14, align: "right" }, { key: "amount", header: "Amount (AED)", width: 16, align: "right" }];
    data = g.map((x, i) => ({ sn: i + 1, trade: x.trade, workers: x.workers, hours: x.hours, rate: x.rate, amount: x.amount }));
    foot = { trade: "TOTAL", workers: g.reduce((a, x) => a + x.workers, 0), hours: t.hours, amount: t.gross };
    rowsOf = () => ({});
  } else if (input.template === "summary") {
    all = [{ key: "sn", header: "SN", width: 6, align: "center" }, { key: "id", header: "ID", width: 12 }, { key: "name", header: "Name", width: 26 }, { key: "trade", header: "Trade", width: 16 }, { key: "days", header: "Days", width: 7, align: "center" }, { key: "absent", header: "Absent", width: 8, align: "center" }, { key: "hours", header: "Hours", width: 10, align: "right" }, { key: "rate", header: "Rate", width: 9, align: "right" }, { key: "amount", header: "Amount (AED)", width: 14, align: "right" }];
    data = t.rows.map((r, i) => ({ sn: i + 1, id: r.e.employeeIdNo, name: r.e.employeeName, trade: r.e.trade, days: r.f.days, absent: r.f.absent, hours: r.f.hours, rate: r.e.rate, amount: r.f.net }));
    foot = { name: "TOTAL", hours: t.hours, amount: r2(t.rows.reduce((a, r) => a + r.f.net, 0)) };
    rowsOf = () => ({});
  } else {
    all = [{ key: "sn", header: "SN", width: 6, align: "center" }, { key: "id", header: "ID", width: 12 }, { key: "name", header: "Name", width: 26 }, { key: "trade", header: "Trade", width: 16 }, { key: "project", header: "Project", width: 10 }, { key: "days", header: "Days", width: 7, align: "center" }, { key: "hours", header: "Hours", width: 10, align: "right" }, { key: "engineer", header: "Site engineer initials", width: 22 }];
    data = t.rows.map((r, i) => ({ sn: i + 1, id: r.e.employeeIdNo, name: r.e.employeeName, trade: r.e.trade, project: r.e.projectCode ?? "", days: r.f.days, hours: r.f.hours, engineer: "" }));
    foot = { name: "TOTAL", hours: t.hours };
    rowsOf = () => ({});
  }
  void rowsOf;
  const names = new Map(visibleColumns(input.template, c).map((v) => [v.key, v.label]));
  const cols = all.filter((x) => names.has(x.key)).map((x) => ({ ...x, header: names.get(x.key)! }));
  cols.forEach((col, i) => { ws.getColumn(i + 1).width = col.width; });
  const n = cols.length;
  const h = c?.header;
  const put = (row: number, text: string, font: Partial<ExcelJS.Font> = bold, merge = true) => {
    const cell = ws.getCell(row, 1); cell.value = text; cell.font = font;
    if (merge && n > 1) ws.mergeCells(row, 1, row, n);
  };
  const L = input.letterhead;
  put(1, L.name, { name: "Arial", bold: true, size: 14, color: { argb: "FF2B3187" } });
  put(2, [...(h && !h.address ? [] : L.addressLines), h && !h.trn ? "" : L.trn ? `TRN: ${L.trn}` : "", h?.poBox && L.poBox ? `P.O. Box ${L.poBox}` : "", !h || h.phone ? (L.phone ? `Tel: ${L.phone}` : "") : "", !h || h.email ? (L.email ?? "") : ""].filter(Boolean).join("  ·  "), { name: "Arial", size: 9 });
  put(4, title, { name: "Arial", bold: true, size: 12 });
  ws.getCell(4, 1).alignment = { horizontal: "center" };
  let meta = 5;
  if (!h || h.subContractor) put(meta++, `Sub-contractor: ${input.subContractor}`, { name: "Arial", size: 10 });
  if (!h || h.issuedTo) put(meta++, `Issued to: ${input.issuedTo}`, { name: "Arial", size: 10 });
  put(meta++, `Month: ${input.monthLabel}${!h || h.period ? `   Period: ${input.periodFrom} – ${input.periodTo}` : ""}`, { name: "Arial", size: 10 });

  const hr = meta + 1;
  cols.forEach((col, i) => {
    const cell = ws.getCell(hr, i + 1);
    cell.value = col.header; cell.font = bold; cell.border = box; cell.alignment = { horizontal: col.align ?? "left", vertical: "middle", wrapText: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8EAF6" } };
  });
  const place = (row: number, vals: Record<string, string | number>, isFoot = false) => {
    cols.forEach((col, i) => {
      const v = vals[col.key] ?? "";
      const cell = ws.getCell(row, i + 1);
      cell.value = v === "" ? null : v; cell.border = box;
      cell.font = isFoot ? bold : { name: "Arial", size: 10 };
      cell.alignment = { horizontal: col.align ?? "left", vertical: "middle" };
      if (typeof v === "number" && col.align === "right" && /Amount|Rate/i.test(all.find((a) => a.key === col.key)?.header ?? "")) cell.numFmt = "#,##0.00";
      if (isFoot) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F4F6" } };
    });
  };
  data.forEach((d, i) => place(hr + 1 + i, d));
  let r = hr + 1 + data.length;
  place(r, foot, true);
  r += 2;
  if (input.template !== "signoff" && (!c || c.blocks.totals) && n >= 2) {
    const showDed = !c || c.blocks.deductions, showVat = !c || c.blocks.vat;
    const lines: [string, number, boolean?][] = [["Gross amount (AED)", t.gross]];
    if (showDed && t.absentDed > 0) lines.push(["Less: absence deductions", -t.absentDed]);
    if (showDed && t.gas > 0) lines.push(["Less: gas charges", -t.gas]);
    if (showDed || showVat) lines.push(["Sub-total", t.subtotal]);
    if (showVat) lines.push([`VAT ${vatOf(input)}%`, t.vat]);
    lines.push(["TOTAL PAYABLE (AED)", t.total, true]);
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
  if (c && c.blocks.notes && c.notes) {
    for (const para of c.notes.split(/\n+/).map((x) => x.trim()).filter(Boolean)) { put(r++, para, { name: "Arial", size: 9 }); }
    r++;
  }
  r += 2;
  const sigs = c ? c.signatures : ["Prepared by" + (input.preparedBy ? `: ${input.preparedBy}` : ""), "Verified by", "Client approval (name, signature, stamp)"];
  const step = Math.max(1, Math.floor(n / Math.max(sigs.length, 1)));
  sigs.forEach((label, i) => {
    const cell = ws.getCell(r, Math.min(n, 1 + i * step)); cell.value = label; cell.font = bold; cell.border = { top: thin };
  });
  if (c?.footer) { const f = ws.getCell(r + 2, 1); f.value = c.footer; f.font = { name: "Arial", size: 8, color: { argb: "FF555555" } }; }
  return Buffer.from(await wb.xlsx.writeBuffer());
}
