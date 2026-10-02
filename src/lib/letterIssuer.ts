import { prisma } from "@/lib/db";
import { imageDataUri } from "@/lib/storedImage";
import { substituteInHtml } from "@/lib/letterHtml";
import {
  formatLetterDate,
  groupWorkersBySponsor,
  type LetterGroup,
  type LetterWorker,
} from "@/lib/letterLayout";
import type { LetterIssuer, LetterSection } from "@/lib/generateLetterPdf";

/**
 * Turning a worker selection into the letters it actually produces.
 *
 * Shared by the NOC and the Undertaking: both split the same way, sign the same
 * way and print on the same letterhead, so the only thing either route decides
 * for itself is the title and which template supplies the body.
 */

/** react-pdf can only draw raster images behind a page. */
const USABLE_LETTERHEAD_TYPES = ["image/png", "image/jpeg", "image/jpg"];

/**
 * Each supplier's blank letterhead for the suppliers asked for: an image drawn
 * behind the page, or a PDF the letter is laid over.
 *
 * A supplier with no letterhead on file (or one in a format neither can use) is
 * simply absent from the map and its letter prints plain — a missing file must
 * not stop the letter being issued.
 */
export async function loadLetterheads(
  supplierIds: string[]
): Promise<Map<string, { image: string | null; pdf: Uint8Array | null }>> {
  const ids = supplierIds.filter(Boolean);
  if (ids.length === 0) return new Map();

  const rows = await prisma.attachment.findMany({
    where: { entityType: "SUPPLIER", entityId: { in: ids }, docType: "LETTERHEAD" },
    orderBy: { uploadedAt: "desc" },
    select: { entityId: true, fileData: true, mimeType: true },
  });

  const out = new Map<string, { image: string | null; pdf: Uint8Array | null }>();
  for (const row of rows) {
    // Newest first, so the first usable one seen for a supplier is the current one.
    if (out.has(row.entityId)) continue;
    const type = row.mimeType.toLowerCase();
    if (USABLE_LETTERHEAD_TYPES.includes(type)) {
      out.set(row.entityId, { image: `data:${row.mimeType};base64,${Buffer.from(row.fileData).toString("base64")}`, pdf: null });
    } else if (type === "application/pdf") {
      out.set(row.entityId, { image: null, pdf: new Uint8Array(row.fileData) });
    }
  }
  return out;
}

const SUBSTITUTIONS = (opts: { context: LetterContext }, issuerName: string, count: number) => ({
  CLIENTNAME: opts.context.clientName,
  CLIENTADDRESS: opts.context.clientAddress ?? "",
  PROJECTNAME: opts.context.projectName,
  COMPANYNAME: issuerName,
  SPONSORSHIPCOMPANYNAME: issuerName,
  BRANCHNAME: opts.context.branchName,
  DOCNO: String(opts.context.docNo),
  MOBILIZEDATE: opts.context.mobilizeDate ? formatLetterDate(opts.context.mobilizeDate) : "",
  DATE: formatLetterDate(opts.context.date),
  WORKERCOUNT: String(count),
});

export type LetterContext = {
  clientName: string;
  clientAddress: string | null;
  projectName: string;
  branchName: string;
  docNo: number;
  mobilizeDate: Date | null;
  date: Date;
};

/**
 * One section per issuing company, with its letterhead, signatory and body.
 *
 * The body is substituted per section rather than once, because %%COMPANYNAME%%
 * names the company issuing that letter — the whole reason a mixed selection
 * has to be split before the text is built.
 */
export async function buildLetterSections(opts: {
  workers: LetterWorker[];
  /** The template's body as HTML (see templateHtml()). */
  templateHtml: string;
  context: LetterContext;
  onLetterhead: boolean;
  /** Used when a group's workers have no supplier of their own. */
  fallbackIssuerName: string;
  /**
   * Who issues the letter. SPONSOR: one letter per visa sponsor, on that
   * sponsor's letterhead (the NOC). COMPANY: one letter from our own company,
   * on the letterhead in Settings → Company profile (the undertaking).
   */
  issuedBy: "SPONSOR" | "COMPANY";
  branchId: string;
  /** Company-issued letters only: what to print in the signature block. */
  signing?: { signatoryName?: string | null; signatoryTitle?: string | null; showSignature?: boolean; showStamp?: boolean };
}): Promise<{ sections: LetterSection[]; missingLetterheads: string[] }> {
  if (opts.issuedBy === "COMPANY") return buildCompanySection(opts);
  const groups = groupWorkersBySponsor(opts.workers);
  const supplierIds = groups
    .map((g) => g.supplierId)
    .filter((id): id is string => !!id);

  const [suppliers, letterheads] = await Promise.all([
    supplierIds.length
      ? prisma.supplier.findMany({
          where: { id: { in: supplierIds } },
          select: {
            id: true,
            name: true,
            fullName: true,
            contactPerson: true,
            contactPhone: true,
            contactEmail: true,
            letterheadTopMm: true,
            letterheadBottomMm: true,
          },
        })
      : Promise.resolve([]),
    opts.onLetterhead ? loadLetterheads(supplierIds) : Promise.resolve(new Map<string, { image: string | null; pdf: Uint8Array | null }>()),
  ]);
  const supplierById = new Map(suppliers.map((s) => [s.id, s]));

  const missingLetterheads: string[] = [];
  const sections = groups.map((group) => {
    const supplier = group.supplierId ? supplierById.get(group.supplierId) : undefined;
    const issuerName = supplier?.fullName || supplier?.name || opts.fallbackIssuerName;
    const letterhead = group.supplierId ? letterheads.get(group.supplierId) : undefined;
    const letterheadImage = letterhead?.image ?? null;

    if (opts.onLetterhead && !letterhead) missingLetterheads.push(issuerName);

    const issuer: LetterIssuer = {
      name: issuerName,
      signatoryName: supplier?.contactPerson ?? null,
      signatoryPhone: supplier?.contactPhone ?? null,
      signatoryEmail: supplier?.contactEmail ?? null,
      letterheadImage,
      letterheadPdf: letterhead?.pdf ?? null,
      topMm: supplier?.letterheadTopMm ?? null,
      bottomMm: supplier?.letterheadBottomMm ?? null,
    };

    const bodyHtml = substituteInHtml(opts.templateHtml, SUBSTITUTIONS(opts, issuerName, group.workers.length));

    return { group, issuer, bodyHtml } satisfies LetterSection;
  });

  return { sections, missingLetterheads };
}

/** Maps an Employee row onto the worker shape the letter needs. */
export function toLetterWorker(e: {
  id: string;
  name: string;
  employeeIdNo: string;
  trade: string | null;
  nationality: string | null;
  passportNumber: string | null;
  emiratesId: string | null;
  visaStatus?: string | null;
  supplierId: string | null;
  sponsorSupplierId?: string | null;
  supplier?: { name: string; fullName: string | null } | null;
}): LetterWorker {
  return {
    id: e.id,
    name: e.name,
    employeeIdNo: e.employeeIdNo,
    trade: e.trade,
    nationality: e.nationality,
    passportNumber: e.passportNumber,
    emiratesId: e.emiratesId,
    visaStatus: e.visaStatus ?? null,
    supplierId: e.supplierId,
    sponsorSupplierId: e.sponsorSupplierId ?? null,
    supplierName: e.supplier?.fullName || e.supplier?.name || null,
  };
}

export type { LetterGroup };


/** One letter from our own company, on the letterhead saved in the company profile. */
async function buildCompanySection(opts: {
  workers: LetterWorker[];
  templateHtml: string;
  context: LetterContext;
  onLetterhead: boolean;
  branchId: string;
  signing?: { signatoryName?: string | null; signatoryTitle?: string | null; showSignature?: boolean; showStamp?: boolean };
}): Promise<{ sections: LetterSection[]; missingLetterheads: string[] }> {
  const branch = await prisma.branch.findUnique({
    where: { id: opts.branchId },
    select: { name: true, signatoryName: true, signatoryTitle: true, signatureId: true, stampId: true, phone: true, email: true, letterheadTopMm: true, letterheadBottomMm: true, letterheadImage: { select: { data: true, mimeType: true } } },
  });
  const name = branch?.name ?? opts.context.branchName;
  const img = branch?.letterheadImage;
  const letterheadImage =
    opts.onLetterhead && img && USABLE_LETTERHEAD_TYPES.includes(img.mimeType.toLowerCase())
      ? `data:${img.mimeType};base64,${Buffer.from(img.data).toString("base64")}`
      : null;
  const issuer: LetterIssuer = {
    name,
    signatoryName: opts.signing?.signatoryName?.trim() || branch?.signatoryName || null,
    signatoryTitle: opts.signing?.signatoryTitle?.trim() || branch?.signatoryTitle || null,
    signatoryPhone: branch?.phone ?? null,
    signatoryEmail: branch?.email ?? null,
    letterheadImage,
    topMm: branch?.letterheadTopMm ?? null,
    bottomMm: branch?.letterheadBottomMm ?? null,
    signatureImage: opts.signing?.showSignature ? await imageDataUri(branch?.signatureId) : null,
    stampImage: opts.signing?.showStamp ? await imageDataUri(branch?.stampId) : null,
  };
  const group: LetterGroup = { supplierId: null, supplierName: null, workers: opts.workers };
  const bodyHtml = substituteInHtml(opts.templateHtml, SUBSTITUTIONS(opts, name, opts.workers.length));
  return {
    sections: [{ group, issuer, bodyHtml } satisfies LetterSection],
    missingLetterheads: opts.onLetterhead && !letterheadImage ? [name] : [],
  };
}
