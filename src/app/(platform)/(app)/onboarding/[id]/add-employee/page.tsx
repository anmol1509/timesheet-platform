import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireUserWithBranch, subjectOf } from "@/lib/auth";
import { branchWhere, isOutsideBranch } from "@/lib/branch";
import { can } from "@/lib/permissions";
import { initialsOf, nextEmployeeId } from "@/lib/supplierRequests";
import { employeeDocType } from "@/lib/onboardingEmployee";
import { AddEmployeeForm } from "./add-employee-form";

export const metadata = { title: "Add to employees" };

const iso = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : "");

export default async function AddEmployeePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const candidate = await prisma.candidateOnboarding.findUnique({ where: { id }, include: { agency: { select: { id: true, name: true } } } });
  if (!candidate || isOutsideBranch(candidate.branchId, branchId, isSuperAdmin)) notFound();
  if (candidate.joined) redirect(`/onboarding/${id}`);

  const [suppliers, projects, files, history] = await Promise.all([
    prisma.supplier.findMany({ where: branchWhere(candidate.branchId), select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.project.findMany({ where: branchWhere(candidate.branchId), select: { id: true, name: true, code: true }, orderBy: { name: "asc" } }),
    prisma.attachment.findMany({ where: { entityType: "CANDIDATE_ONBOARDING", entityId: id }, select: { id: true, docType: true, filename: true, expiryDate: true }, orderBy: { uploadedAt: "asc" } }),
    prisma.candidateOnboardingHistory.findMany({ where: { onboardingId: id, OR: [{ expiryDate: { not: null } }, { referenceNo: { not: null } }] }, orderBy: { updatedAt: "desc" }, select: { stage: true, referenceNo: true, expiryDate: true } }),
  ]);

  // What the steps already recorded: the latest expiry and reference per step, used to prefill the papers.
  const latest = (stage: string) => history.find((h) => h.stage === stage);

  // The ID that will be given, shown so there are no surprises. Left blank on the form, it is generated when the person is added.
  const prefix = initialsOf(candidate.agency?.name ?? "");
  const taken = prefix ? await prisma.employee.findMany({ where: { employeeIdNo: { startsWith: prefix } }, select: { employeeIdNo: true } }) : [];
  const proposedId = prefix ? nextEmployeeId(prefix, taken.map((t) => t.employeeIdNo)) : "";

  return (
    <div className="max-w-4xl space-y-5">
      <div>
        <Link href={`/onboarding/${id}`} className="inline-flex items-center gap-1 text-sm text-muted hover:underline">
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> {candidate.candidateName}
        </Link>
        <h1 className="mt-2 text-xl font-semibold tracking-tight text-primary">Add {candidate.candidateName} to employees</h1>
        <p className="mt-1 text-sm text-muted">Everything below is filled in from the candidate. Check it, change anything that is wrong, and add the worker. Only the name, passport number and company are required; the rest can come later.</p>
      </div>
      <AddEmployeeForm
        candidateId={candidate.id}
        ready={candidate.readyToJoin}
        canEditPay={can(subjectOf(user), "payroll", "edit")}
        proposedId={proposedId}
        suppliers={suppliers}
        projects={projects.map((p) => ({ id: p.id, name: `${p.code} · ${p.name}` }))}
        files={files.map((f) => ({ id: f.id, name: f.filename, docType: employeeDocType(f.docType), expiry: iso(f.expiryDate) }))}
        initial={{
          name: candidate.candidateName, supplierId: candidate.agencyId ?? "", projectId: candidate.projectId ?? "", trade: candidate.trade ?? "", nationality: candidate.nationality ?? "",
          gender: candidate.gender ?? "", bloodGroup: candidate.bloodGroup ?? "", mobileNumber: candidate.phone ?? "", dateOfBirth: iso(candidate.dateOfBirth),
          passportNumber: candidate.passportNumber ?? "", emiratesId: candidate.emiratesId ?? "", joinDate: iso(new Date()),
          visaNumber: latest("ID_VISA")?.referenceNo ?? latest("ENTRY_PERMIT")?.referenceNo ?? "", visaExpiry: iso(latest("ID_VISA")?.expiryDate), medicalExpiry: iso(latest("MEDICAL")?.expiryDate),
        }}
      />
    </div>
  );
}
