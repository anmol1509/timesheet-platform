import { prisma } from "@/lib/db";
import { requireUserWithBranch, subjectOf } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/PageHeader";
import { ContactsBoard } from "./contacts-board";

export const metadata = { title: "Supplier portal contacts" };

/** The contact cards suppliers see under Support in their portal. */
export default async function PortalContactsPage() {
  const { user, branchId } = await requireUserWithBranch();
  const subject = subjectOf(user);
  const rows = await prisma.portalContact.findMany({ where: branchWhere(branchId), orderBy: [{ sortOrder: "asc" }, { department: "asc" }] });
  return (
    <div className="space-y-5">
      <PageHeader title="Supplier portal contacts" description="Who suppliers are told to contact, by department. These appear on the Support page of their portal." />
      <ContactsBoard
        rows={rows.map((c) => ({ id: c.id, department: c.department, personName: c.personName, designation: c.designation, phone: c.phone, email: c.email, isActive: c.isActive }))}
        canEdit={!!branchId && can(subject, "partners", "edit")}
        canDelete={can(subject, "partners", "delete")}
      />
    </div>
  );
}
