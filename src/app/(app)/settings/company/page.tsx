import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { getSessionFromCookies } from "@/lib/session";
import { prisma } from "@/lib/db";
import { ImageUpload } from "@/components/ImageUpload";
import { CompanyForm } from "./company-form";
import { removeLogoAction, uploadLogoAction } from "./actions";

export const metadata = { title: "Company profile" };

export default async function CompanyProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ branch?: string }>;
}) {
  const admin = await requireAdmin();
  const isSuperAdmin = admin.role === "SUPER_ADMIN";
  const { branch: requested } = await searchParams;

  const branches = isSuperAdmin ? await prisma.branch.findMany({ orderBy: { code: "asc" } }) : [];
  const activeId = isSuperAdmin ? ((await getSessionFromCookies())?.activeBranchId ?? null) : null;
  const targetId = isSuperAdmin
    ? (requested && branches.some((b) => b.id === requested) ? requested : (activeId ?? branches[0]?.id ?? null))
    : admin.branchId;
  const branch = targetId ? await prisma.branch.findUnique({ where: { id: targetId } }) : null;

  if (!branch) {
    return <p className="text-sm text-muted">No company to edit — this account isn&apos;t attached to a branch.</p>;
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-primary">Company profile</h1>
        <p className="mt-1 text-sm text-muted">
          Your company&apos;s name and logo. They appear in the sidebar and on generated timesheets and invoices.
        </p>
      </div>

      {isSuperAdmin && branches.length > 1 && (
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Company">
          {branches.map((b) => (
            <Link
              key={b.id}
              href={`/settings/company?branch=${b.id}`}
              role="tab"
              aria-selected={b.id === branch.id}
              className={
                b.id === branch.id
                  ? "rounded-md bg-brand-soft px-3 py-1.5 text-sm font-medium text-[var(--brand-primary)]"
                  : "rounded-md px-3 py-1.5 text-sm text-secondary hover:bg-surface-hover"
              }
            >
              {b.code} · {b.name}
            </Link>
          ))}
        </div>
      )}

      <div className="card max-w-2xl space-y-6 p-5">
        <ImageUpload
          key={branch.id}
          currentUrl={branch.logoId ? `/api/images/${branch.logoId}` : null}
          fallback={<span className="text-2xl font-bold text-subtle">{branch.name.slice(0, 2).toUpperCase()}</span>}
          label="Company logo"
          hint="PNG or JPEG, square works best. Transparent PNGs keep their transparency."
          shape="square"
          format="image/png"
          maxPx={512}
          uploadAction={uploadLogoAction}
          removeAction={removeLogoAction}
          extraFields={{ branchId: branch.id }}
        />
        <CompanyForm key={branch.id} branch={branch} />
      </div>
    </div>
  );
}
