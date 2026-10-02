import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireImporter } from "@/lib/importer/access";

/** Opens a batch for a document upload so the whole thing can be undone. */
export async function POST(request: Request) {
  const who = await requireImporter();
  if (who instanceof NextResponse) return who;
  const body = (await request.json().catch(() => null)) as { label?: string; total?: number } | null;
  const batch = await prisma.importBatch.create({
    data: { kind: "DOCUMENTS", filename: String(body?.label ?? "Documents").slice(0, 120), status: "RUNNING", progressTotal: Math.max(0, Math.min(Number(body?.total) || 0, 5000)), branchId: who.branchId, createdById: who.user.id },
  });
  return NextResponse.json({ batchId: batch.id });
}
