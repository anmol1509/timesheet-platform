import { redirect } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { requireUserWithBranch } from "@/lib/auth";
import { RESET_MODULES } from "@/lib/dataReset";
import { ResetModuleCard } from "./reset-module-card";

export default async function DataResetPage() {
  const { branchId, isSuperAdmin } = await requireUserWithBranch();
  if (!isSuperAdmin) redirect("/");

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

      <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p className="font-medium">This runs against the live database — there is no separate staging environment.</p>
          <p className="mt-0.5 text-red-700">
            Anything deleted here is gone for good. Super Admin only. Each module requires typing its name to confirm.
          </p>
        </div>
      </div>

      {!branchId && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          You&apos;re viewing <strong>All branches</strong>. Branch-scoped modules need a specific branch picked
          from the switcher (top right) before they can be reset.
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {modules.map((m) => (
          <ResetModuleCard
            key={m.id}
            id={m.id}
            label={m.label}
            description={m.description}
            branchScoped={m.branchScoped}
            dependsOnLabels={m.dependsOn.map((id) => labelById[id] ?? id)}
            count={m.count}
            disabled={m.branchScoped && !branchId}
          />
        ))}
      </div>
    </div>
  );
}
