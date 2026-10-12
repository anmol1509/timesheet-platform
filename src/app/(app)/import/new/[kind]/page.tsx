import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { requireUserWithBranch } from "@/lib/auth";
import { isAdminRole } from "@/lib/roles";
import { TARGETS, isImportKind } from "@/lib/importer/targets";
import { ImportWizard } from "../../import-wizard";

export default async function NewImportPage({ params }: { params: Promise<{ kind: string }> }) {
  const { kind: raw } = await params;
  const kind = raw.toUpperCase();
  if (!isImportKind(kind)) notFound();
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  if (!isAdminRole(user.role)) redirect("/no-access");
  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader
        title={`Import ${TARGETS[kind].label.toLowerCase()}`}
        breadcrumbs={[{ label: "Import data", href: "/import" }, { label: TARGETS[kind].label }]}
        description="Upload your file, confirm the columns, review what will happen, then import. You can undo it afterwards."
      />
      {isSuperAdmin && !branchId && (
        <p className="rounded-lg border border-[var(--warning-border)] bg-[var(--warning-soft)] px-4 py-2 text-sm text-[var(--warning)]">
          You&apos;re viewing <strong>All branches</strong>. Pick a specific branch from the switcher (top right) before importing.
        </p>
      )}
      <ImportWizard kind={kind} />
    </div>
  );
}
