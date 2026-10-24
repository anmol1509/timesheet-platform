/**
 * What an own company prints at the head of a timesheet, and what is missing from it. Pure, so the mapping can be
 * tested without a database. A field the company hasn't got stays blank: borrowing the branch's TRN or logo would put
 * another company's identity on the sheet.
 */
export type CompanyHeaderSource = {
  name: string;
  fullName: string | null;
  location: string | null;
  emirate: string | null;
  country: string | null;
  phone: string | null;
  contactEmail: string | null;
  poBox: string | null;
  trn: string | null;
  logoId: string | null;
};

const text = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);

/** The company's legal/display name as printed, both at the head of the sheet and in "Issued to". */
export const companyPrintedName = (c: Pick<CompanyHeaderSource, "name" | "fullName">) => text(c.fullName) ?? c.name;

/** The fields buildLetterhead takes, from an own company's profile. */
export function companyHeaderFields(c: CompanyHeaderSource) {
  return {
    name: companyPrintedName(c),
    address: text(c.location),
    emirate: text(c.emirate),
    country: text(c.country),
    phone: text(c.phone),
    fax: null,
    email: text(c.contactEmail),
    poBox: text(c.poBox),
    trn: text(c.trn),
    logoId: c.logoId,
    strictLogo: true,
  };
}

/** What a reader would expect on the header but the company hasn't got yet, in plain words. */
export function headerGaps(c: CompanyHeaderSource): string[] {
  const gaps: string[] = [];
  if (!c.logoId) gaps.push("logo");
  if (!text(c.trn)) gaps.push("TRN");
  if (!text(c.location)) gaps.push("address");
  if (!text(c.phone)) gaps.push("phone");
  if (!text(c.contactEmail)) gaps.push("email");
  return gaps;
}
