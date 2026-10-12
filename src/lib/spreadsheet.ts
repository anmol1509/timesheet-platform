import { parseCsv } from "@/lib/csv";

// Browser-side reading and writing of .xlsx, so an import or export works with
// the file people actually keep in Excel, not only CSV. exceljs is loaded on
// demand: it is large and only needed once someone picks an .xlsx file.

type CellValue = unknown;

function cellText(v: CellValue): string {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (Array.isArray(o.richText)) return o.richText.map((r) => String((r as { text?: string }).text ?? "")).join("").trim();
    if ("result" in o) return cellText(o.result); // formula: use its computed value
    if ("text" in o) return cellText(o.text); // hyperlink
    if ("error" in o) return "";
  }
  return String(v).trim();
}

/** Rows of a .xlsx (first sheet, first row as headers) or a CSV, as header → text. */
export async function parseSpreadsheetFile(file: File): Promise<Record<string, string>[]> {
  if (!/\.xlsx$/i.test(file.name)) return parseCsv(await file.text());

  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());
  const ws = wb.worksheets[0];
  if (!ws) return [];

  const width = ws.columnCount;
  const grid: string[][] = [];
  ws.eachRow({ includeEmpty: false }, (row) => {
    const cells: string[] = [];
    for (let c = 1; c <= width; c++) cells.push(cellText(row.getCell(c).value));
    grid.push(cells);
  });
  if (grid.length === 0) return [];

  const header = grid[0];
  return grid
    .slice(1)
    .filter((r) => r.some((c) => c !== ""))
    .map((r) => {
      const obj: Record<string, string> = {};
      header.forEach((h, i) => {
        if (h) obj[h] = r[i] ?? "";
      });
      return obj;
    });
}

/** Download `rows` as an .xlsx with a bold, frozen header row. */
export async function downloadXlsx(
  filename: string,
  sheetName: string,
  headers: string[],
  rows: (string | number | null | undefined)[][],
) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName);
  ws.addRow(headers).font = { bold: true };
  for (const r of rows) ws.addRow(r.map((v) => v ?? ""));
  ws.views = [{ state: "frozen", ySplit: 1 }];
  ws.columns.forEach((col, i) => {
    const longest = Math.max(headers[i]?.length ?? 0, ...rows.map((r) => String(r[i] ?? "").length));
    col.width = Math.min(Math.max(longest + 2, 10), 48);
  });

  const buf = await wb.xlsx.writeBuffer();
  const url = URL.createObjectURL(
    new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export type HeaderColumn = { label: string; aliases?: string[] };

/** Rename each row's headers to the canonical column labels, ignoring case and
 * spacing and accepting aliases — so a file exported by an older version, or
 * typed as "supplier name", still lines up. */
export function remapHeaders(rows: Record<string, string>[], columns: HeaderColumn[]): Record<string, string>[] {
  const canon = new Map<string, string>();
  for (const c of columns) {
    canon.set(c.label.trim().toLowerCase(), c.label);
    for (const a of c.aliases ?? []) canon.set(a.trim().toLowerCase(), c.label);
  }
  return rows.map((row) => {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(row)) out[canon.get(k.trim().toLowerCase()) ?? k] = v;
    return out;
  });
}
