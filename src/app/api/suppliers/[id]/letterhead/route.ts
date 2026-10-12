import { NextResponse } from "next/server";
import { requireUserWithBranch } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { prisma } from "@/lib/db";

/** The supplier's current blank letterhead (image or PDF), for previews. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { branchId, isSuperAdmin } = await requireUserWithBranch();
  const { id } = await params;
  const supplier = await prisma.supplier.findUnique({ where: { id }, select: { branchId: true } });
  if (!supplier || isOutsideBranch(supplier.branchId, branchId, isSuperAdmin)) return new NextResponse("Not found", { status: 404 });
  const row = await prisma.attachment.findFirst({
    where: { entityType: "SUPPLIER", entityId: id, docType: "LETTERHEAD" },
    orderBy: { uploadedAt: "desc" },
    select: { fileData: true, mimeType: true },
  });
  if (!row) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(new Uint8Array(row.fileData), { headers: { "Content-Type": row.mimeType, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}
