import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getVendor } from "@/lib/vendor/session";

/** A supplier's own invoice file. Only files on that supplier's bills are ever served. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const vendor = await getVendor();
  if (!vendor) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const { id } = await params;
  const file = await prisma.attachment.findUnique({ where: { id } });
  if (!file || file.entityType !== "SUPPLIER_BILL") return NextResponse.json({ error: "Not found." }, { status: 404 });
  const bill = await prisma.supplierBill.findFirst({ where: { id: file.entityId, supplierId: vendor.id }, select: { id: true } });
  if (!bill) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return new NextResponse(new Uint8Array(file.fileData), {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Disposition": `inline; filename="${file.filename.replace(/"/g, "")}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
