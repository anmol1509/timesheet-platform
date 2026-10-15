import { redirect } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { requireUserWithBranch } from "@/lib/auth";
import { RESET_MODULES } from "@/lib/dataReset";
import { ResetModuleCard } from "./reset-module-card";
import { ResetAllCard } from "./reset-all-card";

export default async function DataResetPage() {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  // Same rule as the actions: a super admin, or a branch admin who belongs to a
  // branch. Everyone else — including a branch-less branch admin — is turned away.
  if (!isSuperAdmin && !(user.role === "BRANCH_ADMIN" && branchId)) redirect("/");

  const modules = await Promise.all(
    RESET_MODULES.map(async (m) => ({
      id: m.id,
      label: m.label,
      description: m.description,
      branchScoped: m.branchScoped,
      dependsOn: m.dependsOn ?? [],
      count: await m.count(m.branchScoped ? branchId : null),
    }))
  );

  const labelById = Object.fromEntries(RESET_MODULES.map((m) => [m.id, m.label]));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Data Reset"
        description="Permanently delete a module's data to reset for testing. Every reset is logged to the Audit Log and cannot be undone."
      />

      <div className="flex items-start gap-3 rounded-lg border border-[var(--error-border)] bg-[var(--error-soft)] px-4 py-3 text-sm text-[var(--error)]">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p className="font-medium">This runs against the live database — there is no separate staging environment.</p>
          <p className="mt-0.5 text-[var(--error)]">
            Anything deleted here is gone for good. Admins only{branchId ? ", and only for your own branch" : ""}. Each module requires typing its name to confirm.
          </p>
        </div>
      </div>

      {!branchId && (
        <p className="rounded-lg border border-[var(--warning-border)] bg-[var(--warning-soft)] px-4 py-2 text-sm text-[var(--warning)]">
          You&apos;re viewing <strong>All branches</strong>. Resetting a module now will run across every branch,
          not just one — each one will ask you to confirm that before it runs. Pick a specific branch from the
          switcher (top right) to scope a reset to just that branch instead.
        </p>
      )}

      <ResetAllCard totalCount={modules.reduce((sum, m) => sum + m.count, 0)} allBranches={!branchId} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {modules.map((m) => (
          <ResetModuleCard
            key={m.id}
            id={m.id}
            label={m.label}
            description={m.description}
            // "Global" whenever this particular run would affect every
            // branch — either the module was never split by branch, or no
            // specific branch is currently selected.
            global={!m.branchScoped || !branchId}
            dependsOnLabels={m.dependsOn.map((id) => labelById[id] ?? id)}
            count={m.count}
          />
        ))}
      </div>
    </div>
  );
}
