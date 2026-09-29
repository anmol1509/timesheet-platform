import { NextResponse } from "next/server";
import { analyzeBatch } from "@/lib/importer/engine";
import { loadOwnBatch, notFound, requireImporter } from "@/lib/importer/access";

/** Look at the file again with a different sheet, or with columns picked by hand. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const who = await requireImporter();
  if (who instanceof NextResponse) return who;
  const batch = await loadOwnBatch((await params).id, who.branchId);
  if (!batch) return notFound();
  if (!batch.fileData) return NextResponse.json({ error: "This import has already finished." }, { status: 409 });
  const body = (await request.json().catch(() => ({}))) as { sheet?: string; timesheetOverrides?: Record<string, string> };
  return NextResponse.json({ analysis: await analyzeBatch(batch.id, { columns: {}, sheet: body.sheet, timesheetOverrides: body.timesheetOverrides }) });
}
