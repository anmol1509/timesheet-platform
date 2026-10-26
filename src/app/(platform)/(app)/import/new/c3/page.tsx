import { redirect } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { requireUserWithBranch } from "@/lib/auth";
import { isAdminRole } from "@/lib/roles";
import { C3Linker } from "./c3-linker";

export const metadata = { title: "Link C3 IDs" };

export default async function ImportC3Page() {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  if (!isAdminRole(user.role)) redirect("/no-access");
  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader
        title="Link C3 IDs"
        breadcrumbs={[{ label: "Import data", href: "/import" }, { label: "C3 IDs" }]}
        description="Upload a sheet with each worker's name and C3 ID and link it to the workers you already have. Names are matched whatever the word order; anything unsure is for you to confirm. Nothing is saved until you press Save."
      />
      {isSuperAdmin && !branchId && (
        <p className="rounded-lg border border-[var(--warning-border)] bg-[var(--warning-soft)] px-4 py-2 text-sm text-[var(--warning)]">
          You&apos;re viewing <strong>All branches</strong>. Pick a specific branch from the switcher (top right) first.
        </p>
      )}
      <C3Linker />
    </div>
  );
}
