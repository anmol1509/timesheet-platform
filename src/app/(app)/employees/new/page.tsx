import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { AlertTriangle } from "lucide-react";
import { groupLookups } from "@/lib/lookups";
import { PageHeader } from "@/components/PageHeader";
import { EmployeeWizard } from "./wizard";

export default async function AddEmployeePage() {
  const { branchId, isSuperAdmin } = await requireUserWithBranch();
  const [projects, suppliers, sponsorshipCompanies, lookupValues] = await Promise.all([
    prisma.project.findMany({ where: branchWhere(branchId), orderBy: { name: "asc" } }),
    prisma.supplier.findMany({
      where: branchWhere(branchId),
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.sponsorshipCompany.findMany({ where: branchWhere(branchId), orderBy: { name: "asc" } }),
    prisma.lookupValue.findMany({
      where: { ...branchWhere(branchId), isActive: true },
      orderBy: [{ sortOrder: "asc" }, { value: "asc" }],
      select: { category: true, value: true },
    }),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader
        title="Add employee"
        description="Upload the worker's documents and the details are read out of them for you to review."
        breadcrumbs={[{ label: "Employees", href: "/employees" }, { label: "Add" }]}
      />

      {/* Warn up front rather than letting the whole form be filled in and
          then rejected — an employee must belong to exactly one branch. */}
      {!branchId && (
        <div className="flex items-start gap-2.5 rounded-card border border-[var(--warning-border)] bg-[var(--warning-soft)] px-4 py-3">
          <AlertTriangle
            className="mt-0.5 h-4 w-4 shrink-0 text-[var(--warning)]"
            aria-hidden
          />
          <p className="text-sm text-secondary">
            {isSuperAdmin ? (
              <>
                You have <span className="font-medium">All branches</span>{" "}
                selected. Pick a specific branch in the switcher above before
                adding an employee — otherwise this form can&rsquo;t be saved.
              </>
            ) : (
              <>
                Your account has no branch assigned, so employees can&rsquo;t be
                created. Contact an administrator.
              </>
            )}
          </p>
        </div>
      )}

      <div className="card card-padded">
        <EmployeeWizard
          projects={projects}
          suppliers={suppliers}
          sponsorshipCompanies={sponsorshipCompanies}
          lookups={groupLookups(lookupValues)}
        />
      </div>
    </div>
  );
}
