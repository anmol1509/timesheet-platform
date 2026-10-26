import { prisma } from "@/lib/db";
import { isOutsideBranch } from "@/lib/branch";
import { buildLetterhead, type Letterhead } from "@/lib/letterhead";
import { companyHeaderFields, companyPrintedName, headerGaps } from "@/lib/issuerHeader";

/**
 * Who a generated timesheet is issued by: the branch's own details (what every sheet used before), or one of the
 * branch's own companies, whose name, address, TRN and logo then head the sheet.
 */
export type Issuer = {
  /** The own company chosen, or null for the branch's own details. */
  companyId: string | null;
  /** The "Issued to" name printed on the sheet and kept in the history. */
  issuedTo: string;
  letterhead: Letterhead;
  /** The logo for Excel sheets: only an uploaded one, never the stand-in image, so existing workbooks don't change for branches that have none. */
  xlsxLogo: string | null;
};

/**
 * `fallbackName` only matters on the branch path: it is what prints when the branch has no name set, so a sheet is never
 * issued with a blank heading. Callers differ on it, which keeps their output exactly as it was.
 */
export async function resolveIssuer(opts: { branchId: string; isSuperAdmin: boolean; companyId?: string | null; fallbackName?: string }): Promise<Issuer | { error: string }> {
  const { branchId, isSuperAdmin, fallbackName = "" } = opts;
  const companyId = opts.companyId || null;

  if (!companyId) {
    const branch = await prisma.branch.findUnique({ where: { id: branchId } });
    const letterhead = await buildLetterhead({
        name: branch?.name ?? fallbackName,
        address: branch?.address ?? null,
        emirate: branch?.emirate ?? null,
        country: branch?.country ?? null,
        phone: branch?.phone ?? null,
        fax: branch?.fax ?? null,
        email: branch?.email ?? null,
        poBox: branch?.poBox ?? null,
        trn: branch?.trn ?? null,
        logoId: branch?.logoId ?? null,
    });
    return { companyId: null, issuedTo: branch?.issuedTo || branch?.name || fallbackName, letterhead, xlsxLogo: branch?.logoId ? letterhead.logo : null };
  }

  const company = await prisma.supplier.findFirst({ where: { id: companyId, isOwnCompany: true } });
  if (!company || company.branchId !== branchId || isOutsideBranch(company.branchId, branchId, isSuperAdmin)) {
    return { error: "That company isn't one of your own companies in this branch. Pick another under \"Issued by\"." };
  }
  const letterhead = await buildLetterhead(companyHeaderFields(company));
  return { companyId: company.id, issuedTo: companyPrintedName(company), letterhead, xlsxLogo: letterhead.logo };
}

export type IssuerOption = { id: string; name: string; gaps: string[] };

/**
 * What the "Issued by" picker offers: the branch's own companies (empty when there are none, in which case the picker is
 * not shown), the name the branch's own details print under, and the person's last choice so repeat runs are one click.
 */
export async function getIssuerOptions(branchId: string | null, userId: string): Promise<{ companies: IssuerOption[]; branchName: string; defaultId: string | null; /** Why there is nothing to pick, so the screen can say so instead of hiding the picker. */ reason: "ok" | "no-branch" | "none" }> {
  if (!branchId) return { companies: [], branchName: "", defaultId: null, reason: "no-branch" };
  const [branch, companies, last] = await Promise.all([
    prisma.branch.findUnique({ where: { id: branchId }, select: { name: true, issuedTo: true } }),
    prisma.supplier.findMany({
      where: { branchId, isOwnCompany: true, status: "ACTIVE" },
      select: { id: true, name: true, fullName: true, location: true, emirate: true, country: true, phone: true, contactEmail: true, poBox: true, trn: true, logoId: true },
      orderBy: { name: "asc" },
    }),
    prisma.generatedSheet.findFirst({ where: { generatedById: userId, branchId }, orderBy: { generatedAt: "desc" }, select: { issuedCompanyId: true } }),
  ]);
  const options = companies.map((c) => ({ id: c.id, name: companyPrintedName(c), gaps: headerGaps(c) }));
  return {
    companies: options,
    branchName: branch?.issuedTo || branch?.name || "Branch details",
    defaultId: last?.issuedCompanyId && options.some((o) => o.id === last.issuedCompanyId) ? last.issuedCompanyId : null,
    reason: options.length > 0 ? "ok" : "none",
  };
}
