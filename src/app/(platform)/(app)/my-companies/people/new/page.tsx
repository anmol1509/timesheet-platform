import { redirect } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@/lib/db";
import { requireUserWithBranch, subjectOf } from "@/lib/auth";
import { canMyCompanies, canViewSensitive } from "@/lib/permissions";
import { activeDocTypes, isRequired, resolveDocTypes } from "@/lib/documentTypes";
import { PersonWizard } from "./person-wizard";

export const metadata = { title: "Add owner or sponsor" };

export default async function AddPersonPage({ searchParams }: { searchParams: Promise<{ person?: string }> }) {
  const { user, branchId } = await requireUserWithBranch();
  const subject = subjectOf(user);
  if (!canMyCompanies(subject, "edit")) redirect("/my-companies/people");
  const { person: personId } = await searchParams;

  const [typeRows, companies, people, existing] = await Promise.all([
    branchId ? prisma.documentType.findMany({ where: { branchId } }) : Promise.resolve([]),
    branchId ? prisma.supplier.findMany({ where: { branchId, isOwnCompany: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }) : Promise.resolve([]),
    branchId ? prisma.supplierParty.findMany({ where: { branchId }, select: { id: true, name: true }, orderBy: { name: "asc" } }) : Promise.resolve([]),
    // Assigning companies to someone already on the list skips the details and documents.
    personId && branchId ? prisma.supplierParty.findFirst({ where: { id: personId, branchId }, select: { id: true, name: true } }) : Promise.resolve(null),
  ]);
  const types = activeDocTypes(resolveDocTypes(typeRows, "SUPPLIER_PARTY")).filter((t) => t.key !== "OTHER");
  const slim = (t: { key: string; label: string; hasExpiry: boolean }) => ({ key: t.key, label: t.label, hasExpiry: t.hasExpiry, required: isRequired(t as never, false) });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title={existing ? `Assign ${existing.name}` : "Add owner or sponsor"}
        description={existing ? "Choose the companies this person owns or sponsors." : "Upload their documents and the details are read out of them for you to review. Then say which companies they belong to, if you know yet."}
        breadcrumbs={[{ label: "My Companies", href: "/my-companies" }, { label: "Owners & sponsors", href: "/my-companies/people" }, { label: existing ? "Assign" : "Add" }]}
      />
      <div className="card card-padded">
        <PersonWizard
          docTypes={types.map(slim)}
          companies={companies}
          people={people}
          existing={existing}
          canAddDocs={canViewSensitive(subject)}
        />
      </div>
    </div>
  );
}
