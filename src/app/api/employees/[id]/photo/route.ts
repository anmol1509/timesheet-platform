import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { id } = await params;
  const employee = await prisma.employee.findUnique({ where: { id } });
  if (!employee || !employee.photoData) {
    return NextResponse.json({ error: "No photo." }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(employee.photoData), {
    headers: {
      "Content-Type": employee.photoMimeType || "image/jpeg",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
