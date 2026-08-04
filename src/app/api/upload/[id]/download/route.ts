import { NextResponse } from "next/server";
import { requireUserWithBranch } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { prisma } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { branchId, isSuperAdmin } = await requireUserWithBranch();

  const { id } = await params;
  const upload = await prisma.upload.findUnique({ where: { id } });
  if (!upload || !upload.fileData) {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }
  if (isOutsideBranch(upload.branchId, branchId, isSuperAdmin)) {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(upload.fileData), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${upload.filename}"`,
    },
  });
}
