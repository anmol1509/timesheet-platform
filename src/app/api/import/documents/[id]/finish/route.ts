import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { loadOwnBatch, notFound, requireImporter } from "@/lib/importer/access";

/** Closes the upload and records the outcome, so it shows in the history and can be undone for 30 days. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const who = await requireImporter();
  if (who instanceof NextResponse) return who;
  const batch = await loadOwnBatch((await params).id, who.branchId);
  if (!batch || batch.kind !== "DOCUMENTS") return notFound();
  const body = (await request.json().catch(() => null)) as { rows?: { name: string; status: string; message?: string }[] } | null;
  const rows = (body?.rows ?? []).slice(0, 5000);
  const count = (s: string) => rows.filter((r) => r.status === s).length;
  const created = await prisma.importChange.count({ where: { batchId: batch.id } });
  const issues = rows.filter((r) => r.status !== "created").slice(0, 200).map((r, i) => ({ row: i + 1, name: r.name, status: r.status === "failed" ? "error" : "skipped", message: r.message }));
  const summary = { counts: { created, duplicates: count("duplicate"), failed: count("failed"), updated: 0 }, notes: [], rows: issues, totalRows: rows.length, truncated: false };
  const finished = new Date();
  await prisma.importBatch.update({
    where: { id: batch.id },
    data: { status: "DONE", summary: JSON.stringify(summary), finishedAt: finished, undoUntil: new Date(finished.getTime() + 30 * 86_400_000) },
  });
  return NextResponse.json({ summary });
}
