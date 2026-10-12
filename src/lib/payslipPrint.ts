import { prisma } from "@/lib/db";
import { imageDataUri } from "@/lib/storedImage";
import { loadSupplierPrint, type IssuerOption } from "@/lib/employeeLetterIssuer";

/** How a payslip run is printed. All optional; nothing is signed or stamped unless asked for. */
export type PayslipPrintChoice = { onLetterhead: boolean; showSignature: boolean; showStamp: boolean; signatoryName: string; signatoryTitle: string };

export type PayslipLayout = {
  onLetterhead: boolean;
  letterheadImage: string | null;
  letterheadPdf: Uint8Array | null;
  topMm: number;
  bottomMm: number;
  signatoryName: string | null;
  signatoryTitle: string | null;
  signatureImage: string | null;
  stampImage: string | null;
};

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/jpg"];

/** What the run's issuing company has on file (letterhead, signatory, signature, stamp), for the options screen. Null when the run isn't found. */
export async function loadPayslipIssuer(runId: string): Promise<{ branchId: string; issuer: IssuerOption } | null> {
  const run = await prisma.payrollRun.findUnique({
    where: { id: runId },
    select: {
      branchId: true, companyId: true,
      branch: { select: { name: true, signatoryName: true, signatoryTitle: true, signatureId: true, stampId: true, letterheadImageId: true, letterheadTopMm: true, letterheadBottomMm: true } },
    },
  });
  if (!run) return null;
  if (run.companyId) {
    const s = await prisma.supplier.findUnique({
      where: { id: run.companyId },
      select: { id: true, name: true, fullName: true, letterheadTopMm: true, letterheadBottomMm: true, signatoryName: true, signatoryTitle: true, signatureId: true, stampId: true },
    });
    if (s) {
      const sheets = await prisma.attachment.findMany({ where: { entityType: "SUPPLIER", entityId: s.id, docType: "LETTERHEAD" }, orderBy: { uploadedAt: "desc" }, select: { mimeType: true } });
      const kind = sheets.map((r) => r.mimeType.toLowerCase()).map((t) => (IMAGE_TYPES.includes(t) ? "image" : t === "application/pdf" ? "pdf" : null)).find((k) => k) ?? null;
      const name = (s.fullName || s.name).toUpperCase();
      return {
        branchId: run.branchId,
        issuer: {
          key: "SUPPLIER", label: name, name, supplierId: s.id,
          letterheadUrl: kind === "image" ? `/api/suppliers/${s.id}/letterhead` : null, letterheadKind: kind,
          topMm: s.letterheadTopMm ?? 65, bottomMm: s.letterheadBottomMm ?? 35,
          signatoryName: s.signatoryName ?? "", signatoryTitle: s.signatoryTitle ?? "",
          signatureUrl: s.signatureId ? `/api/images/${s.signatureId}` : null, stampUrl: s.stampId ? `/api/images/${s.stampId}` : null,
          where: `Suppliers → ${name}`,
        },
      };
    }
  }
  const b = run.branch;
  return {
    branchId: run.branchId,
    issuer: {
      key: "PROFILE", label: b.name.toUpperCase(), name: b.name.toUpperCase(), supplierId: null,
      letterheadUrl: b.letterheadImageId ? `/api/images/${b.letterheadImageId}` : null, letterheadKind: b.letterheadImageId ? "image" : null,
      topMm: b.letterheadTopMm ?? 65, bottomMm: b.letterheadBottomMm ?? 35,
      signatoryName: b.signatoryName ?? "", signatoryTitle: b.signatoryTitle ?? "",
      signatureUrl: b.signatureId ? `/api/images/${b.signatureId}` : null, stampUrl: b.stampId ? `/api/images/${b.stampId}` : null,
      where: "Settings → Company profile → Letters",
    },
  };
}

/** The images the PDF needs for what was chosen. */
export async function loadPayslipLayout(runId: string, choice: PayslipPrintChoice): Promise<PayslipLayout | null> {
  const run = await prisma.payrollRun.findUnique({
    where: { id: runId },
    select: { branchId: true, companyId: true, branch: { select: { signatureId: true, stampId: true, letterheadImageId: true, letterheadTopMm: true, letterheadBottomMm: true } } },
  });
  if (!run) return null;
  const base = { signatoryName: choice.signatoryName.trim() || null, signatoryTitle: choice.signatoryTitle.trim() || null };
  const supplier = run.companyId ? await loadSupplierPrint(run.companyId, run.branchId, { signature: choice.showSignature, stamp: choice.showStamp, letterhead: choice.onLetterhead }) : null;
  if (supplier) {
    return { ...base, onLetterhead: choice.onLetterhead, letterheadImage: supplier.letterheadImage, letterheadPdf: supplier.letterheadPdf, topMm: supplier.topMm ?? 65, bottomMm: supplier.bottomMm ?? 35, signatureImage: supplier.signatureImage, stampImage: supplier.stampImage };
  }
  const b = run.branch;
  return {
    ...base, onLetterhead: choice.onLetterhead,
    letterheadImage: choice.onLetterhead ? await imageDataUri(b.letterheadImageId) : null, letterheadPdf: null,
    topMm: b.letterheadTopMm ?? 65, bottomMm: b.letterheadBottomMm ?? 35,
    signatureImage: choice.showSignature ? await imageDataUri(b.signatureId) : null,
    stampImage: choice.showStamp ? await imageDataUri(b.stampId) : null,
  };
}
