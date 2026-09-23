import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getEssEmployee } from "@/lib/ess/session";

// A document the employer has chosen to show in the portal, and only the
// signed-in employee's own.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const employee = await getEssEmployee();
  if (!employee) return new NextResponse("Not signed in", { status: 401 });
  const { id } = await params;
  const doc = await prisma.document.findFirst({ where: { id, employeeId: employee.id, displayInEss: true } });
  if (!doc) return new NextResponse("Not found", { status: 404 });
  const safeName = doc.filename.replace(/[^\w.\- ]+/g, "_");
  return new NextResponse(new Uint8Array(doc.fileData), {
    headers: {
      "Content-Type": doc.mimeType,
      "Content-Disposition": `inline; filename="${safeName}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
