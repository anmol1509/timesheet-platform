import { NextResponse } from "next/server";
import { previewBatch, type StoredMapping } from "@/lib/importer/engine";
import { loadOwnBatch, notFound, requireImporter } from "@/lib/importer/access";
import { TARGETS, isImportKind } from "@/lib/importer/targets";

// The preview is the whole import run inside a transaction that is rolled back.
export const maxDuration = 60;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const who = await requireImporter();
  if (who instanceof NextResponse) return who;
  const batch = await loadOwnBatch((await params).id, who.branchId);
  if (!batch) return notFound();
  if (!batch.fileData || !["DRAFT", "PREVIEWED", "FAILED"].includes(batch.status)) {
    return NextResponse.json({ error: "This import has already been run." }, { status: 409 });
  }

  const mapping = (await request.json().catch(() => null)) as StoredMapping | null;
  if (!mapping || typeof mapping !== "object" || typeof mapping.columns !== "object") {
    return NextResponse.json({ error: "Missing column mapping." }, { status: 400 });
  }
  if (isImportKind(batch.kind) && batch.kind !== "TIMESHEETS") {
    const missing = TARGETS[batch.kind].fields.filter((f) => f.required && !mapping.columns[f.key]);
    const campFileHasNoName = batch.kind === "CAMPS" && !mapping.columns.camp && !mapping.campOptions?.campName?.trim();
    if (campFileHasNoName) return NextResponse.json({ error: "Choose a Camp name column, or type the camp name." }, { status: 400 });
    if (missing.length) {
      return NextResponse.json({ error: `Choose a column for: ${missing.map((f) => f.label).join(", ")}.` }, { status: 400 });
    }
  }
  try {
    return NextResponse.json({ summary: await previewBatch(batch.id, who.user, mapping) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "The preview failed." }, { status: 500 });
  }
}
