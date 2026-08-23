import { prisma } from "@/lib/db";
import { substituteMergeFields } from "@/lib/mergeFields";
import {
  formatLetterDate,
  groupWorkersBySupplier,
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
 * Each supplier's blank letterhead, as data URIs, for the suppliers asked for.
 *
 * A supplier with no letterhead on file, or one uploaded as a PDF, is simply
 * absent from the map and its letter prints plain — a missing file must not
 * stop the letter being issued.
 */
export async function loadLetterheads(
  supplierIds: string[]
): Promise<Map<string, string>> {
  const ids = supplierIds.filter(Boolean);
  if (ids.length === 0) return new Map();

  const rows = await prisma.attachment.findMany({
    where: { entityType: "SUPPLIER", entityId: { in: ids }, docType: "LETTERHEAD" },
    orderBy: { uploadedAt: "desc" },
    select: { entityId: true, fileData: true, mimeType: true },
  });

  const out = new Map<string, string>();
  for (const row of rows) {
    // Newest first, so the first one seen for a supplier is the current one.
    if (out.has(row.entityId)) continue;
    if (!USABLE_LETTERHEAD_TYPES.includes(row.mimeType.toLowerCase())) continue;
    const base64 = Buffer.from(row.fileData).toString("base64");
    out.set(row.entityId, `data:${row.mimeType};base64,${base64}`);
  }
  return out;
}

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
  templateBody: string;
  context: LetterContext;
  onLetterhead: boolean;
  /** Used when a group's workers have no supplier of their own. */
  fallbackIssuerName: string;
}): Promise<{ sections: LetterSection[]; missingLetterheads: string[] }> {
  const groups = groupWorkersBySupplier(opts.workers);
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
          },
        })
      : Promise.resolve([]),
    opts.onLetterhead ? loadLetterheads(supplierIds) : Promise.resolve(new Map<string, string>()),
  ]);
  const supplierById = new Map(suppliers.map((s) => [s.id, s]));

  const missingLetterheads: string[] = [];
  const sections = groups.map((group) => {
    const supplier = group.supplierId ? supplierById.get(group.supplierId) : undefined;
    const issuerName = supplier?.fullName || supplier?.name || opts.fallbackIssuerName;
    const letterheadImage = group.supplierId
      ? (letterheads.get(group.supplierId) ?? null)
      : null;

    if (opts.onLetterhead && !letterheadImage) missingLetterheads.push(issuerName);

    const issuer: LetterIssuer = {
      name: issuerName,
      signatoryName: supplier?.contactPerson ?? null,
      signatoryPhone: supplier?.contactPhone ?? null,
      signatoryEmail: supplier?.contactEmail ?? null,
      letterheadImage,
    };

    const bodyText = substituteMergeFields(opts.templateBody, {
      CLIENTNAME: opts.context.clientName,
      CLIENTADDRESS: opts.context.clientAddress ?? "",
      PROJECTNAME: opts.context.projectName,
      COMPANYNAME: issuerName,
      SPONSORSHIPCOMPANYNAME: issuerName,
      BRANCHNAME: opts.context.branchName,
      DOCNO: String(opts.context.docNo),
      MOBILIZEDATE: opts.context.mobilizeDate
        ? formatLetterDate(opts.context.mobilizeDate)
        : "",
      DATE: formatLetterDate(opts.context.date),
      WORKERCOUNT: String(group.workers.length),
    });

    return { group, issuer, bodyText } satisfies LetterSection;
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
    supplierName: e.supplier?.fullName || e.supplier?.name || null,
  };
}

export type { LetterGroup };
