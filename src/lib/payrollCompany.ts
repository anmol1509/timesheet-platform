/**
 * Which of your own companies pays an employee. The visa-holding (sponsor)
 * company decides when it is one of your own, because the salary file goes
 * under the establishment that holds the labour card; otherwise it is the
 * employer. Anyone whose employer is not one of your own companies is not in
 * payroll at all. Pure, so the run, the pages and the tests agree.
 */
export type PayrollCompanyFacts = {
  supplierId: string | null;
  supplier: { isOwnCompany: boolean } | null;
  sponsorSupplierId: string | null;
  sponsorSupplier: { isOwnCompany: boolean } | null;
};

export function payrollCompanyId(e: PayrollCompanyFacts): string | null {
  if (!e.supplier?.isOwnCompany) return null;
  if (e.sponsorSupplierId && e.sponsorSupplier?.isOwnCompany) return e.sponsorSupplierId;
  return e.supplierId;
}

/** Prisma filter for the employees a run covers: the company's own people, or every own company's when no company is set. */
export function payrollScopeWhere(companyId: string | null) {
  if (!companyId) return { supplier: { isOwnCompany: true } };
  return {
    supplier: { isOwnCompany: true },
    OR: [
      { sponsorSupplierId: companyId, sponsorSupplier: { isOwnCompany: true } },
      { supplierId: companyId, OR: [{ sponsorSupplierId: null }, { sponsorSupplier: { isOwnCompany: false } }] },
    ],
  };
}

export const PAYROLL_COMPANY_SELECT = {
  supplierId: true,
  supplier: { select: { isOwnCompany: true } },
  sponsorSupplierId: true,
  sponsorSupplier: { select: { isOwnCompany: true } },
} as const;
