import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { buildLetterhead } from "@/lib/letterhead";
import { generateEmployeeLetterPdf } from "@/lib/generateEmployeeLetterPdf";
import { refLabel } from "@/lib/employeeLetter";
import { formatLetterDate } from "@/lib/letterLayout";

// Re-renders an issued letter from its stored wording, exactly as issued.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { branchId, isSuperAdmin } = await requireUserWithBranch();
  const { id } = await params;
  const letter = await prisma.issuedLetter.findUnique({ where: { id }, include: { branch: true, employee: { select: { name: true, employeeIdNo: true } } } });
  if (!letter || isOutsideBranch(letter.branchId, branchId, isSuperAdmin)) return NextResponse.json({ error: "Letter not found." }, { status: 404 });

  const buffer = await generateEmployeeLetterPdf({
    letterhead: await buildLetterhead(letter.branch),
    refNo: refLabel(letter.refNo),
    date: formatLetterDate(letter.createdAt),
    title: letter.title,
    bodyHtml: letter.bodyHtml,
    signedBy: null,
  });
  const safe = `${refLabel(letter.refNo)}-${letter.employee.employeeIdNo}`.replace(/[^\w.-]+/g, "_");
  return new NextResponse(new Uint8Array(buffer), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${safe}.pdf"`, "Cache-Control": "private, no-store" } });
}
