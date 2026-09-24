import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getVendor } from "@/lib/vendor/session";
import { SUPPLIER_DOC_TYPES } from "@/lib/supplierRequests";

/** A supplier's own files. Anything not owned by the signed-in supplier is a 404. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const vendor = await getVendor();
  if (!vendor) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const { id } = await params;
  const file = await prisma.attachment.findUnique({ where: { id } });
  if (!file) return NextResponse.json({ error: "Not found." }, { status: 404 });
  // Only files that belong to this supplier: its own bills, its own company documents, its own worker submissions.
  let owned = false;
  if (file.entityType === "SUPPLIER_BILL") owned = !!(await prisma.supplierBill.findFirst({ where: { id: file.entityId, supplierId: vendor.id }, select: { id: true } }));
  else if (file.entityType === "SUPPLIER") owned = file.entityId === vendor.id && SUPPLIER_DOC_TYPES.some((t) => t.value === file.docType);
  else if (file.entityType === "WORKER_SUBMISSION") owned = !!(await prisma.workerSubmission.findFirst({ where: { id: file.entityId, supplierId: vendor.id }, select: { id: true } }));
  if (!owned) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return new NextResponse(new Uint8Array(file.fileData), {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Disposition": `inline; filename="${file.filename.replace(/"/g, "")}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
