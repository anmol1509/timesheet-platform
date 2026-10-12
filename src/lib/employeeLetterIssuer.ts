import { prisma } from "@/lib/db";
import { imageDataUri } from "@/lib/storedImage";
import type { Letterhead } from "@/lib/letterhead";

/**
 * Whose letterhead an employee letter is issued on: the company that sponsors the
 * employee's visa, the supplier company they work under, or our own company profile.
 * Chosen per letter on the Letters screen; the choice is stored with the letter so a
 * re-download prints exactly the same.
 */
export type IssuerKey = "SPONSOR" | "SUPPLIER" | "PROFILE";

export type IssuerOption = {
  key: IssuerKey;
  /** Shown in the chooser, e.g. "Visa company · GULF SKILLS". */
  label: string;
  /** Printed in the header and "for and on behalf of" line. */
  name: string;
  /** null for the company profile. */
  supplierId: string | null;
  /** A letterhead image the browser can draw behind the preview (not set for PDF letterheads). */
  letterheadUrl: string | null;
  /** What is on file: an image, a PDF (printed on the issued PDF, not shown in the preview) or nothing usable. */
  letterheadKind: "image" | "pdf" | null;
  topMm: number;
  bottomMm: number;
  signatoryName: string;
  signatoryTitle: string;
  signatureUrl: string | null;
  stampUrl: string | null;
  /** Where to add what is missing, in words. */
  where: string;
};

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/jpg"];

type SupplierRow = {
  id: string; name: string; fullName: string | null;
  letterheadTopMm: number | null; letterheadBottomMm: number | null;
  signatoryName: string | null; signatoryTitle: string | null; signatureId: string | null; stampId: string | null;
};
const SUPPLIER_SELECT = { id: true, name: true, fullName: true, letterheadTopMm: true, letterheadBottomMm: true, signatoryName: true, signatoryTitle: true, signatureId: true, stampId: true } as const;

async function letterheadKinds(supplierIds: string[]): Promise<Map<string, "image" | "pdf">> {
  const out = new Map<string, "image" | "pdf">();
  if (supplierIds.length === 0) return out;
  const rows = await prisma.attachment.findMany({
    where: { entityType: "SUPPLIER", entityId: { in: supplierIds }, docType: "LETTERHEAD" },
    orderBy: { uploadedAt: "desc" },
    select: { entityId: true, mimeType: true },
  });
  for (const r of rows) {
    if (out.has(r.entityId)) continue; // newest first: the first usable one is the current letterhead
    const t = r.mimeType.toLowerCase();
    if (IMAGE_TYPES.includes(t)) out.set(r.entityId, "image");
    else if (t === "application/pdf") out.set(r.entityId, "pdf");
  }
  return out;
}

const supplierName = (s: { name: string; fullName: string | null }) => (s.fullName || s.name).toUpperCase();

/** The choices for this employee, best default first. null = employee not found. */
export async function loadIssuerOptions(employeeId: string): Promise<{ branchId: string; options: IssuerOption[] } | null> {
  const e = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: {
      branchId: true, supplierId: true, sponsorSupplierId: true,
      supplier: { select: SUPPLIER_SELECT },
      sponsorSupplier: { select: SUPPLIER_SELECT },
      branch: { select: { name: true, signatoryName: true, signatoryTitle: true, signatureId: true, stampId: true, letterheadImageId: true, letterheadTopMm: true, letterheadBottomMm: true } },
    },
  });
  if (!e) return null;
  const sponsor: SupplierRow | null = e.sponsorSupplier;
  const supplier: SupplierRow | null = e.supplier;
  const kinds = await letterheadKinds([sponsor?.id, supplier?.id].filter((x): x is string => !!x));

  const fromSupplier = (key: IssuerKey, label: string, s: SupplierRow): IssuerOption => {
    const kind = kinds.get(s.id) ?? null;
    return {
      key, label: `${label} · ${supplierName(s)}`, name: supplierName(s), supplierId: s.id,
      letterheadUrl: kind === "image" ? `/api/suppliers/${s.id}/letterhead` : null,
      letterheadKind: kind,
      topMm: s.letterheadTopMm ?? 65, bottomMm: s.letterheadBottomMm ?? 35,
      signatoryName: s.signatoryName ?? "", signatoryTitle: s.signatoryTitle ?? "",
      signatureUrl: s.signatureId ? `/api/images/${s.signatureId}` : null,
      stampUrl: s.stampId ? `/api/images/${s.stampId}` : null,
      where: `Suppliers → ${supplierName(s)}`,
    };
  };

  const options: IssuerOption[] = [];
  if (sponsor) options.push(fromSupplier("SPONSOR", sponsor.id === supplier?.id ? "Visa & supplier company" : "Visa company", sponsor));
  if (supplier && supplier.id !== sponsor?.id) options.push(fromSupplier("SUPPLIER", "Supplier company", supplier));
  const b = e.branch;
  options.push({
    key: "PROFILE", label: `Company profile · ${b.name.toUpperCase()}`, name: b.name.toUpperCase(), supplierId: null,
    letterheadUrl: b.letterheadImageId ? `/api/images/${b.letterheadImageId}` : null,
    letterheadKind: b.letterheadImageId ? "image" : null,
    topMm: b.letterheadTopMm ?? 65, bottomMm: b.letterheadBottomMm ?? 35,
    signatoryName: b.signatoryName ?? "", signatoryTitle: b.signatoryTitle ?? "",
    signatureUrl: b.signatureId ? `/api/images/${b.signatureId}` : null,
    stampUrl: b.stampId ? `/api/images/${b.stampId}` : null,
    where: "Settings → Company profile → Letters",
  });
  return { branchId: e.branchId, options };
}

/** Which supplier a chosen key means for this employee (null = company profile). An error string when the choice doesn't apply. */
export async function resolveIssuerSupplier(employeeId: string, key: IssuerKey): Promise<{ supplierId: string | null } | { error: string }> {
  if (key === "PROFILE") return { supplierId: null };
  const e = await prisma.employee.findUnique({ where: { id: employeeId }, select: { supplierId: true, sponsorSupplierId: true } });
  if (!e) return { error: "Employee not found." };
  const id = key === "SPONSOR" ? e.sponsorSupplierId : e.supplierId;
  if (!id) return { error: key === "SPONSOR" ? "This employee has no visa company set." : "This employee has no supplier company." };
  return { supplierId: id };
}

export type IssuerPrint = {
  /** The plain-paper header and the "for and on behalf of" name. */
  letterhead: Letterhead;
  letterheadImage: string | null;
  letterheadPdf: Uint8Array | null;
  topMm: number | null;
  bottomMm: number | null;
  signatureImage: string | null;
  stampImage: string | null;
};

/** What the PDF needs for a supplier-issued letter. Null when that supplier is gone or belongs to another branch. */
export async function loadSupplierPrint(supplierId: string, branchId: string, want: { signature: boolean; stamp: boolean; letterhead: boolean }): Promise<IssuerPrint | null> {
  const s = await prisma.supplier.findUnique({
    where: { id: supplierId },
    select: { ...SUPPLIER_SELECT, branchId: true, location: true, emirate: true, country: true, phone: true, contactPhone: true, contactEmail: true, poBox: true, trn: true },
  });
  if (!s || s.branchId !== branchId) return null;
  let letterheadImage: string | null = null;
  let letterheadPdf: Uint8Array | null = null;
  if (want.letterhead) {
    const row = await prisma.attachment.findFirst({
      where: { entityType: "SUPPLIER", entityId: s.id, docType: "LETTERHEAD" },
      orderBy: { uploadedAt: "desc" },
      select: { fileData: true, mimeType: true },
    });
    const t = row?.mimeType.toLowerCase() ?? "";
    if (row && IMAGE_TYPES.includes(t)) letterheadImage = `data:${row.mimeType};base64,${Buffer.from(row.fileData).toString("base64")}`;
    else if (row && t === "application/pdf") letterheadPdf = new Uint8Array(row.fileData);
  }
  return {
    letterhead: {
      name: supplierName(s),
      addressLines: [s.location, s.emirate, s.country].filter((x): x is string => !!x && x.trim().length > 0),
      phone: s.phone || s.contactPhone, fax: null, email: s.contactEmail,
      poBox: s.poBox ? s.poBox.replace(/^\s*P\.?\s*O\.?\s*Box\s*/i, "").trim() : null,
      trn: s.trn,
      logo: null, // a supplier has no logo of its own: its letterhead artwork is the branding
    },
    letterheadImage, letterheadPdf,
    topMm: s.letterheadTopMm, bottomMm: s.letterheadBottomMm,
    signatureImage: want.signature ? await imageDataUri(s.signatureId) : null,
    stampImage: want.stamp ? await imageDataUri(s.stampId) : null,
  };
}

/** Name to print as the employer in the letter body when issued for a supplier company. */
export async function supplierLetterName(supplierId: string): Promise<string | null> {
  const s = await prisma.supplier.findUnique({ where: { id: supplierId }, select: { name: true, fullName: true } });
  return s ? supplierName(s) : null;
}
