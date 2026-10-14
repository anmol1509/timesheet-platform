import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getEssEmployee } from "@/lib/ess/session";

// The signed-in employee's company logo (the staff image route needs a staff session).
export async function GET() {
  const employee = await getEssEmployee();
  if (!employee?.branch.logoId) return new NextResponse("Not found", { status: 404 });
  const image = await prisma.storedImage.findUnique({ where: { id: employee.branch.logoId } });
  if (!image) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(new Uint8Array(image.data), {
    headers: { "Content-Type": image.mimeType, "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff" },
  });
}
