import { NextResponse } from "next/server";
import { loadOwnBatch, notFound, requireImporter } from "@/lib/importer/access";
import { prisma } from "@/lib/db";
import { STOP_REQUESTED } from "@/lib/importer/engine";

/** Asks a running import to stop. It finishes the row it is on, keeps what it already saved (which can be undone) and ends as "stopped part-way". */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const who = await requireImporter();
  if (who instanceof NextResponse) return who;
  const batch = await loadOwnBatch((await params).id, who.branchId);
  if (!batch) return notFound();
  if (batch.status !== "RUNNING") return NextResponse.json({ error: "This import isn't running." }, { status: 409 });
  await prisma.importBatch.updateMany({ where: { id: batch.id, status: "RUNNING" }, data: { error: STOP_REQUESTED } });
  return NextResponse.json({ status: "STOPPING" });
}
