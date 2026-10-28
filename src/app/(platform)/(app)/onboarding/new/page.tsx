import { FilePlus2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@/lib/db";
import { requireUserWithBranch, subjectOf } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { branchWhere } from "@/lib/branch";
import { CandidateForm } from "../candidate-form";

export const metadata = { title: "New candidate" };

export default async function NewCandidatePage() {
  const { user, branchId } = await requireUserWithBranch();
  const canEdit = can(subjectOf(user), "onboarding.new", "edit");
  const [agencies, sponsors, agencyContacts, projects, demandRequests, hrUsers] = await Promise.all([
    prisma.supplier.findMany({ where: { ...branchWhere(branchId), isRecruitmentAgency: true, OR: [{ status: "ACTIVE" }] }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.supplier.findMany({ where: { ...branchWhere(branchId), isOwnCompany: true, status: "ACTIVE" }, select: { id: true, name: true }, orderBy: { name: "asc" } }),    prisma.agencyContact.findMany({ where: branchWhere(branchId), select: { id: true, name: true, agencyId: true }, orderBy: { name: "asc" } }),
    prisma.project.findMany({ where: branchWhere(branchId), select: { id: true, name: true, code: true }, orderBy: { name: "asc" } }),
    prisma.demandRequest.findMany({
      where: branchWhere(branchId),
      select: { id: true, requestNo: true, project: { select: { name: true } } },
      orderBy: { requestNo: "desc" },
      take: 100,
    }),
    prisma.user.findMany({ where: { ...branchWhere(branchId), isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Add candidate"
        icon={FilePlus2}
        description={<>Start tracking a candidate an agency has put forward. Nothing here creates an Employee record. That happens once they join.</>}
      />
      {!canEdit && <p className="rounded-lg border border-default bg-surface-subtle px-4 py-3 text-sm text-muted">You can look at this form, but your role doesn&rsquo;t include adding candidates.</p>}
      <CandidateForm readOnly={!canEdit} sponsors={sponsors} agencies={agencies} agencyContacts={agencyContacts} projects={projects} demandRequests={demandRequests} hrUsers={hrUsers} />
    </div>
  );
}
