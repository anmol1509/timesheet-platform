import { KeyRound } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { requireAdmin, resolveSuperAdminBranchId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SITE } from "@/app/welcome/content";
import { after } from "next/server";
import { processDue } from "@/lib/webhooks/deliver";
import { WebhooksManager } from "./webhooks-manager";
import { DevelopersManager, type KeyRow } from "./developers-manager";

export const metadata = { title: "Developers" };

export default async function DevelopersPage() {
  const admin = await requireAdmin();
  const branchId = admin.role === "SUPER_ADMIN" ? await resolveSuperAdminBranchId() : admin.branchId;

  const branch = branchId ? await prisma.branch.findUnique({ where: { id: branchId }, select: { name: true, apiAccess: true } }) : null;
  const keys = branchId
    ? await prisma.apiKey.findMany({ where: { branchId }, orderBy: [{ revokedAt: "asc" }, { createdAt: "desc" }], include: { createdBy: { select: { name: true } } } })
    : [];

  const [endpoints, deliveries] = branchId && branch?.apiAccess
    ? await Promise.all([
        prisma.webhookEndpoint.findMany({ where: { branchId }, orderBy: { createdAt: "asc" } }),
        prisma.webhookDelivery.findMany({ where: { branchId }, orderBy: { createdAt: "desc" }, take: 15 }),
      ])
    : [[], []];
  // Opening this page is a good moment to retry anything that is due.
  if (branchId && branch?.apiAccess) after(() => processDue({ branchId, limit: 20 }).catch(() => undefined));

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
        <DevelopersManager keys={rows} enabled={!!branch?.apiAccess} branchName={branch?.name ?? ""} baseUrl={`${base}/api/v1`} salesEmail={SITE.salesEmail}>
          <WebhooksManager
            endpoints={endpoints.map((e) => ({ id: e.id, url: e.url, description: e.description, events: e.events, secretHint: e.secretHint, isActive: e.isActive, disabledReason: e.disabledReason, lastDeliveryAt: e.lastDeliveryAt?.toISOString() ?? null, lastStatusCode: e.lastStatusCode }))}
            deliveries={deliveries.map((d) => ({ id: d.id, endpointId: d.endpointId, type: d.type, status: d.status, attempts: d.attempts, lastStatusCode: d.lastStatusCode, lastError: d.lastError, createdAt: d.createdAt.toISOString(), nextAttemptAt: d.nextAttemptAt?.toISOString() ?? null }))}
          />
        </DevelopersManager>
      )}
    </div>
  );
}
