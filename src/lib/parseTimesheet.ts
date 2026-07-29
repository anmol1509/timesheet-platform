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
  site: string | null;
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

export type ParseResult = {
  months: ParsedMonth[];
  unrecognizedSheets: string[];
};

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
  if (v instanceof Date) return v;
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
  client: number | null;
  site: number | null;
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
  ["supplier", /^supplier$/i],
  ["client", /client\s*name/i],
  ["site", /^site$/i],
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
    const key = `${entry.supplierName.trim().toLowerCase()}||${entry.employeeIdNo}||${entry.trade}`;
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
  buffer: Buffer
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
    const colMap: ColumnMap = {
      idNo: null,
      name: null,
      supplier: null,
      client: null,
      site: null,
      trade: null,
      rate: null,
      total: null,
      absentCount: null,
      absentDeduction: null,
      invoiceValue: null,
    };

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
    const dayCols: { col: number; date: Date | null; label: string }[] = [];
    for (let c = dayStart; c <= dayEnd; c++) {
      const date = hasDateRow ? cellDate(dateRow.getCell(c)) : null;
      let label = date ? WEEKDAY_ABBR[date.getUTCDay()] : cellText(headerRow.getCell(c));
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
      const supplierName = colMap.supplier
        ? cellText(row.getCell(colMap.supplier))
        : "";

      if (!name && !idNo) continue; // blank separator row
      if (!supplierName) {
        skippedRows++;
        skippedRowDetails.push({
          sheetName: sheet.name,
          row: r,
          name: name || "(unnamed)",
          idNo: idNo || "(no ID)",
          reason: "Missing company name",
        });
        continue;
      }

      const clientName = colMap.client
        ? cellText(row.getCell(colMap.client)) || null
        : null;
      const site = colMap.site ? cellText(row.getCell(colMap.site)) || null : null;
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
        employeeIdNo: idNo || `NOID-${name}-${r}`,
        employeeName: name || "(unnamed)",
        supplierName,
        clientName,
        site,
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

  return { months, unrecognizedSheets };
}
