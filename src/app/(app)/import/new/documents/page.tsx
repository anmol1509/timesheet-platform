import { redirect } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { requireUserWithBranch } from "@/lib/auth";
import { isAdminRole } from "@/lib/roles";
import { DocumentsWizard } from "./documents-wizard";

export default async function ImportDocumentsPage() {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  if (!isAdminRole(user.role)) redirect("/no-access");
  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader
        title="Import documents"
        breadcrumbs={[{ label: "Import data", href: "/import" }, { label: "Documents" }]}
        description="Drop many files at once and file each against the right worker or supplier. Nothing is saved until you've checked who each file belongs to, and the whole upload can be undone."
      />
      {isSuperAdmin && !branchId && (
        <p className="rounded-lg border border-[var(--warning-border)] bg-[var(--warning-soft)] px-4 py-2 text-sm text-[var(--warning)]">
          You&apos;re viewing <strong>All branches</strong>. Pick a specific branch from the switcher (top right) before importing.
        </p>
      )}
      <DocumentsWizard />
    </div>
  );
}
