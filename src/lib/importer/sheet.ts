import ExcelJS from "exceljs";
import { Readable } from "node:stream";
import type { FieldDef, MappedRow, Mapping } from "./types";
import { scoreHeader } from "./mapping";

export type SheetInfo = {
  name: string;
  rowCount: number;
  headerRow: number;
  headers: string[];
  /** First few data rows, aligned to `headers`, for the mapping screen. */
  sample: string[][];
  dataRows: number;
  /** A single heading above the table (e.g. "CAMP NO. 01"), if there is one. */
  title?: string;
};

function cellText(v: unknown): string {
  if (v == null) return "";
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? "" : v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (Array.isArray(o.richText)) return o.richText.map((r) => String((r as { text?: string }).text ?? "")).join("").trim();
    if ("result" in o) return cellText(o.result);
    if ("text" in o) return cellText(o.text);
    return "";
  }
  return String(v).trim();
}

/** An .xlsx, or a .csv read as a one-sheet workbook. */
export async function loadWorkbook(buffer: Buffer | ArrayBuffer, filename = ""): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  if (/\.csv$/i.test(filename)) {
    await wb.csv.read(Readable.from(Buffer.from(buffer as ArrayBuffer)));
    return wb;
  }
  await wb.xlsx.load(buffer as ArrayBuffer);
  return wb;
}

function gridOf(ws: ExcelJS.Worksheet): string[][] {
  const width = ws.columnCount;
  const grid: string[][] = [];
  for (let r = 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const cells: string[] = [];
    for (let c = 1; c <= width; c++) cells.push(cellText(row.getCell(c).value));
    grid.push(cells);
  }
  return grid;
}

/** The header is the first of the top rows that names the most known fields;
 * failing that, the first row that is mostly text. */
export function detectHeaderRow(grid: string[][], fields: FieldDef[]): number {
  let best = { row: 0, hits: 0 };
  const limit = Math.min(grid.length, 20);
  for (let r = 0; r < limit; r++) {
    const cells = grid[r].filter(Boolean);
    if (cells.length < 2) continue;
    const hits = cells.filter((c) => fields.some((f) => scoreHeader(c, f) >= 0.86)).length;
    if (hits > best.hits) best = { row: r, hits };
  }
  if (best.hits > 0) return best.row + 1;
  for (let r = 0; r < limit; r++) {
    const cells = grid[r].filter(Boolean);
    if (cells.length >= 2 && cells.filter((c) => Number.isNaN(Number(c))).length / cells.length >= 0.8) return r + 1;
  }
  return 1;
}

function uniqueHeaders(row: string[]): string[] {
  const seen = new Map<string, number>();
  return row.map((h, i) => {
    const base = h || `Column ${i + 1}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return n === 1 ? base : `${base} (${n})`;
  });
}

export async function describeSheets(wb: ExcelJS.Workbook, fields: FieldDef[]): Promise<SheetInfo[]> {
  const out: SheetInfo[] = [];
  // A template's Example and Notes sheets are for reading, not importing (unless they are all there is).
  const helper = /^(example|examples|notes|instructions|lists)$/i;
  const real = wb.worksheets.filter((w) => !helper.test(w.name));
  for (const ws of real.length ? real : wb.worksheets) {
    if (ws.state !== "visible" || ws.rowCount === 0) continue;
    const grid = gridOf(ws);
    const headerRow = detectHeaderRow(grid, fields);
    const headers = uniqueHeaders(grid[headerRow - 1] ?? []);
    const data = grid.slice(headerRow).filter((r) => r.some(Boolean));
    // A merged heading repeats its text in every cell it spans, so count distinct values.
    const above = grid.slice(0, headerRow - 1).map((r) => [...new Set(r.filter(Boolean))]).filter((r) => r.length === 1).map((r) => r[0]);
    out.push({ name: ws.name, rowCount: ws.rowCount, headerRow, headers, sample: data.slice(0, 5), dataRows: data.length, title: above[above.length - 1] });
  }
  return out;
}

/** The sheet's data rows keyed by field, using the chosen columns. Row numbers are the sheet's own. */
export function extractRows(wb: ExcelJS.Workbook, mapping: Mapping, fields: FieldDef[]): MappedRow[] {
  const ws = mapping.sheet ? wb.getWorksheet(mapping.sheet) : wb.worksheets[0];
  if (!ws) return [];
  const grid = gridOf(ws);
  const headerRow = mapping.headerRow ?? detectHeaderRow(grid, fields);
  const headers = uniqueHeaders(grid[headerRow - 1] ?? []);
  const colOf = new Map<string, number>();
  for (const f of fields) {
    const h = mapping.columns[f.key];
    const i = h ? headers.indexOf(h) : -1;
    if (i >= 0) colOf.set(f.key, i);
  }
  const rows: MappedRow[] = [];
  for (let r = headerRow; r < grid.length; r++) {
    if (!grid[r].some(Boolean)) continue;
    const values: Record<string, string> = {};
    for (const [key, i] of colOf) values[key] = grid[r][i] ?? "";
    rows.push({ row: r + 1, values });
  }
  return rows;
}
