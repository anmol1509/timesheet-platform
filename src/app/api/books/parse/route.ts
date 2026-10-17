import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { requireUserWithBranch, subjectOf } from "@/lib/auth";
import { canWrite } from "@/lib/permissions";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from "@/lib/constants";
import { parseCsv, parseTrialBalance } from "@/lib/books/importTb";

/** Reads an uploaded trial balance (.xlsx, .xls exported as xlsx, or .csv) into account / debit / credit rows. */
export async function POST(request: Request) {
  const { user } = await requireUserWithBranch();
  if (!canWrite(subjectOf(user), "finance.books")) return NextResponse.json({ error: "You don't have permission to import into the books." }, { status: 403 });
  const file = (await request.formData()).get("file");
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "Choose a file." }, { status: 400 });
  if (file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: `File too large — max ${MAX_UPLOAD_LABEL}.` }, { status: 400 });
  const name = file.name.toLowerCase();
  try {
    let grid: unknown[][];
    if (name.endsWith(".csv") || file.type === "text/csv") {
      grid = parseCsv(await file.text());
    } else if (name.endsWith(".xlsx")) {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(await file.arrayBuffer() as ExcelJS.Buffer);
      // The first sheet that yields rows wins (exports often put a cover sheet first).
      let best: ReturnType<typeof parseTrialBalance> | null = null;
      for (const ws of wb.worksheets) {
        const g: unknown[][] = [];
        ws.eachRow({ includeEmpty: true }, (row) => g.push((row.values as unknown[]).slice(1).map((v) => (v && typeof v === "object" && "result" in (v as object) ? (v as { result: unknown }).result : v))));
        const parsed = parseTrialBalance(g);
        if (!parsed.error && parsed.rows.length > (best?.rows.length ?? 0)) best = parsed;
        if (!best) best = parsed;
      }
      return NextResponse.json(best ?? { rows: [], skipped: [], sourceDebit: null, sourceCredit: null, error: "The workbook is empty." });
    } else {
      return NextResponse.json({ error: "Upload an .xlsx or .csv file. In Tally use Export → Excel; for an old .xls, save it as .xlsx first." }, { status: 400 });
    }
    return NextResponse.json(parseTrialBalance(grid));
  } catch {
    return NextResponse.json({ error: "Couldn't read that file. Check it isn't password-protected, or export it again." }, { status: 400 });
  }
}
