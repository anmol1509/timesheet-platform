import { redirect } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@/lib/db";
import { requireUserWithBranch, subjectOf } from "@/lib/auth";
import { canMyCompanies, canViewSensitive } from "@/lib/permissions";
import { activeDocTypes, isRequired, resolveDocTypes } from "@/lib/documentTypes";
import { CompanyWizard } from "./wizard";
import { personLabel } from "../../suppliers/[id]/parties-section";

export const metadata = { title: "Add company" };

export default async function AddCompanyPage() {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const subject = subjectOf(user);
  if (!canMyCompanies(subject, "create")) redirect("/my-companies");

  const [typeRows, parents, people] = await Promise.all([
    branchId ? prisma.documentType.findMany({ where: { branchId } }) : Promise.resolve([]),
    branchId ? prisma.supplier.findMany({ where: { branchId, isOwnCompany: true, parentSupplierId: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }) : Promise.resolve([]),
    // Everyone already on file, so a person who serves another company is picked here instead of typed again.
    branchId ? prisma.supplierParty.findMany({ where: { branchId }, select: { id: true, name: true, links: { select: { role: true, supplier: { select: { name: true } } } } }, orderBy: { name: "asc" } }) : Promise.resolve([]),
  ]);
  const company = activeDocTypes(resolveDocTypes(typeRows, "SUPPLIER"));
  const partyKinds = activeDocTypes(resolveDocTypes(typeRows, "SUPPLIER_PARTY"));
  const slim = (t: { key: string; label: string; hasExpiry: boolean }) => ({ key: t.key, label: t.label, hasExpiry: t.hasExpiry });

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageHeader
        title="Add company"
        description="Upload the company's documents and the details are read out of them for you to review. Then add its owners and sponsors with their documents."
        breadcrumbs={[{ label: "My Companies", href: "/my-companies" }, { label: "Add" }]}
      />
      {!branchId && (
        <div className="flex items-start gap-2.5 rounded-card border border-[var(--warning-border)] bg-[var(--warning-soft)] px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--warning)]" aria-hidden />
          <p className="text-sm text-secondary">
            {isSuperAdmin ? "You have All branches selected. Pick a specific branch in the switcher above before adding a company — otherwise this form can't be saved." : "Your account has no branch assigned, so companies can't be created. Contact an administrator."}
          </p>
        </div>
      )}
      <div className="card card-padded">
        <CompanyWizard
          companyTypes={company.map(slim)}
          requiredCompanyTypes={company.filter((t) => isRequired(t, true)).map((t) => t.key)}
          partyTypes={partyKinds.map(slim)}
          requiredPartyTypes={partyKinds.filter((t) => isRequired(t, false)).map((t) => t.key)}
          existingPeople={people.map((p) => ({ id: p.id, label: personLabel(p.name, p.links) }))}
          parents={parents}
          canAddPersonalDocs={canViewSensitive(subject)}
        />
      </div>
    </div>
  );
}
