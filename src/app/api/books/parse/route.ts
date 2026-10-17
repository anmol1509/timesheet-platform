import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { requireUserWithBranch, subjectOf } from "@/lib/auth";
import { canWrite } from "@/lib/permissions";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from "@/lib/constants";
import { parseCsv, parseTrialBalance } from "@/lib/books/importTb";
import { parseBankStatement } from "@/lib/books/bankStatement";

/** Every sheet of an uploaded .xlsx (or the one grid of a .csv) as rows of cells. */
async function readGrids(file: File): Promise<unknown[][][]> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv") || file.type === "text/csv") return [parseCsv(await file.text())];
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load((await file.arrayBuffer()) as ExcelJS.Buffer);
  return wb.worksheets.map((ws) => {
    const g: unknown[][] = [];
    ws.eachRow({ includeEmpty: true }, (row) => g.push((row.values as unknown[]).slice(1).map((v) => (v && typeof v === "object" && "result" in (v as object) ? (v as { result: unknown }).result : v))));
    return g;
  });
}

/**
 * Reads an uploaded sheet (.xlsx or .csv). `?kind=statement` reads a bank statement into dated, signed lines;
 * otherwise it reads a trial balance into account / debit / credit rows.
 */
export async function POST(request: Request) {
  const { user } = await requireUserWithBranch();
  if (!canWrite(subjectOf(user), "finance.books")) return NextResponse.json({ error: "You don't have permission to import into the books." }, { status: 403 });
  const kind = new URL(request.url).searchParams.get("kind");
  const file = (await request.formData()).get("file");
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "Choose a file." }, { status: 400 });
  if (file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: `File too large — max ${MAX_UPLOAD_LABEL}.` }, { status: 400 });
  const name = file.name.toLowerCase();
  if (!name.endsWith(".csv") && !name.endsWith(".xlsx") && file.type !== "text/csv") {
    return NextResponse.json({ error: "Upload an .xlsx or .csv file. For an old .xls, save it as .xlsx first." }, { status: 400 });
  }
  try {
    const grids = await readGrids(file);
    // Exports often put a cover sheet first: the sheet that yields the most rows wins.
    if (kind === "statement") {
      const parsed = grids.map((g) => parseBankStatement(g));
      const best = parsed.reduce((b, p) => (!p.error && p.lines.length > (b && !b.error ? b.lines.length : -1) ? p : b), parsed[0]);
      return NextResponse.json(best ?? { lines: [], skipped: 0, error: "The file is empty." });
    }
    const parsed = grids.map((g) => parseTrialBalance(g));
    const best = parsed.reduce((b, p) => (!p.error && p.rows.length > (b && !b.error ? b.rows.length : -1) ? p : b), parsed[0]);
    return NextResponse.json(best ?? { rows: [], skipped: [], sourceDebit: null, sourceCredit: null, error: "The workbook is empty." });
  } catch {
    return NextResponse.json({ error: "Couldn't read that file. Check it isn't password-protected, or export it again." }, { status: 400 });
  }
}
