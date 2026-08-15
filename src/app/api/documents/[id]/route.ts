import { NextResponse } from "next/server";
import { requireUserWithBranch } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { prisma } from "@/lib/db";
import { contentDispositionFor } from "@/lib/uploads";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // `src/proxy.ts` skips /api, so this route is the only thing standing between
  // a signed-in user and another branch's passports — it has to check both that
  // they're signed in and that the document is theirs to see.
  const { branchId, isSuperAdmin } = await requireUserWithBranch();

  const { id } = await params;
  const doc = await prisma.document.findUnique({
    where: { id },
    include: { employee: { select: { branchId: true } } },
  });
  // Same 404 for "no such document" and "not yours", so ids can't be probed.
  if (!doc || isOutsideBranch(doc.employee.branchId, branchId, isSuperAdmin)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(doc.fileData), {
    headers: contentDispositionFor(doc.mimeType, doc.filename),
  });
}
