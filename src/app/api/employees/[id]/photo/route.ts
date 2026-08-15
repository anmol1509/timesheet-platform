import { NextResponse } from "next/server";
import { requireUserWithBranch } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { prisma } from "@/lib/db";
import { isAcceptedPhotoType } from "@/lib/uploads";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { branchId, isSuperAdmin } = await requireUserWithBranch();

  const { id } = await params;
  const employee = await prisma.employee.findUnique({
    where: { id },
    select: { branchId: true, photoData: true, photoMimeType: true },
  });
  if (
    !employee ||
    !employee.photoData ||
    isOutsideBranch(employee.branchId, branchId, isSuperAdmin)
  ) {
    return NextResponse.json({ error: "No photo." }, { status: 404 });
  }

  // Photos render inline by definition, so an unrecognised stored type is
  // downgraded rather than echoed back — see src/lib/uploads.ts.
  const type = isAcceptedPhotoType(employee.photoMimeType)
    ? employee.photoMimeType!
    : "application/octet-stream";

  return new NextResponse(new Uint8Array(employee.photoData), {
    headers: {
      "Content-Type": type,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
