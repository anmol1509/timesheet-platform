import { NextResponse } from "next/server";
import { analyzeBatch, createBatch } from "@/lib/importer/engine";
import { requireImporter } from "@/lib/importer/access";
import { isImportKind } from "@/lib/importer/targets";
import { mergeTimesheetFiles } from "@/lib/importer/mergeWorkbooks";

const MAX_BYTES = 20 * 1024 * 1024;

/** Start an import: store the file and say what is in it. */
export async function POST(request: Request) {
  const who = await requireImporter();
  if (who instanceof NextResponse) return who;

  const form = await request.formData();
  const files = form.getAll("file").filter((f): f is File => f instanceof File);
  const kind = String(form.get("kind") ?? "");
  if (!isImportKind(kind)) return NextResponse.json({ error: "Choose what you are importing." }, { status: 400 });
  if (files.length === 0) return NextResponse.json({ error: "No file provided." }, { status: 400 });
  if (files.length > 1 && kind !== "TIMESHEETS") return NextResponse.json({ error: "Upload one file at a time." }, { status: 400 });
  if (files.length > 20) return NextResponse.json({ error: "Up to 20 files at a time." }, { status: 400 });
  if (files.reduce((n, f) => n + f.size, 0) > MAX_BYTES) return NextResponse.json({ error: "Those files are over 20 MB together." }, { status: 400 });

  for (const file of files) {
    const name = file.name.toLowerCase();
    const isXlsx = name.endsWith(".xlsx");
    const isCsv = name.endsWith(".csv");
    if (!isXlsx && !(isCsv && kind !== "TIMESHEETS")) {
      return NextResponse.json(
        { error: kind === "TIMESHEETS" ? `"${file.name}" isn't an .xlsx file. Please upload .xlsx files.` : "Please upload an .xlsx or .csv file. (Older .xls files: open in Excel and Save As .xlsx.)" },
        { status: 400 }
      );
    }
  }

  let buffer: Buffer;
  let filename = files[0].name;
  if (files.length > 1) {
    try {
      buffer = await mergeTimesheetFiles(await Promise.all(files.map(async (f) => ({ name: f.name, buffer: Buffer.from(await f.arrayBuffer()) }))));
    } catch {
      return NextResponse.json({ error: "One of the files couldn't be read. Is each one a valid Excel file?" }, { status: 400 });
    }
    filename = `${files[0].name} + ${files.length - 1} more`;
  } else {
    buffer = Buffer.from(await files[0].arrayBuffer());
  }
  const batch = await createBatch({ kind, filename, buffer, branchId: who.branchId, userId: who.user.id });
  try {
    return NextResponse.json({ batchId: batch.id, analysis: await analyzeBatch(batch.id) });
  } catch {
    return NextResponse.json({ error: "Could not read this file. Is it a valid Excel or CSV file?" }, { status: 400 });
  }
}
