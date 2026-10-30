import { canMyCompanies, canViewPath, type PermissionSubject } from "@/lib/permissions";

/** Where a record renewal's document is filed, by the kind of record it is attached to. */
const ATTACHED_PATH: Record<string, string> = { QUOTATION: "/sales/quotations", ENQUIRY: "/sales/enquiries", SUPPLIER_BILL: "/finance/bills", EXPENSE: "/finance/expenses" };

/** The page a renewal's subject belongs to, which decides who may see and work on it. Null means anyone with Renewals. */
export function renewalPath(r: { kind: string; subjectId: string; href?: string | null; entityType?: string | null }): string | null {
  if (r.kind === "record") {
    if (r.subjectId.startsWith("clientdoc:")) return "/clients";
    if (r.subjectId.startsWith("projdoc:")) return "/projects";
    if (r.subjectId.startsWith("attach:")) return (r.entityType && ATTACHED_PATH[r.entityType]) || r.href || null;
    return r.href ?? null;
  }
  if (r.kind === "supplier") return "/suppliers";
  if (r.kind === "vehicle") return "/transport";
  return null;
}

/**
 * Whether this person may see, and so work on, a renewal. Renewals lists everything due, but a document filed on a client, a
 * project, a quotation, a bill or a vehicle is only for people who may open that area, and an owner's or sponsor's papers are
 * only for people with My Companies. Workers' own dates follow the Renewals permission itself.
 */
export function canSeeRenewal(subject: PermissionSubject, r: { kind: string; subjectId: string; href?: string | null; entityType?: string | null }): boolean {
  if (r.kind === "party") return canMyCompanies(subject);
  const path = renewalPath(r);
  return path === null || canViewPath(subject, path);
}
