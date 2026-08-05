import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { EmployeeWizard } from "./wizard";

export default async function AddEmployeePage() {
  const { branchId } = await requireUserWithBranch();
  const [projects, sponsorshipCompanies] = await Promise.all([
    prisma.project.findMany({ where: branchWhere(branchId), orderBy: { name: "asc" } }),
    prisma.sponsorshipCompany.findMany({ where: branchWhere(branchId), orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">
          Add New Employee
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Register a new worker with all required documentation.
        </p>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6">
        <h2 className="mb-4 text-base font-semibold text-slate-900">
          Employee Registration
        </h2>
        <EmployeeWizard projects={projects} sponsorshipCompanies={sponsorshipCompanies} />
      </div>
    </div>
  );
}
