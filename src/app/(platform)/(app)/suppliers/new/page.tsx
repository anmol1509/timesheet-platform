import { AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { requireUserWithBranch } from "@/lib/auth";
import { SupplierWizard } from "./wizard";

export const metadata = { title: "Add supplier" };

export default async function AddSupplierPage() {
  const { branchId, isSuperAdmin } = await requireUserWithBranch();
  return (
    <div className="form-comfy mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Add supplier"
        description="Upload the supplier's trade licence and other documents and the details are read out of them for you to review."
        breadcrumbs={[{ label: "Suppliers", href: "/suppliers" }, { label: "Add" }]}
      />
      {!branchId && (
        <div className="flex items-start gap-2.5 rounded-card border border-[var(--warning-border)] bg-[var(--warning-soft)] px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--warning)]" aria-hidden />
          <p className="text-sm text-secondary">
            {isSuperAdmin ? "You have All companies selected. Sign in as a company administrator before adding a supplier. Otherwise this form can't be saved." : "Your account has no company assigned, so suppliers can't be created. Contact an administrator."}
          </p>
        </div>
      )}
      <div className="card card-padded">
        <SupplierWizard />
      </div>
    </div>
  );
}
