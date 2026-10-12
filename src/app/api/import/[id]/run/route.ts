import { NextResponse, after } from "next/server";
import { runBatch } from "@/lib/importer/engine";
import { loadOwnBatch, notFound, requireImporter } from "@/lib/importer/access";
import { prisma } from "@/lib/db";

// The import continues after this response; the screen polls the batch for progress.
export const maxDuration = 60;

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const who = await requireImporter();
  if (who instanceof NextResponse) return who;
  const batch = await loadOwnBatch((await params).id, who.branchId);
  if (!batch) return notFound();
  if (batch.status !== "PREVIEWED") {
    return NextResponse.json({ error: batch.status === "DRAFT" ? "Preview the import first." : "This import can't be run again." }, { status: 409 });
  }
  // Claim it now, so a double click can't start two runs.
  const claimed = await prisma.importBatch.updateMany({ where: { id: batch.id, status: "PREVIEWED" }, data: { status: "RUNNING" } });
  if (claimed.count === 0) return NextResponse.json({ error: "This import is already running." }, { status: 409 });
  after(async () => {
    await runBatch(batch.id, who.user, { claimed: true });
  });
  return NextResponse.json({ status: "RUNNING" });
}
