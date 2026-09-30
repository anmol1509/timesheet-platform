import ExcelJS from "exceljs";

const MONTH_NAMES = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
];

export type DailyHourCell = {
  date: string | null; // ISO date "2025-05-01", if known
  label: string; // weekday abbreviation from header, e.g. "Thu"
  value: string; // raw cell text: a number as string, "A", "OFF", or other note
};

export type ParsedEntry = {
  employeeIdNo: string;
  employeeName: string;
  supplierName: string;
  clientName: string | null;
  /** The visa-holding company ("Sponsor" column), when the sheet has one. */
  sponsorName?: string | null;
  nationality?: string | null;
  site: string | null;
  siteId?: string | null;
  /** Project code or name from the sheet's Project column, when it has one. */
  projectName?: string | null;
  /** The worker's own hourly pay rate (not the billing Rate), when the sheet has a Pay Rate column. */
  payRate?: number | null;
  trade: string;
  rate: number;
  dailyHours: DailyHourCell[];
  totalHours: number;
  absentCount: number;
  invoiceValue: number;
};

export type SkippedRow = {
  sheetName: string;
  row: number;
  name: string;
  idNo: string;
  reason: string;
};

export type ParsedMonth = {
  sheetName: string;
  month: string; // "2025-05"
  monthLabel: string; // original sheet name, e.g. "MAY-25"
  entries: ParsedEntry[];
  skippedRows: number;
  skippedRowDetails: SkippedRow[];
};

export type ImportWarning = {
  sheetName: string;
  employeeIdNo: string;
  employeeName: string;
  detail: string;
};

export type ParseResult = {
  months: ParsedMonth[];
  unrecognizedSheets: string[];
  zeroRateCount: number;
  zeroRateSample: ImportWarning[];
  implausibleHoursCount: number;
  implausibleHoursSample: ImportWarning[];
};

const MAX_WARNING_SAMPLE = 10;
const IMPLAUSIBLE_DAILY_HOURS = 24;

// Sanity checks that don't block the import (the data still gets saved),
// but flag rows likely caused by a parsing mismatch (e.g. the "Sale Rate"
// header incident) or a typo in the source sheet, so they get reviewed
// instead of silently trusted.
function computeImportWarnings(months: ParsedMonth[]): {
  zeroRateCount: number;
  zeroRateSample: ImportWarning[];
  implausibleHoursCount: number;
  implausibleHoursSample: ImportWarning[];
} {
  let zeroRateCount = 0;
  const zeroRateSample: ImportWarning[] = [];
  let implausibleHoursCount = 0;
  const implausibleHoursSample: ImportWarning[] = [];

  for (const month of months) {
    for (const entry of month.entries) {
      if (entry.rate === 0) {
        zeroRateCount++;
        if (zeroRateSample.length < MAX_WARNING_SAMPLE) {
          zeroRateSample.push({
            sheetName: month.sheetName,
            employeeIdNo: entry.employeeIdNo,
            employeeName: entry.employeeName,
            detail: "Rate parsed as 0",
          });
        }
      }
      for (const day of entry.dailyHours) {
        const num = Number(day.value);
        if (day.value === "" || Number.isNaN(num)) continue;
        if (num < 0 || num > IMPLAUSIBLE_DAILY_HOURS) {
          implausibleHoursCount++;
          if (implausibleHoursSample.length < MAX_WARNING_SAMPLE) {
            implausibleHoursSample.push({
              sheetName: month.sheetName,
              employeeIdNo: entry.employeeIdNo,
              employeeName: entry.employeeName,
              detail: `${day.date ?? day.label}: ${day.value} hours`,
            });
          }
        }
      }
    }
  }

  return { zeroRateCount, zeroRateSample, implausibleHoursCount, implausibleHoursSample };
}

function parseMonthFromSheetName(
  name: string
): { month: string; monthLabel: string } | null {
  const match = name.trim().match(/([A-Za-z]{3,})[\s\-_/]*'?\s*(\d{2,4})/);
  if (!match) return null;
  const monIdx = MONTH_NAMES.indexOf(match[1].slice(0, 3).toLowerCase());
  if (monIdx === -1) return null;
  let year = parseInt(match[2], 10);
  if (Number.isNaN(year)) return null;
  if (year < 100) year += 2000;
  const mm = String(monIdx + 1).padStart(2, "0");
  return { month: `${year}-${mm}`, monthLabel: name.trim() };
}

function cellText(cell: ExcelJS.Cell | undefined): string {
  if (!cell || cell.value == null) return "";
  const v = cell.value;
  if (v instanceof Date) return "";
  if (typeof v === "object" && v !== null && "richText" in v) {
    return (v as { richText: { text: string }[] }).richText
      .map((t) => t.text)
      .join("")
      .trim();
  }
  if (typeof v === "object" && v !== null && "result" in v) {
    const result = (v as { result?: unknown }).result;
    return result == null ? "" : String(result).trim();
  }
  return String(v).trim();
}

function cellDate(cell: ExcelJS.Cell | undefined): Date | null {
  if (!cell || cell.value == null) return null;
  const v = cell.value;
  // Excel sometimes hands back an invalid Date for a formula cell it can't evaluate.
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v;
  return null;
}

function cellNumber(cell: ExcelJS.Cell | undefined): number | null {
  if (!cell || cell.value == null) return null;
  const v = cell.value;
  if (typeof v === "number") return v;
  if (typeof v === "object" && v !== null && "result" in v) {
    const result = (v as { result?: unknown }).result;
    if (typeof result === "number") return result;
  }
  return null;
}

type ColumnMap = {
  idNo: number | null;
  name: number | null;
  supplier: number | null;
  sponsor: number | null;
  nationality: number | null;
  client: number | null;
  site: number | null;
  project: number | null;
  payRate: number | null;
  trade: number | null;
  rate: number | null;
  total: number | null;
  absentCount: number | null;
  absentDeduction: number | null;
  invoiceValue: number | null;
};

const HEADER_PATTERNS: [keyof ColumnMap, RegExp][] = [
  ["idNo", /^i\.?\s*d\.?\s*no\.?$/i],
  ["name", /employee\s*name/i],
  // Sheets label the supplying company "Supplier", "Main Supplier" or
  // "Supplier Name" ("Supplier Code" is a different column).
  ["supplier", /^(main\s*supplier|supplier(\s*name)?)$/i],
  ["sponsor", /^sponsor(\s*(name|company))?$/i],
  ["nationality", /^nationality$/i],
  ["client", /client\s*name/i],
  ["site", /^site$/i],
  ["project", /^project(\s*(code|name))?$/i],
  // The worker's own pay per hour, for payroll. Deliberately not "Rate", which is what the client is billed.
  ["payRate", /^(pay\s*rate(\s*\/?\s*(hr|hour))?|hourly\s*pay(\s*rate)?)$/i],
  ["trade", /^trade$/i],
  // The billing rate column is labeled "Rate" or "Sale Rate" depending on
  // the sheet. Matched as an exact phrase so it never picks up "Purchase
  // rate" (the company's cost rate, a different column entirely).
  ["rate", /^(sale\s*rate|rate)$/i],
  ["total", /^total$/i],
  ["absentCount", /no\.?\s*of\s*absent/i],
  ["absentDeduction", /absent\s*deduction/i],
  ["invoiceValue", /invoice\s*value/i],
];

export type TimesheetColumnKey = keyof ColumnMap;
/** Header text chosen by hand for a column the detector missed, by field. */
export type TimesheetOverrides = Partial<Record<TimesheetColumnKey, string>>;

const normHeader = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");

function emptyColMap(): ColumnMap {
  return {
    idNo: null, name: null, supplier: null, sponsor: null, nationality: null, client: null, site: null, project: null, payRate: null,
    trade: null, rate: null, total: null, absentCount: null, absentDeduction: null, invoiceValue: null,
  };
}

/** Which column holds what, by the header's wording — then any that were picked by hand. */
function detectColumns(sheet: ExcelJS.Worksheet, headerRowNum: number, overrides: TimesheetOverrides = {}): ColumnMap {
  const headerRow = sheet.getRow(headerRowNum);
  const colMap = emptyColMap();
  const lastCol = sheet.columnCount;
  for (let c = 1; c <= lastCol; c++) {
    const text = cellText(headerRow.getCell(c));
    if (!text) continue;
    for (const [key, pattern] of HEADER_PATTERNS) {
      if (colMap[key] == null && pattern.test(text)) {
        colMap[key] = c;
        break;
      }
    }
  }
  for (const [key, wanted] of Object.entries(overrides) as [TimesheetColumnKey, string][]) {
    if (!wanted) continue;
    for (let c = 1; c <= lastCol; c++) {
      if (normHeader(cellText(headerRow.getCell(c))) === normHeader(wanted)) {
        colMap[key] = c;
        break;
      }
    }
  }
  return colMap;
}

export type TimesheetSheetInfo = {
  sheet: string;
  month: string | null;
  headerRow: number | null;
  headers: string[];
  /** For each field, the header text of the column that was detected, or null. */
  detected: Record<string, string | null>;
  /** Data rows under the header (a rough count, for the review screen). */
  rows: number;
};

/** What the parser sees in each sheet, without importing anything. */
export async function describeTimesheetWorkbook(buffer: Buffer, overrides: TimesheetOverrides = {}): Promise<TimesheetSheetInfo[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  const out: TimesheetSheetInfo[] = [];
  for (const sheet of workbook.worksheets) {
    const monthInfo = parseMonthFromSheetName(sheet.name);
    const headerRowNum = findHeaderRow(sheet);
    if (!headerRowNum) {
      out.push({ sheet: sheet.name, month: monthInfo?.month ?? null, headerRow: null, headers: [], detected: {}, rows: 0 });
      continue;
    }
    const headerRow = sheet.getRow(headerRowNum);
    const headers: string[] = [];
    for (let c = 1; c <= sheet.columnCount; c++) {
      const t = cellText(headerRow.getCell(c));
      if (t && !headers.includes(t)) headers.push(t);
    }
    const colMap = detectColumns(sheet, headerRowNum, overrides);
    const detected: Record<string, string | null> = {};
    for (const key of ["idNo", "name", "supplier", "sponsor", "client", "site", "project", "trade", "rate", "payRate", "nationality"] as const) {
      detected[key] = colMap[key] ? cellText(headerRow.getCell(colMap[key]!)) || null : null;
    }
    out.push({ sheet: sheet.name, month: monthInfo?.month ?? null, headerRow: headerRowNum, headers, detected, rows: Math.max(0, sheet.rowCount - headerRowNum - 1) });
  }
  return out;
}

function findHeaderRow(sheet: ExcelJS.Worksheet): number | null {
  for (let r = 1; r <= Math.min(10, sheet.rowCount); r++) {
    const row = sheet.getRow(r);
    for (let c = 1; c <= Math.min(20, sheet.columnCount); c++) {
      if (/employee\s*name/i.test(cellText(row.getCell(c)))) {
        return r;
      }
    }
  }
  return null;
}

// Different staff often type the same trade with inconsistent casing
// ("Steel Fixer" vs "STEEL FIXER"). Merge those to a single canonical label
// (first-seen casing wins) so summaries group them together.
function normalizeTradeCasing(entries: ParsedEntry[]) {
  const canonical = new Map<string, string>();
  for (const entry of entries) {
    const key = entry.trade.trim().toLowerCase();
    const existing = canonical.get(key);
    if (existing) {
      entry.trade = existing;
    } else {
      canonical.set(key, entry.trade);
    }
  }
}

// The same employee/trade sometimes appears on two separate rows within one
// month (e.g. moved between client sites mid-month and the old row was left
// behind, or someone re-entered the row with a corrected rate instead of
// editing it in place). Merge those into a single entry by taking, for each
// day, the last non-blank value across the group, and the last row's rate —
// otherwise the second row would silently overwrite the first one's hours on
// import, or the two would collide as separate database rows and double-count
// the employee's hours.
function mergeDuplicateRows(entries: ParsedEntry[]): ParsedEntry[] {
  const groups = new Map<string, ParsedEntry[]>();
  for (const entry of entries) {
    const key = `${entry.supplierName.trim().toLowerCase()}||${entry.employeeIdNo.trim().toUpperCase()}||${entry.trade.trim().toLowerCase()}`;
    const group = groups.get(key);
    if (group) group.push(entry);
    else groups.set(key, [entry]);
  }

  const merged: ParsedEntry[] = [];
  for (const group of groups.values()) {
    if (group.length === 1) {
      merged.push(group[0]);
      continue;
    }
    const base = { ...group[0], rate: group[group.length - 1].rate };
    const dailyHours = base.dailyHours.map((cell, i) => {
      for (let g = group.length - 1; g >= 0; g--) {
        const candidate = group[g].dailyHours[i];
        if (candidate && candidate.value !== "") return candidate;
      }
      return cell;
    });
    for (let g = group.length - 1; g >= 0; g--) {
      if (group[g].clientName) {
        base.clientName = group[g].clientName;
        break;
      }
    }
    let totalHours = 0;
    let absentCount = 0;
    for (const cell of dailyHours) {
      const num = Number(cell.value);
      if (cell.value !== "" && !Number.isNaN(num)) totalHours += num;
      else if (/^a$/i.test(cell.value)) absentCount++;
    }
    merged.push({
      ...base,
      dailyHours,
      totalHours,
      absentCount,
      invoiceValue: base.rate * totalHours,
    });
  }
  return merged;
}

export async function parseConsolidatedWorkbook(
  buffer: Buffer,
  overrides: TimesheetOverrides = {}
): Promise<ParseResult> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);

  const months: ParsedMonth[] = [];
  const unrecognizedSheets: string[] = [];

  for (const sheet of workbook.worksheets) {
    const monthInfo = parseMonthFromSheetName(sheet.name);
    if (!monthInfo) {
      unrecognizedSheets.push(sheet.name);
      continue;
    }

    const headerRowNum = findHeaderRow(sheet);
    if (!headerRowNum) {
      unrecognizedSheets.push(sheet.name);
      continue;
    }

    const headerRow = sheet.getRow(headerRowNum);
    const lastCol = sheet.columnCount;
    const colMap = detectColumns(sheet, headerRowNum, overrides);

    // Day columns sit strictly between "total" and the next known trailing
    // column (absentCount / absentDeduction / invoiceValue), whichever comes
    // first after it.
    const trailingCols = [
      colMap.absentCount,
      colMap.absentDeduction,
      colMap.invoiceValue,
    ].filter((v): v is number => v != null);
    const dayStart = (colMap.total ?? colMap.rate ?? 0) + 1;
    const dayEnd =
      trailingCols.length > 0 ? Math.min(...trailingCols) - 1 : lastCol;

    // The row directly below the header usually carries actual dates.
    const dateRow = sheet.getRow(headerRowNum + 1);
    let hasDateRow = false;
    for (let c = dayStart; c <= dayEnd; c++) {
      if (cellDate(dateRow.getCell(c))) {
        hasDateRow = true;
        break;
      }
    }

    const WEEKDAY_ABBR = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    // Formula-driven date cells often come back broken (1899-12-31, or nothing
    // at all) for the first days of the month while the rest are right. Day
    // columns run one day apiece, so a broken one is worked out from a good
    // one; with none, the first day column is the 1st of the sheet's month.
    const dateAt = new Map<number, Date>();
    if (hasDateRow) {
      for (let c = dayStart; c <= dayEnd; c++) {
        const d = cellDate(dateRow.getCell(c));
        if (d && d.getUTCFullYear() >= 2000) dateAt.set(c, d);
      }
    }
    const DAY_MS = 86_400_000;
    let anchor: { col: number; date: Date } | null = null;
    for (const [c, d] of dateAt) {
      anchor = { col: c, date: d };
      break;
    }
    if (!anchor && hasDateRow) {
      const [yy, mm] = monthInfo.month.split("-").map(Number);
      anchor = { col: dayStart, date: new Date(Date.UTC(yy, mm - 1, 1)) };
    }
    const dayCols: { col: number; date: Date | null; label: string }[] = [];
    for (let c = dayStart; c <= dayEnd; c++) {
      const date = hasDateRow
        ? (dateAt.get(c) ?? (anchor ? new Date(anchor.date.getTime() + (c - anchor.col) * DAY_MS) : null))
        : null;
      const label = date ? WEEKDAY_ABBR[date.getUTCDay()] : cellText(headerRow.getCell(c));
      if (!label && !date) continue;
      dayCols.push({ col: c, date, label: label || "" });
    }

    const dataStart = headerRowNum + (hasDateRow ? 2 : 1);
    const entries: ParsedEntry[] = [];
    let skippedRows = 0;
    const skippedRowDetails: SkippedRow[] = [];

    for (let r = dataStart; r <= sheet.rowCount; r++) {
      const row = sheet.getRow(r);
      const name = colMap.name ? cellText(row.getCell(colMap.name)) : "";
      const idNo = colMap.idNo ? cellText(row.getCell(colMap.idNo)) : "";
      const sponsorName = colMap.sponsor ? cellText(row.getCell(colMap.sponsor)) || null : null;
      // A blank supplier falls back to the sponsor: a worker's visa company is
      // the next best answer to "whose worker is this".
      const supplierName =
        (colMap.supplier ? cellText(row.getCell(colMap.supplier)) : "") || sponsorName || "";

      if (!name && !idNo) continue; // blank separator row
      if (!supplierName) {
        skippedRows++;
        skippedRowDetails.push({
          sheetName: sheet.name,
          row: r,
          name: name || "(unnamed)",
          idNo: idNo || "(no ID)",
          reason: colMap.supplier
            ? "Missing company name"
            : 'This sheet has no "Supplier" or "Main Supplier" column (or a "Sponsor" column) to take the company from.',
        });
        continue;
      }

      const clientName = colMap.client
        ? cellText(row.getCell(colMap.client)) || null
        : null;
      const site = colMap.site ? cellText(row.getCell(colMap.site)) || null : null;
      const projectName = colMap.project ? cellText(row.getCell(colMap.project)) || null : null;
      const payRate = colMap.payRate ? cellNumber(row.getCell(colMap.payRate)) : null;
      const trade = colMap.trade ? cellText(row.getCell(colMap.trade)) : "";
      const rate = colMap.rate ? cellNumber(row.getCell(colMap.rate)) ?? 0 : 0;

      const dailyHours: DailyHourCell[] = [];
      let totalHours = 0;
      let absentCount = 0;
      for (const dc of dayCols) {
        const cell = row.getCell(dc.col);
        const num = cellNumber(cell);
        const text = cellText(cell);
        if (num != null) {
          totalHours += num;
        } else if (/^a$/i.test(text)) {
          absentCount++;
        }
        dailyHours.push({
          date: dc.date ? dc.date.toISOString().slice(0, 10) : null,
          label: dc.label,
          value: num != null ? String(num) : text,
        });
      }

      entries.push({
        employeeIdNo: (idNo || `NOID-${name}-${r}`).trim(),
        employeeName: name || "(unnamed)",
        supplierName,
        clientName,
        sponsorName,
        nationality: colMap.nationality ? cellText(row.getCell(colMap.nationality)) || null : null,
        site,
        projectName,
        payRate: payRate != null && payRate > 0 ? payRate : null,
        trade: trade || "(unspecified)",
        rate,
        dailyHours,
        totalHours,
        absentCount,
        invoiceValue: rate * totalHours,
      });
    }

    normalizeTradeCasing(entries);
    const mergedEntries = mergeDuplicateRows(entries);

    months.push({
      sheetName: sheet.name,
      month: monthInfo.month,
      monthLabel: monthInfo.monthLabel,
      entries: mergedEntries,
      skippedRows,
      skippedRowDetails,
    });
  }

  const warnings = computeImportWarnings(months);
  return { months, unrecognizedSheets, ...warnings };
}
