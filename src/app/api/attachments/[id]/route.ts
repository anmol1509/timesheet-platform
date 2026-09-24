import { NextResponse } from "next/server";
import { getCurrentUser, isBlockedByPermissions, resolveSuperAdminBranchId } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { prisma } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || (await isBlockedByPermissions(user))) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const isSuperAdmin = user.role === "SUPER_ADMIN";
  const branchId = isSuperAdmin ? await resolveSuperAdminBranchId() : user.branchId;

  const { id } = await params;
  const attachment = await prisma.attachment.findUnique({ where: { id } });
  if (!attachment || isOutsideBranch(attachment.branchId, branchId, isSuperAdmin)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(attachment.fileData), {
    headers: {
      "Content-Type": attachment.mimeType,
      "Content-Disposition": `inline; filename="${attachment.filename}"`,
    },
  });
}
