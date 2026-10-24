import { NextResponse } from "next/server";
import { getCurrentUser, isBlockedByPermissions, resolveSuperAdminBranchId, subjectOf } from "@/lib/auth";
import { canViewSensitive } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
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

  // An owner's or sponsor's personal documents open only for people granted "Sensitive documents", and each opening is logged.
  if (attachment.entityType === "SUPPLIER_PARTY") {
    if (!canViewSensitive(subjectOf(user))) {
      return NextResponse.json({ error: "You don't have permission to open owner and sponsor documents." }, { status: 403 });
    }
    const party = await prisma.supplierParty.findUnique({ where: { id: attachment.entityId }, select: { name: true, role: true, supplierId: true } });
    await logAudit({
      entityType: "SUPPLIER",
      entityId: party?.supplierId ?? attachment.entityId,
      action: "VIEW",
      after: { document: `${attachment.docType.toLowerCase().replace(/_/g, " ")} (${attachment.filename})`, party: party ? `${party.name} (${party.role.toLowerCase()})` : null },
      userId: user.id,
      userName: user.name,
      branchId: attachment.branchId,
    });
  }

  return new NextResponse(new Uint8Array(attachment.fileData), {
    headers: {
      "Content-Type": attachment.mimeType,
      "Content-Disposition": `inline; filename="${attachment.filename}"`,
    },
  });
}
