import { KeyRound } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { requireAdmin, resolveSuperAdminBranchId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SITE } from "@/app/welcome/content";
import { DevelopersManager, type KeyRow } from "./developers-manager";

export const metadata = { title: "Developers" };

export default async function DevelopersPage() {
  const admin = await requireAdmin();
  const branchId = admin.role === "SUPER_ADMIN" ? await resolveSuperAdminBranchId() : admin.branchId;

  const branch = branchId ? await prisma.branch.findUnique({ where: { id: branchId }, select: { name: true, apiAccess: true } }) : null;
  const keys = branchId
    ? await prisma.apiKey.findMany({ where: { branchId }, orderBy: [{ revokedAt: "asc" }, { createdAt: "desc" }], include: { createdBy: { select: { name: true } } } })
    : [];

  const rows: KeyRow[] = keys.map((k) => ({
    id: k.id,
    name: k.name,
    prefix: k.prefix,
    scopes: k.scopes,
    createdAt: k.createdAt.toISOString(),
    createdBy: k.createdBy.name,
    expiresAt: k.expiresAt?.toISOString() ?? null,
    lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
    revoked: !!k.revokedAt,
  }));

  const base = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "") || "https://login.manpowersync.com";

  return (
    <div className="space-y-5">
      <PageHeader
        title="Developers"
        icon={KeyRound}
        description="API keys let Zoho Books, Tally, attendance devices or your own software read data from this account. Each key sees only this company and only the permissions you give it."
      />
      {!branchId ? (
        <p className="card p-5 text-sm text-muted">Pick a branch from the switcher (top right) to manage its API keys.</p>
      ) : (
        <DevelopersManager keys={rows} enabled={!!branch?.apiAccess} branchName={branch?.name ?? ""} baseUrl={`${base}/api/v1`} salesEmail={SITE.salesEmail} />
      )}
    </div>
  );
}
