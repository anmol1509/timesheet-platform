import { NextResponse } from "next/server";
import { requireUserWithBranch } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { prisma } from "@/lib/db";
import { generateQuotationPdf } from "@/lib/generateQuotationPdf";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { branchId, isSuperAdmin } = await requireUserWithBranch();

  const quotation = await prisma.quotation.findUnique({
    where: { id },
    include: { client: true, branch: true, lines: true },
  });

  if (!quotation || isOutsideBranch(quotation.branchId, branchId, isSuperAdmin)) {
    return NextResponse.json({ error: "Quotation not found." }, { status: 404 });
  }

  const buffer = await generateQuotationPdf({
    branchName: quotation.branch.name,
    branchAddress: quotation.branch.address,
    quotationNumber: quotation.quotationNumber,
    clientName: quotation.client.name,
    validUntil: quotation.validUntil ? quotation.validUntil.toLocaleDateString("en-GB") : null,
    terms: quotation.terms,
    accommodationResponsibility: quotation.accommodationResponsibility,
    transportationResponsibility: quotation.transportationResponsibility,
    ppeResponsibility: quotation.ppeResponsibility,
    lines: quotation.lines.map((l) => ({
      trade: l.trade,
      quantity: l.quantity,
      rate: l.rate,
      otRate: l.otRate,
      nationality: l.nationality,
      workingHours: l.workingHours,
    })),
  });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${quotation.quotationNumber}.pdf"`,
    },
  });
}
