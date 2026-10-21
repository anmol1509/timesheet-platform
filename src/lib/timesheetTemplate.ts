import ExcelJS from "exceljs";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

/**
 * Blank, client-ready labour supply timesheet for the free download page, laid out as
 * described in the blog post "Construction timesheet format for labour supply":
 * header (supplier, client, project, period), a roster with one row per worker and one
 * column per day, attendance codes with a legend, a summary by trade and project, three
 * sign-offs and a notes block. Not tied to any company's data.
 */
const WORKER_ROWS = 25;
const SUMMARY_ROWS = 8;
const LEGEND = "Numbers = hours worked   ·   A = Absent   ·   W = Weekly off day   ·   H = Public holiday";
const NOTES = [
  "Invoice to be submitted within ____ days of receiving this signed timesheet.",
  "This timesheet must be attached to the invoice, and the totals must match it.",
  "Missing or disputed hours to be reported within ____ days of receipt.",
];

const THIN = { style: "thin" as const, color: { argb: "FF94A3B8" } };
const BOX = { top: THIN, left: THIN, bottom: THIN, right: THIN };
const NAVY = "FF0A1530";
const LABEL_FILL = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFEEF2F7" } };
const HEAD_FILL = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: NAVY } };

function col(n: number): string {
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export async function buildTimesheetTemplateXlsx(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "ManpowerSync";
  wb.title = "Labour supply timesheet template";

  // ---- Sheet 1: header + roster -----------------------------------------------------
  const ws = wb.addWorksheet("Timesheet", {
    views: [{ state: "frozen", xSplit: 5, ySplit: 9 }],
    pageSetup: { orientation: "landscape", paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  const DAY0 = 6; // column F is day 1
  const LAST_DAY = DAY0 + 30; // AJ
  const ABSENT = LAST_DAY + 1;
  const REMARKS = LAST_DAY + 2;
  const widths: Record<number, number> = { 1: 5, 2: 12, 3: 26, 4: 14, 5: 9, [ABSENT]: 9, [REMARKS]: 20 };
  for (let c = 1; c <= REMARKS; c++) ws.getColumn(c).width = widths[c] ?? 4.2;

  ws.mergeCells(1, 1, 1, REMARKS);
  const title = ws.getCell(1, 1);
  title.value = "TIMESHEET — LABOUR SUPPLY";
  title.font = { name: "Arial", size: 16, bold: true, color: { argb: "FFFFFFFF" } };
  title.fill = HEAD_FILL;
  title.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  ws.getRow(1).height = 30;

  // Header block: label / value pairs. Period start and end drive the day numbers and weekdays below.
  // [row, label from col, label to col, label, value to col, number format]
  const fields: [number, number, number, string, number, string?][] = [
    [3, 1, 2, "Supplier", 8],
    [3, 11, 14, "Client", 26],
    [4, 1, 2, "Project / site", 8],
    [4, 11, 14, "Period from", 19, "dd mmm yyyy"],
    [4, 20, 21, "to", 26, "dd mmm yyyy"],
    [5, 1, 2, "Prepared by", 8],
    [5, 11, 14, "Client ref. / LPO", 26],
  ];
  const cells: Record<string, string> = {};
  for (const [row, c0, labelEnd, label, vEnd, fmt] of fields) {
    const vStart = labelEnd + 1;
    ws.mergeCells(row, c0, row, labelEnd);
    const l = ws.getCell(row, c0);
    l.value = label;
    l.font = { name: "Arial", size: 9, bold: true };
    l.fill = LABEL_FILL;
    l.alignment = { vertical: "middle", indent: 1 };
    for (let c = c0; c <= labelEnd; c++) ws.getCell(row, c).border = BOX;
    ws.mergeCells(row, vStart, row, vEnd);
    for (let c = vStart; c <= vEnd; c++) ws.getCell(row, c).border = BOX;
    const v = ws.getCell(row, vStart);
    v.font = { name: "Arial", size: 10 };
    v.alignment = { vertical: "middle", indent: 1 };
    if (fmt) v.numFmt = fmt;
    cells[label] = `${col(vStart)}${row}`;
  }
  const start = `$${cells["Period from"].replace(/(\d+)/, "$$$1")}`;
  const end = `$${cells["to"].replace(/(\d+)/, "$$$1")}`;

  // Roster header: row 8 = S#, ID, name, trade, total + day numbers; row 9 = weekday.
  const HEAD_ROW = 8;
  const DAY_ROW = 9;
  const heads = ["S#", "ID no.", "Employee name", "Trade", "Total hrs"];
  heads.forEach((h, i) => {
    ws.mergeCells(HEAD_ROW, i + 1, DAY_ROW, i + 1);
    ws.getCell(HEAD_ROW, i + 1).value = h;
  });
  ws.mergeCells(HEAD_ROW, ABSENT, DAY_ROW, ABSENT);
  ws.getCell(HEAD_ROW, ABSENT).value = "Absent days";
  ws.mergeCells(HEAD_ROW, REMARKS, DAY_ROW, REMARKS);
  ws.getCell(HEAD_ROW, REMARKS).value = "Remarks";
  for (let k = 0; k < 31; k++) {
    const c = DAY0 + k;
    ws.getCell(HEAD_ROW, c).value = { formula: `IF(OR(${start}="",${start}+${k}>${end}),"",DAY(${start}+${k}))` };
    ws.getCell(DAY_ROW, c).value = { formula: `IF(OR(${start}="",${start}+${k}>${end}),"",LEFT(TEXT(${start}+${k},"ddd"),2))` };
  }
  for (let r = HEAD_ROW; r <= DAY_ROW; r++) {
    for (let c = 1; c <= REMARKS; c++) {
      const cell = ws.getCell(r, c);
      cell.font = { name: "Arial", size: c >= DAY0 && c <= LAST_DAY ? 8 : 9, bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = HEAD_FILL;
      cell.border = BOX;
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    }
  }

  // Worker rows
  const first = DAY_ROW + 1;
  const lastRow = first + WORKER_ROWS - 1;
  const dayRange = (r: number) => `${col(DAY0)}${r}:${col(LAST_DAY)}${r}`;
  for (let i = 0; i < WORKER_ROWS; i++) {
    const r = first + i;
    ws.getCell(r, 1).value = i + 1;
    ws.getCell(r, 5).value = { formula: `SUM(${dayRange(r)})` };
    ws.getCell(r, ABSENT).value = { formula: `COUNTIF(${dayRange(r)},"A")` };
    for (let c = 1; c <= REMARKS; c++) {
      const cell = ws.getCell(r, c);
      cell.border = BOX;
      cell.font = { name: "Arial", size: c >= DAY0 && c <= LAST_DAY ? 9 : 10, bold: c === 5 };
      cell.alignment = { horizontal: c === 3 || c === 4 || c === REMARKS ? "left" : "center", vertical: "middle" };
    }
    ws.getRow(r).height = 18;
  }
  // Totals row
  const totRow = lastRow + 1;
  ws.mergeCells(totRow, 1, totRow, 4);
  ws.getCell(totRow, 1).value = "TOTAL";
  ws.getCell(totRow, 5).value = { formula: `SUM(E${first}:E${lastRow})` };
  for (let c = DAY0; c <= LAST_DAY; c++) ws.getCell(totRow, c).value = { formula: `SUM(${col(c)}${first}:${col(c)}${lastRow})` };
  ws.getCell(totRow, ABSENT).value = { formula: `SUM(${col(ABSENT)}${first}:${col(ABSENT)}${lastRow})` };
  for (let c = 1; c <= REMARKS; c++) {
    const cell = ws.getCell(totRow, c);
    cell.border = BOX;
    cell.fill = LABEL_FILL;
    cell.font = { name: "Arial", size: c >= DAY0 && c <= LAST_DAY ? 8 : 10, bold: true };
    cell.alignment = { horizontal: "center", vertical: "middle" };
  }
  ws.getCell(totRow, 1).alignment = { horizontal: "right", vertical: "middle", indent: 1 };

  // Colour the codes so a page is readable at a glance.
  const body = `${col(DAY0)}${first}:${col(LAST_DAY)}${lastRow}`;
  const rules: [string, string][] = [["A", "FFFEE2E2"], ["W", "FFE5E7EB"], ["H", "FFDBEAFE"]];
  ws.addConditionalFormatting({
    ref: body,
    rules: rules.map(([code, argb], i) => ({
      type: "cellIs" as const,
      operator: "equal" as const,
      formulae: [`"${code}"`],
      priority: i + 1,
      style: { fill: { type: "pattern" as const, pattern: "solid" as const, bgColor: { argb } } },
    })),
  });

  const legendRow = totRow + 2;
  ws.mergeCells(legendRow, 1, legendRow, REMARKS);
  ws.getCell(legendRow, 1).value = LEGEND;
  ws.getCell(legendRow, 1).font = { name: "Arial", size: 9, italic: true, color: { argb: "FF475569" } };
  ws.getCell(legendRow + 1, 1).value = "Dates and weekdays fill in from the period above. Type hours (or A, W, H) into each day. Totals calculate for you.";
  ws.getCell(legendRow + 1, 1).font = { name: "Arial", size: 9, italic: true, color: { argb: "FF475569" } };
  ws.pageSetup.printArea = `A1:${col(REMARKS)}${legendRow + 1}`;

  // ---- Sheet 2: summary, sign-off, notes --------------------------------------------
  const sm = wb.addWorksheet("Summary & sign-off", {
    pageSetup: { orientation: "portrait", paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  [28, 24, 12, 14, 16].forEach((w, i) => (sm.getColumn(i + 1).width = w));
  sm.mergeCells("A1:E1");
  const t2 = sm.getCell("A1");
  t2.value = "SUMMARY BY TRADE AND PROJECT";
  t2.font = { name: "Arial", size: 14, bold: true, color: { argb: "FFFFFFFF" } };
  t2.fill = HEAD_FILL;
  t2.alignment = { vertical: "middle", indent: 1 };
  sm.getRow(1).height = 28;
  sm.getCell("A2").value = "Group the hours from the Timesheet sheet by trade and project. These totals are what the invoice is built from.";
  sm.getCell("A2").font = { name: "Arial", size: 9, italic: true, color: { argb: "FF475569" } };

  ["Trade", "Project", "Hours", "Rate (AED)", "Amount (AED)"].forEach((h, i) => {
    const c = sm.getCell(4, i + 1);
    c.value = h;
    c.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = HEAD_FILL;
    c.border = BOX;
    c.alignment = { horizontal: i < 2 ? "left" : "center", vertical: "middle" };
  });
  const s0 = 5;
  const s1 = s0 + SUMMARY_ROWS - 1;
  for (let r = s0; r <= s1; r++) {
    sm.getCell(r, 5).value = { formula: `IF(OR(C${r}="",D${r}=""),"",ROUND(C${r}*D${r},2))` };
    sm.getCell(r, 4).numFmt = "#,##0.00";
    sm.getCell(r, 5).numFmt = "#,##0.00";
    for (let c = 1; c <= 5; c++) {
      sm.getCell(r, c).border = BOX;
      sm.getCell(r, c).font = { name: "Arial", size: 10 };
    }
  }
  const money = "#,##0.00";
  const line = (r: number, label: string, value: ExcelJS.CellValue, opts: { bold?: boolean; fmt?: string; input?: boolean } = {}) => {
    sm.mergeCells(r, 1, r, 4);
    sm.getCell(r, 1).value = label;
    sm.getCell(r, 1).alignment = { horizontal: "right", indent: 1 };
    sm.getCell(r, 5).value = value;
    sm.getCell(r, 5).numFmt = opts.fmt ?? money;
    for (let c = 1; c <= 5; c++) {
      sm.getCell(r, c).border = BOX;
      sm.getCell(r, c).font = { name: "Arial", size: 10, bold: opts.bold };
      if (opts.bold) sm.getCell(r, c).fill = LABEL_FILL;
    }
  };
  const r0 = s1 + 1;
  line(r0, "Sub-total", { formula: `SUM(E${s0}:E${s1})` }, { bold: true });
  line(r0 + 1, "Additions / (deductions) allowed by the contract", null);
  line(r0 + 2, "Gross total", { formula: `E${r0}+E${r0 + 1}` }, { bold: true });
  line(r0 + 3, "VAT rate (edit if needed)", 0.05, { fmt: "0%" });
  line(r0 + 4, "VAT", { formula: `ROUND(E${r0 + 2}*E${r0 + 3},2)` });
  line(r0 + 5, "NET AMOUNT PAYABLE (AED)", { formula: `E${r0 + 2}+E${r0 + 4}` }, { bold: true });

  // Sign-off blocks
  const sg = r0 + 8;
  sm.getCell(sg, 1).value = "SIGN-OFF";
  sm.getCell(sg, 1).font = { name: "Arial", size: 11, bold: true };
  ["Prepared by (supplier)", "Verified by (supplier)", "Approved by (client)"].forEach((who, i) => {
    const r = sg + 1 + i * 4;
    sm.getCell(r, 1).value = who;
    sm.getCell(r, 1).font = { name: "Arial", size: 10, bold: true };
    for (const [j, label] of ["Name", "Signature", "Date"].entries()) {
      sm.getCell(r + 1, [1, 2, 4][j]).value = label + ":";
      sm.getCell(r + 1, [1, 2, 4][j]).font = { name: "Arial", size: 9, color: { argb: "FF475569" } };
    }
    for (const c of [1, 2, 3, 4, 5]) sm.getCell(r + 2, c).border = { bottom: THIN };
  });
  const nr = sg + 14;
  sm.getCell(nr, 1).value = "NOTES";
  sm.getCell(nr, 1).font = { name: "Arial", size: 11, bold: true };
  NOTES.forEach((n, i) => {
    sm.mergeCells(nr + 1 + i, 1, nr + 1 + i, 5);
    sm.getCell(nr + 1 + i, 1).value = `${i + 1}. ${n}`;
    sm.getCell(nr + 1 + i, 1).font = { name: "Arial", size: 10 };
  });

  return Buffer.from(await wb.xlsx.writeBuffer());
}

// ---- PDF: a printable blank of the same layout -----------------------------------------
export async function buildTimesheetTemplatePdf(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle("Labour supply timesheet template");
  pdf.setCreator("ManpowerSync");
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.1, 0.1, 0.1);
  const line = rgb(0.45, 0.5, 0.58);
  const navy = rgb(0.04, 0.08, 0.19);

  const W = 842, H = 595; // A4 landscape
  const M = 28;
  const text = (p: PDFPage, s: string, x: number, y: number, size = 8, f: PDFFont = font, color = ink) => p.drawText(s, { x, y, size, font: f, color });
  const box = (p: PDFPage, x: number, y: number, w: number, h: number, fill?: ReturnType<typeof rgb>) =>
    p.drawRectangle({ x, y, width: w, height: h, borderColor: line, borderWidth: 0.5, color: fill });

  // Page 1: header + roster
  const p1 = pdf.addPage([W, H]);
  p1.drawRectangle({ x: M, y: H - M - 24, width: W - 2 * M, height: 24, color: navy });
  text(p1, "TIMESHEET — LABOUR SUPPLY", M + 8, H - M - 16, 13, bold, rgb(1, 1, 1));

  const field = (label: string, x: number, y: number, w: number) => {
    box(p1, x, y, 70, 16, rgb(0.93, 0.95, 0.97));
    text(p1, label, x + 4, y + 5, 7.5, bold);
    box(p1, x + 70, y, w - 70, 16);
  };
  const fw = (W - 2 * M - 14) / 2;
  const top = H - M - 24 - 12;
  field("Supplier", M, top - 16, fw);
  field("Client", M + fw + 14, top - 16, fw);
  field("Project / site", M, top - 36, fw);
  field("Period from", M + fw + 14, top - 36, fw / 2 - 4);
  field("to", M + fw + 14 + fw / 2 + 4, top - 36, fw / 2 - 4);
  field("Prepared by", M, top - 56, fw);
  field("Client ref. / LPO", M + fw + 14, top - 56, fw);

  const colsFixed = [["S#", 20], ["ID no.", 46], ["Employee name", 120], ["Trade", 58], ["Total", 30]] as const;
  const dayW = 13.6;
  const tailW = [["Absent", 32], ["Remarks", 0]] as const; // remarks takes the rest
  const fixedW = colsFixed.reduce((s, [, w]) => s + w, 0);
  const remarksW = W - 2 * M - fixedW - 31 * dayW - tailW[0][1];
  let y = top - 56 - 16;
  const headH = 24;
  y -= headH;
  let x = M;
  for (const [label, w] of colsFixed) {
    box(p1, x, y, w, headH, navy);
    text(p1, label, x + 3, y + 9, 7, bold, rgb(1, 1, 1));
    x += w;
  }
  for (let d = 1; d <= 31; d++) {
    box(p1, x, y, dayW, headH, navy);
    text(p1, String(d), x + (d < 10 ? 5 : 2.5), y + 9, 6.5, bold, rgb(1, 1, 1));
    x += dayW;
  }
  box(p1, x, y, tailW[0][1], headH, navy);
  text(p1, "Absent", x + 3, y + 9, 6.5, bold, rgb(1, 1, 1));
  x += tailW[0][1];
  box(p1, x, y, remarksW, headH, navy);
  text(p1, "Remarks", x + 3, y + 9, 7, bold, rgb(1, 1, 1));

  const rowH = 15.2;
  const rows = 24;
  const bodyTop = y;
  for (let r = 0; r < rows; r++) {
    const ry = bodyTop - (r + 1) * rowH;
    let cx = M;
    for (const [label, w] of colsFixed) {
      box(p1, cx, ry, w, rowH);
      if (label === "S#") text(p1, String(r + 1), cx + 4, ry + 4.5, 7);
      cx += w;
    }
    for (let d = 0; d < 31; d++) { box(p1, cx, ry, dayW, rowH); cx += dayW; }
    box(p1, cx, ry, tailW[0][1], rowH); cx += tailW[0][1];
    box(p1, cx, ry, remarksW, rowH);
  }
  const tY = bodyTop - rows * rowH - rowH;
  box(p1, M, tY, W - 2 * M, rowH, rgb(0.93, 0.95, 0.97));
  text(p1, "TOTAL", M + 6, tY + 4.5, 7.5, bold);
  for (let d = 0; d < 31; d++) p1.drawLine({ start: { x: M + fixedW + d * dayW, y: tY }, end: { x: M + fixedW + d * dayW, y: tY + rowH }, thickness: 0.5, color: line });
  text(p1, "Numbers = hours worked   ·   A = Absent   ·   W = Weekly off day   ·   H = Public holiday", M, tY - 14, 8, font, rgb(0.28, 0.33, 0.41));

  // Page 2: summary, sign-off, notes
  const p2 = pdf.addPage([W, H]);
  p2.drawRectangle({ x: M, y: H - M - 24, width: W - 2 * M, height: 24, color: navy });
  text(p2, "SUMMARY BY TRADE AND PROJECT", M + 8, H - M - 16, 13, bold, rgb(1, 1, 1));
  const cols2 = [["Trade", 190], ["Project", 190], ["Hours", 80], ["Rate (AED)", 90], ["Amount (AED)", 120]] as const;
  let sy = H - M - 24 - 22;
  let sx = M;
  for (const [label, w] of cols2) {
    box(p2, sx, sy, w, 18, navy);
    text(p2, label, sx + 4, sy + 6, 8, bold, rgb(1, 1, 1));
    sx += w;
  }
  for (let r = 0; r < 7; r++) {
    sy -= 18;
    sx = M;
    for (const [, w] of cols2) { box(p2, sx, sy, w, 18); sx += w; }
  }
  const totals = ["Sub-total", "Additions / (deductions) allowed by the contract", "Gross total", "VAT (5%)", "NET AMOUNT PAYABLE (AED)"];
  const labW = 190 + 190 + 80 + 90;
  for (const t of totals) {
    sy -= 18;
    box(p2, M, sy, labW, 18, t.startsWith("NET") || t === "Sub-total" || t === "Gross total" ? rgb(0.93, 0.95, 0.97) : undefined);
    text(p2, t, M + labW - 6 - bold.widthOfTextAtSize(t, 8), sy + 6, 8, t.startsWith("NET") ? bold : font);
    box(p2, M + labW, sy, 120, 18);
  }
  let gy = sy - 38;
  text(p2, "SIGN-OFF", M, gy + 14, 10, bold);
  const bw = (W - 2 * M - 28) / 3;
  ["Prepared by (supplier)", "Verified by (supplier)", "Approved by (client)"].forEach((who, i) => {
    const bx = M + i * (bw + 14);
    box(p2, bx, gy - 78, bw, 86);
    text(p2, who, bx + 6, gy - 2, 8.5, bold);
    ["Name:", "Signature:", "Date:"].forEach((l, j) => {
      const ly = gy - 26 - j * 20;
      text(p2, l, bx + 6, ly, 7.5, font, rgb(0.28, 0.33, 0.41));
      p2.drawLine({ start: { x: bx + 56, y: ly - 2 }, end: { x: bx + bw - 8, y: ly - 2 }, thickness: 0.5, color: line });
    });
  });
  gy -= 112;
  text(p2, "NOTES", M, gy, 10, bold);
  NOTES.forEach((n, i) => text(p2, `${i + 1}. ${n}`, M, gy - 16 - i * 14, 9));

  return pdf.save();
}
