import ExcelJS from "exceljs";
import type { DailyHourCell } from "@/lib/parseTimesheet";

export type GenerateInput = {
  fullName: string;
  monthLabel: string;
  issuedTo: string;
  gasDeduction: number;
  entries: {
    employeeIdNo: string;
    employeeName: string;
    trade: string;
    rate: number;
    dailyHours: DailyHourCell[];
    absentDeduction: number;
  }[];
};

const THIN = { style: "thin" as const, color: { argb: "FFCBD5E1" } };
const BORDER_ALL = { top: THIN, left: THIN, bottom: THIN, right: THIN };
const FONT = "Arial";

function colLetter(col: number) {
  let s = "";
  while (col > 0) {
    const m = (col - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    col = Math.floor((col - 1) / 26);
  }
  return s;
}

export async function generateSupplierXlsx(input: GenerateInput): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Timesheet Platform";
  const sheet = wb.addWorksheet("Timesheet", {
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1 },
  });

  const dayCount = input.entries[0]?.dailyHours.length ?? 30;
  const SN_COL = 1;
  const ID_COL = 2;
  const NAME_COL = 3;
  const TRADE_COL = 4;
  const TOTAL_COL = 5;
  const DAY_START_COL = 6;
  const DAY_END_COL = DAY_START_COL + dayCount - 1;
  const ABSENT_COL = DAY_END_COL + 1;
  const DEDUCTION_COL = ABSENT_COL + 1;
  const LAST_COL = DEDUCTION_COL;

  sheet.getColumn(SN_COL).width = 5;
  sheet.getColumn(ID_COL).width = 11;
  sheet.getColumn(NAME_COL).width = 22;
  sheet.getColumn(TRADE_COL).width = 15;
  sheet.getColumn(TOTAL_COL).width = 8;
  for (let c = DAY_START_COL; c <= DAY_END_COL; c++) sheet.getColumn(c).width = 5.5;
  sheet.getColumn(ABSENT_COL).width = 9;
  sheet.getColumn(DEDUCTION_COL).width = 11;

  let r = 1;

  sheet.mergeCells(r, 1, r, LAST_COL);
  const titleCell = sheet.getCell(r, 1);
  titleCell.value = input.fullName.toUpperCase();
  titleCell.font = { name: FONT, bold: true, size: 14 };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  sheet.getRow(r).height = 22;
  r += 2;

  sheet.mergeCells(r, 1, r, LAST_COL);
  const subtitleCell = sheet.getCell(r, 1);
  subtitleCell.value = `Time Sheet For The Month Of ${input.monthLabel}`;
  subtitleCell.font = { name: FONT, bold: true, size: 12 };
  subtitleCell.alignment = { horizontal: "center" };
  r += 2;

  sheet.mergeCells(r, 1, r, LAST_COL);
  const issuedCell = sheet.getCell(r, 1);
  issuedCell.value = `Issued To : ${input.issuedTo}.`;
  issuedCell.font = { name: FONT, bold: true, size: 11 };
  r += 2;

  const WEEKDAY_ABBR = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const headerRow = r;
  const headerLabels: [number, string][] = [
    [SN_COL, "S. N."],
    [ID_COL, "I. D. No"],
    [NAME_COL, "EMPLOYEE NAME"],
    [TRADE_COL, "TRADE"],
    [TOTAL_COL, "TOTAL"],
    [ABSENT_COL, "No. Of Absent"],
    [DEDUCTION_COL, "Absent Deduction"],
  ];
  for (const [col, label] of headerLabels) {
    const cell = sheet.getCell(headerRow, col);
    cell.value = label;
  }
  for (let i = 0; i < dayCount; i++) {
    const cell = sheet.getCell(headerRow, DAY_START_COL + i);
    const dateStr = input.entries[0]?.dailyHours[i]?.date;
    cell.value = dateStr ? WEEKDAY_ABBR[new Date(dateStr + "T00:00:00Z").getUTCDay()] : "";
  }
  const dateRow = headerRow + 1;
  for (let i = 0; i < dayCount; i++) {
    const dateStr = input.entries[0]?.dailyHours[i]?.date;
    if (!dateStr) continue;
    const cell = sheet.getCell(dateRow, DAY_START_COL + i);
    cell.value = new Date(dateStr + "T00:00:00Z");
    cell.numFmt = "d-mmm";
    cell.font = { name: FONT, size: 8 };
    cell.alignment = { horizontal: "center" };
  }
  for (let c = 1; c <= LAST_COL; c++) {
    const cell = sheet.getCell(headerRow, c);
    cell.font = { name: FONT, bold: true, size: 9 };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
    cell.border = BORDER_ALL;
    sheet.getCell(dateRow, c).border = BORDER_ALL;
    sheet.getCell(dateRow, c).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF1F5F9" },
    };
  }
  sheet.getRow(headerRow).height = 28;

  const dataStartRow = dateRow + 1;
  let row = dataStartRow;
  const totalCellByRow: number[] = [];

  input.entries.forEach((entry, idx) => {
    sheet.getCell(row, SN_COL).value = idx + 1;
    sheet.getCell(row, ID_COL).value = entry.employeeIdNo;
    sheet.getCell(row, NAME_COL).value = entry.employeeName;
    sheet.getCell(row, TRADE_COL).value = entry.trade;

    for (let i = 0; i < dayCount; i++) {
      const cell = sheet.getCell(row, DAY_START_COL + i);
      const day = entry.dailyHours[i];
      const numeric = day && day.value !== "" && !Number.isNaN(Number(day.value));
      cell.value = numeric ? Number(day!.value) : day?.value || "";
      cell.alignment = { horizontal: "center" };
      cell.font = { name: FONT, size: 9 };
    }

    const dayStartLetter = colLetter(DAY_START_COL);
    const dayEndLetter = colLetter(DAY_END_COL);
    const totalCell = sheet.getCell(row, TOTAL_COL);
    totalCell.value = { formula: `SUM(${dayStartLetter}${row}:${dayEndLetter}${row})` };
    totalCellByRow.push(row);

    const absentCell = sheet.getCell(row, ABSENT_COL);
    absentCell.value = {
      formula: `COUNTIF(${dayStartLetter}${row}:${dayEndLetter}${row},"A")`,
    };

    sheet.getCell(row, DEDUCTION_COL).value = entry.absentDeduction;

    for (let c = 1; c <= LAST_COL; c++) {
      const cell = sheet.getCell(row, c);
      cell.border = BORDER_ALL;
      if (!cell.font) cell.font = { name: FONT, size: 9 };
    }
    sheet.getCell(row, NAME_COL).font = { name: FONT, size: 9, bold: true };
    sheet.getCell(row, TOTAL_COL).alignment = { horizontal: "center" };
    sheet.getCell(row, ABSENT_COL).alignment = { horizontal: "center" };
    sheet.getCell(row, DEDUCTION_COL).alignment = { horizontal: "right" };
    sheet.getCell(row, DEDUCTION_COL).numFmt = "#,##0.00";

    row++;
  });
  const dataEndRow = row - 1;

  row += 2;

  // Trade summary
  const summaryHeaderRow = row;
  const summaryLabels = ["TRADE", "HOUR", "RATE", "AMOUNT"];
  summaryLabels.forEach((label, i) => {
    const cell = sheet.getCell(summaryHeaderRow, NAME_COL + i);
    cell.value = label;
    cell.font = { name: FONT, bold: true, size: 10 };
    cell.border = BORDER_ALL;
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
  });
  row++;

  const tradeMap = new Map<string, { trade: string; rate: number; rows: number[] }>();
  input.entries.forEach((e, idx) => {
    const key = `${e.trade}__${e.rate}`;
    const existing = tradeMap.get(key);
    if (existing) existing.rows.push(totalCellByRow[idx]);
    else tradeMap.set(key, { trade: e.trade, rate: e.rate, rows: [totalCellByRow[idx]] });
  });

  const amountCells: number[] = [];
  const totalLetter = colLetter(TOTAL_COL);
  for (const { trade, rate, rows } of tradeMap.values()) {
    sheet.getCell(row, NAME_COL).value = trade;
    const hourCell = sheet.getCell(row, NAME_COL + 1);
    hourCell.value = { formula: `SUM(${rows.map((rr) => `${totalLetter}${rr}`).join(",")})` };
    const rateCell = sheet.getCell(row, NAME_COL + 2);
    rateCell.value = rate;
    rateCell.numFmt = "#,##0.00";
    const amountCell = sheet.getCell(row, NAME_COL + 3);
    const hourLetter = colLetter(NAME_COL + 1);
    const rateLetter = colLetter(NAME_COL + 2);
    amountCell.value = { formula: `${hourLetter}${row}*${rateLetter}${row}` };
    amountCell.numFmt = "#,##0.00";
    amountCells.push(row);

    for (let c = NAME_COL; c <= NAME_COL + 3; c++) {
      const cell = sheet.getCell(row, c);
      cell.border = BORDER_ALL;
      cell.font = { name: FONT, size: 10 };
    }
    row++;
  }

  row++;
  const amountLetter = colLetter(NAME_COL + 3);
  const totalAmountRow = row;
  sheet.getCell(row, NAME_COL + 2).value = "Total Amount AED";
  sheet.getCell(row, NAME_COL + 2).font = { name: FONT, bold: true, size: 10 };
  const totalAmountCell = sheet.getCell(row, NAME_COL + 3);
  totalAmountCell.value = {
    formula: `SUM(${amountCells.map((rr) => `${amountLetter}${rr}`).join(",")})`,
  };
  totalAmountCell.numFmt = "#,##0.00";
  totalAmountCell.font = { name: FONT, bold: true, size: 10 };
  row++;

  const deductionLetter = colLetter(DEDUCTION_COL);
  const absentDeductionRow = row;
  sheet.getCell(row, NAME_COL + 2).value = "Absent Deduction";
  const absentDeductionCell = sheet.getCell(row, NAME_COL + 3);
  absentDeductionCell.value = {
    formula: `SUM(${deductionLetter}${dataStartRow}:${deductionLetter}${dataEndRow})`,
  };
  absentDeductionCell.numFmt = "#,##0.00";
  row++;

  const gasDeductionRow = row;
  sheet.getCell(row, NAME_COL + 2).value = "Gas Deduction";
  sheet.getCell(row, NAME_COL + 3).value = input.gasDeduction;
  sheet.getCell(row, NAME_COL + 3).numFmt = "#,##0.00";
  row++;

  const totalDeductionRow = row;
  sheet.getCell(row, NAME_COL + 2).value = "Total Deduction AED";
  sheet.getCell(row, NAME_COL + 2).font = { name: FONT, bold: true, size: 10 };
  const totalDeductionCell = sheet.getCell(row, NAME_COL + 3);
  totalDeductionCell.value = {
    formula: `${amountLetter}${absentDeductionRow}+${amountLetter}${gasDeductionRow}`,
  };
  totalDeductionCell.numFmt = "#,##0.00";
  totalDeductionCell.font = { name: FONT, bold: true, size: 10 };
  row++;

  const netRow = row;
  sheet.getCell(row, NAME_COL + 2).value = "Net Amount Payable AED";
  sheet.getCell(row, NAME_COL + 2).font = { name: FONT, bold: true, size: 11 };
  const netCell = sheet.getCell(row, NAME_COL + 3);
  netCell.value = {
    formula: `${amountLetter}${totalAmountRow}-${amountLetter}${totalDeductionRow}`,
  };
  netCell.numFmt = "#,##0.00";
  netCell.font = { name: FONT, bold: true, size: 11 };
  row += 3;

  sheet.getCell(row, NAME_COL).value = "Prepared & Verified By";
  sheet.getCell(row, NAME_COL).font = { name: FONT, size: 10 };
  sheet.getCell(row, LAST_COL - 1).value = "Approved By:";
  sheet.getCell(row, LAST_COL - 1).font = { name: FONT, size: 10 };

  const arrayBuffer = await wb.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

export type ClientInvoiceXlsxInput = {
  invoiceNumber: string;
  issuedByName: string;
  issuedByTrn: string | null;
  monthLabel: string;
  issueDate: Date;
  dueDate: Date | null;
  clientName: string;
  clientTrn: string | null;
  clientBillingAddress: string | null;
  lines: {
    employeeIdNo: string;
    employeeName: string;
    trade: string;
    totalHours: number;
    billRate: number;
  }[];
};

export async function generateClientInvoiceXlsx(input: ClientInvoiceXlsxInput): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Timesheet Platform";
  const sheet = wb.addWorksheet("Invoice");

  sheet.getColumn(1).width = 24;
  sheet.getColumn(2).width = 16;
  sheet.getColumn(3).width = 18;
  sheet.getColumn(4).width = 12;
  sheet.getColumn(5).width = 14;

  let r = 1;
  sheet.mergeCells(r, 1, r, 3);
  sheet.getCell(r, 1).value = input.issuedByName;
  sheet.getCell(r, 1).font = { name: FONT, bold: true, size: 16 };
  sheet.getCell(r, 4).value = "TAX INVOICE";
  sheet.getCell(r, 4).font = { name: FONT, bold: true, size: 14 };
  r++;
  if (input.issuedByTrn) {
    sheet.getCell(r, 1).value = `TRN: ${input.issuedByTrn}`;
    sheet.getCell(r, 1).font = { name: FONT, size: 9 };
  }
  sheet.getCell(r, 4).value = `No: ${input.invoiceNumber}`;
  r++;
  sheet.getCell(r, 4).value = `Issued: ${input.issueDate.toLocaleDateString("en-GB")}`;
  r++;
  if (input.dueDate) {
    sheet.getCell(r, 4).value = `Due: ${input.dueDate.toLocaleDateString("en-GB")}`;
    r++;
  }
  sheet.getCell(r, 4).value = `Period: ${input.monthLabel}`;
  r += 2;

  sheet.getCell(r, 1).value = "BILL TO";
  sheet.getCell(r, 1).font = { name: FONT, bold: true, size: 9, color: { argb: "FF94A3B8" } };
  r++;
  sheet.getCell(r, 1).value = input.clientName;
  sheet.getCell(r, 1).font = { name: FONT, bold: true, size: 11 };
  r++;
  if (input.clientBillingAddress) {
    sheet.getCell(r, 1).value = input.clientBillingAddress;
    r++;
  }
  if (input.clientTrn) {
    sheet.getCell(r, 1).value = `TRN: ${input.clientTrn}`;
    r++;
  }
  r += 1;

  const headerRow = r;
  const headers = ["Employee", "ID No", "Trade", "Hours", "Rate (AED)", "Amount (AED)"];
  sheet.getColumn(6).width = 14;
  headers.forEach((label, i) => {
    const cell = sheet.getCell(headerRow, i + 1);
    cell.value = label;
    cell.font = { name: FONT, bold: true, size: 9, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF166534" } };
    cell.border = BORDER_ALL;
  });
  r++;

  const dataStartRow = r;
  for (const l of input.lines) {
    sheet.getCell(r, 1).value = l.employeeName;
    sheet.getCell(r, 2).value = l.employeeIdNo;
    sheet.getCell(r, 3).value = l.trade;
    sheet.getCell(r, 4).value = l.totalHours;
    sheet.getCell(r, 5).value = l.billRate;
    sheet.getCell(r, 5).numFmt = "#,##0.00";
    const amountCell = sheet.getCell(r, 6);
    amountCell.value = { formula: `D${r}*E${r}` };
    amountCell.numFmt = "#,##0.00";
    for (let c = 1; c <= 6; c++) {
      sheet.getCell(r, c).border = BORDER_ALL;
      if (!sheet.getCell(r, c).font) sheet.getCell(r, c).font = { name: FONT, size: 9 };
    }
    r++;
  }
  const dataEndRow = r - 1;
  r += 1;

  const subtotalRow = r;
  sheet.getCell(r, 5).value = "Subtotal";
  sheet.getCell(r, 5).font = { name: FONT, size: 9 };
  sheet.getCell(r, 5).alignment = { horizontal: "right" };
  sheet.getCell(r, 6).value =
    dataEndRow >= dataStartRow ? { formula: `SUM(F${dataStartRow}:F${dataEndRow})` } : 0;
  sheet.getCell(r, 6).numFmt = "#,##0.00";
  r++;

  const vatRow = r;
  sheet.getCell(r, 5).value = "VAT (5%)";
  sheet.getCell(r, 5).alignment = { horizontal: "right" };
  sheet.getCell(r, 6).value = { formula: `F${subtotalRow}*0.05` };
  sheet.getCell(r, 6).numFmt = "#,##0.00";
  r++;

  sheet.getCell(r, 5).value = "Total Due (AED)";
  sheet.getCell(r, 5).font = { name: FONT, bold: true, size: 11 };
  sheet.getCell(r, 5).alignment = { horizontal: "right" };
  const totalCell = sheet.getCell(r, 6);
  totalCell.value = { formula: `F${subtotalRow}+F${vatRow}` };
  totalCell.numFmt = "#,##0.00";
  totalCell.font = { name: FONT, bold: true, size: 11 };

  const arrayBuffer = await wb.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
