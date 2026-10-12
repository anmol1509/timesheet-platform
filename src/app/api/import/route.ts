import { NextResponse } from "next/server";
import { analyzeBatch, createBatch } from "@/lib/importer/engine";
import { requireImporter } from "@/lib/importer/access";
import { isImportKind } from "@/lib/importer/targets";

const MAX_BYTES = 20 * 1024 * 1024;

/** Start an import: store the file and say what is in it. */
export async function POST(request: Request) {
  const who = await requireImporter();
  if (who instanceof NextResponse) return who;

  const form = await request.formData();
  const file = form.get("file");
  const kind = String(form.get("kind") ?? "");
  if (!isImportKind(kind)) return NextResponse.json({ error: "Choose what you are importing." }, { status: 400 });
  if (!(file instanceof File)) return NextResponse.json({ error: "No file provided." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "That file is over 20 MB." }, { status: 400 });

  const name = file.name.toLowerCase();
  const isXlsx = name.endsWith(".xlsx");
  const isCsv = name.endsWith(".csv");
  if (!isXlsx && !(isCsv && kind !== "TIMESHEETS")) {
    return NextResponse.json(
      { error: kind === "TIMESHEETS" ? "Please upload an .xlsx file." : "Please upload an .xlsx or .csv file. (Older .xls files: open in Excel and Save As .xlsx.)" },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const batch = await createBatch({ kind, filename: file.name, buffer, branchId: who.branchId, userId: who.user.id });
  try {
    return NextResponse.json({ batchId: batch.id, analysis: await analyzeBatch(batch.id) });
  } catch {
    return NextResponse.json({ error: "Could not read this file. Is it a valid Excel or CSV file?" }, { status: 400 });
  }
}
