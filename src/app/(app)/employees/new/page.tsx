import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { groupLookups } from "@/lib/lookups";
import { EmployeeWizard } from "./wizard";

export default async function AddEmployeePage() {
  const { branchId } = await requireUserWithBranch();
  const [projects, sponsorshipCompanies, lookupValues] = await Promise.all([
    prisma.project.findMany({ where: branchWhere(branchId), orderBy: { name: "asc" } }),
    prisma.sponsorshipCompany.findMany({ where: branchWhere(branchId), orderBy: { name: "asc" } }),
    prisma.lookupValue.findMany({
      where: { ...branchWhere(branchId), isActive: true },
      orderBy: [{ sortOrder: "asc" }, { value: "asc" }],
      select: { category: true, value: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl tracking-tight text-primary font-semibold">
          Add New Employee
        </h1>
        <p className="mt-1 text-sm text-muted">
          Register a new worker with all required documentation.
        </p>
      </div>

      <div className="card p-6">
        <h2 className="mb-4 text-base font-semibold text-primary">
          Employee Registration
        </h2>
        <EmployeeWizard
          projects={projects}
          sponsorshipCompanies={sponsorshipCompanies}
          lookups={groupLookups(lookupValues)}
        />
      </div>
    </div>
  );
}
