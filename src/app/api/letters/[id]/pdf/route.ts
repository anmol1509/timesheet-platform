import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { buildLetterhead } from "@/lib/letterhead";
import { generateEmployeeLetterPdf, type LetterLayout } from "@/lib/generateEmployeeLetterPdf";
import { imageDataUri } from "@/lib/storedImage";
import { refLabel } from "@/lib/employeeLetter";
import { formatLetterDate } from "@/lib/letterLayout";
import { loadSupplierPrint } from "@/lib/employeeLetterIssuer";
import { overlayOnLetterheadPdf } from "@/lib/letterheadOverlay";

// Re-renders an issued letter from its stored wording, exactly as issued.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { branchId, isSuperAdmin } = await requireUserWithBranch();
  const { id } = await params;
  const letter = await prisma.issuedLetter.findUnique({ where: { id }, include: { branch: true, employee: { select: { name: true, employeeIdNo: true } } } });
  if (!letter || isOutsideBranch(letter.branchId, branchId, isSuperAdmin)) return NextResponse.json({ error: "Letter not found." }, { status: 404 });

  // What was chosen when it was issued: whose letterhead, signatory, signature, stamp.
  const saved = (letter.layout ?? {}) as { modern?: boolean; margins?: { top: number; bottom: number; left: number; right: number } | null; issuerSupplierId?: string | null; onLetterhead?: boolean; signatoryName?: string | null; signatoryTitle?: string | null; showSignature?: boolean; showStamp?: boolean; signatureImageId?: string | null; stampImageId?: string | null };
  // Letters issued for a visa or supplier company print that company's letterhead, signature and stamp.
  const supplier = saved.issuerSupplierId ? await loadSupplierPrint(saved.issuerSupplierId, letter.branchId, { signature: !!saved.showSignature, stamp: !!saved.showStamp, letterhead: !!saved.onLetterhead }) : null;
  const layout: LetterLayout = supplier
    ? {
        onLetterhead: !!saved.onLetterhead,
        letterheadImage: supplier.letterheadImage,
        signatoryName: saved.signatoryName ?? null,
        signatoryTitle: saved.signatoryTitle ?? null,
        signatureImage: supplier.signatureImage,
        stampImage: supplier.stampImage,
        topMm: supplier.topMm,
        bottomMm: supplier.bottomMm,
      }
    : {
        onLetterhead: !!saved.onLetterhead,
        letterheadImage: saved.onLetterhead ? await imageDataUri(letter.branch.letterheadImageId) : null,
        signatoryName: saved.signatoryName ?? null,
        signatoryTitle: saved.signatoryTitle ?? null,
        signatureImage: saved.showSignature ? await imageDataUri(letter.branch.signatureId) : null,
        stampImage: saved.showStamp ? await imageDataUri(letter.branch.stampId) : null,
        topMm: letter.branch.letterheadTopMm,
        bottomMm: letter.branch.letterheadBottomMm,
      };
  // Letters issued since the margins were introduced print body-only on the margins saved with them; older ones print as they always did.
  if (saved.modern) {
    layout.modern = true;
    layout.margins = saved.margins ?? { top: layout.topMm ?? 65, bottom: layout.bottomMm ?? 35, left: 18, right: 18 };
  }
  // A signature or stamp uploaded for this letter alone stands in for the company's own.
  if (saved.showSignature && saved.signatureImageId) layout.signatureImage = await imageDataUri(saved.signatureImageId);
  if (saved.showStamp && saved.stampImageId) layout.stampImage = await imageDataUri(saved.stampImageId);
  let buffer: Uint8Array = await generateEmployeeLetterPdf({
    letterhead: supplier ? supplier.letterhead : await buildLetterhead(letter.branch),
    refNo: refLabel(letter.refNo),
    date: formatLetterDate(letter.createdAt),
    title: letter.title,
    bodyHtml: letter.bodyHtml,
    layout,
  });
  // A letterhead kept as a PDF is laid under the finished pages rather than drawn as an image.
  if (supplier?.letterheadPdf && saved.onLetterhead && !supplier.letterheadImage) buffer = await overlayOnLetterheadPdf(buffer, supplier.letterheadPdf);
  const safe = `${refLabel(letter.refNo)}-${letter.employee.employeeIdNo}`.replace(/[^\w.-]+/g, "_");
  return new NextResponse(new Uint8Array(buffer), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${safe}.pdf"`, "Cache-Control": "private, no-store" } });
}
