import { NextResponse } from "next/server";
import { loadOwnBatch, notFound, requireImporter } from "@/lib/importer/access";

/** Status, progress and (once there is one) the report. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const who = await requireImporter();
  if (who instanceof NextResponse) return who;
  const batch = await loadOwnBatch((await params).id, who.branchId);
  if (!batch) return notFound();
  return NextResponse.json({
    id: batch.id,
    kind: batch.kind,
    filename: batch.filename,
    status: batch.status,
    progressDone: batch.progressDone,
    progressTotal: batch.progressTotal,
    error: batch.error,
    undoUntil: batch.undoUntil,
    summary: batch.summary ? JSON.parse(batch.summary) : null,
  });
}
