import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { CandidateForm } from "../candidate-form";

export default async function NewCandidatePage() {
  const { branchId } = await requireUserWithBranch();
  const [agencies, agencyContacts, projects, demandRequests, hrUsers] = await Promise.all([
    prisma.supplier.findMany({ where: branchWhere(branchId), select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.agencyContact.findMany({ where: branchWhere(branchId), select: { id: true, name: true, agencyId: true }, orderBy: { name: "asc" } }),
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
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-primary">Add candidate</h1>
        <p className="mt-1 text-sm text-muted">
          Start tracking a candidate an agency has put forward. Nothing here creates an Employee record — that happens once they join.
        </p>
      </div>
      <CandidateForm agencies={agencies} agencyContacts={agencyContacts} projects={projects} demandRequests={demandRequests} hrUsers={hrUsers} />
    </div>
  );
}
