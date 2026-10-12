import { NextResponse } from "next/server";
import { undoBatch } from "@/lib/importer/engine";
import { loadOwnBatch, notFound, requireImporter } from "@/lib/importer/access";

export const maxDuration = 60;

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const who = await requireImporter();
  if (who instanceof NextResponse) return who;
  const batch = await loadOwnBatch((await params).id, who.branchId);
  if (!batch) return notFound();
  try {
    const outcome = await undoBatch(batch.id);
    return NextResponse.json({ restored: outcome.restored, removed: outcome.removed, kept: outcome.kept.length });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not undo." }, { status: 409 });
  }
}
