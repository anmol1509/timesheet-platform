import ExcelJS from "exceljs";

/**
 * Several timesheet files (say one per client) read as one workbook, so the rest of the import
 * (column checks, review, apply) works unchanged. Each tab is copied across with its values and
 * layout. Tabs that share a name, such as every client's "SEP-26", get " (2)", " (3)" … added;
 * the month is still read from the name and the suffix is dropped from the month label.
 */
export async function mergeTimesheetFiles(files: { name: string; buffer: Buffer }[]): Promise<Buffer> {
  const out = new ExcelJS.Workbook();
  const used = new Set<string>();
  for (const file of files) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(file.buffer as unknown as ArrayBuffer);
    for (const sheet of wb.worksheets) {
      const base = sheet.name.slice(0, 28);
      let name = base;
      for (let n = 2; used.has(name.toLowerCase()); n++) name = `${base} (${n})`;
      used.add(name.toLowerCase());
      const copy = out.addWorksheet(name);
      sheet.columns?.forEach((col, i) => {
        if (col?.width) copy.getColumn(i + 1).width = col.width;
      });
      sheet.eachRow({ includeEmpty: true }, (row, r) => {
        const target = copy.getRow(r);
        if (row.height) target.height = row.height;
        row.eachCell({ includeEmpty: false }, (cell, c) => {
          const t = target.getCell(c);
          t.value = cell.value;
          t.numFmt = cell.numFmt;
          t.font = cell.font;
          t.alignment = cell.alignment;
        });
      });
      for (const range of Object.keys((sheet as unknown as { _merges: Record<string, unknown> })._merges ?? {})) {
        try {
          copy.mergeCells(range);
        } catch {
          /* an overlapping merge in the source is not worth stopping for */
        }
      }
    }
  }
  return Buffer.from(await out.xlsx.writeBuffer());
}
