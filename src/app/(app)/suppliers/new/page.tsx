import { AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { requireUserWithBranch } from "@/lib/auth";
import { SupplierWizard } from "./wizard";

export const metadata = { title: "Add supplier" };

export default async function AddSupplierPage() {
  const { branchId, isSuperAdmin } = await requireUserWithBranch();
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader
        title="Add supplier"
        description="Upload the supplier's trade licence and other documents and the details are read out of them for you to review."
        breadcrumbs={[{ label: "Suppliers", href: "/suppliers" }, { label: "Add" }]}
      />
      {!branchId && (
        <div className="flex items-start gap-2.5 rounded-card border border-[var(--warning-border)] bg-[var(--warning-soft)] px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--warning)]" aria-hidden />
          <p className="text-sm text-secondary">
            {isSuperAdmin ? "You have All branches selected. Pick a specific branch in the switcher above before adding a supplier — otherwise this form can't be saved." : "Your account has no branch assigned, so suppliers can't be created. Contact an administrator."}
          </p>
        </div>
      )}
      <div className="card card-padded">
        <SupplierWizard />
      </div>
    </div>
  );
}
