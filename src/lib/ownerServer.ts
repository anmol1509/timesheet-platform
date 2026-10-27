import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/auth";
import { isOwnerUser } from "@/lib/owner";
import { customerSecret, signRequest } from "@/lib/ownerApi";
import { collectStats, type CustomerStats } from "@/lib/ownerStats";
import { grantBranchCredits, setBranchAllowance } from "@/lib/aiCreditsServer";

/** Everything under /owner is for the owner only, and only on the owner's own deployment (OWNER_CONSOLE=1). Anyone else gets "not found". */
export async function requireOwner() {
  if (process.env.OWNER_CONSOLE !== "1") notFound();
  const user = await requireSuperAdmin();
  if (!isOwnerUser(user)) notFound();
  return user;
}

export const ownerConsoleOn = () => process.env.OWNER_CONSOLE === "1";

export type CustomerRow = NonNullable<Awaited<ReturnType<typeof prisma.customer.findUnique>>>;
type Reach = { ok: true; data: unknown } | { ok: false; error: string };

/** One signed call to a customer's own deployment. */
export async function callCustomer(c: { code: string; appUrl: string | null }, method: "GET" | "POST", path: string, payload?: unknown): Promise<Reach> {
  const master = process.env.OWNER_MASTER_SECRET;
  if (!master) return { ok: false, error: "OWNER_MASTER_SECRET isn't set on this deployment, so customers with their own deployment can't be reached." };
  if (!c.appUrl) return { ok: false, error: "This customer has no deployment address yet." };
  const body = payload === undefined ? "" : JSON.stringify(payload);
  const ts = Date.now();
  try {
    const res = await fetch(`${c.appUrl.replace(/\/$/, "")}${path}`, {
      method,
      headers: { "content-type": "application/json", "x-owner-timestamp": String(ts), "x-owner-signature": signRequest(customerSecret(master, c.code), ts, method, path, body) },
      body: method === "GET" ? undefined : body,
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, error: (json && typeof json.error === "string" && json.error) || `Their deployment answered ${res.status}.` };
    return { ok: true, data: json };
  } catch (e) {
    return { ok: false, error: e instanceof Error && e.name === "TimeoutError" ? "Their deployment didn't answer in time." : "Couldn't reach their deployment." };
  }
}

export async function addEvent(customerId: string, kind: string, text: string, byName?: string | null) {
  await prisma.customerEvent.create({ data: { customerId, kind, text: text.slice(0, 500), byName: byName ?? null } });
}

/** Reads how a customer is getting on and keeps it, so the list can show it without calling every customer. */
export async function syncCustomer(c: CustomerRow): Promise<{ stats: CustomerStats } | { error: string }> {
  let stats: CustomerStats;
  if (c.hosting === "SHARED") {
    if (!c.branchId) return { error: "This customer isn't linked to a company here." };
    stats = await collectStats([c.branchId]);
  } else {
    const r = await callCustomer(c, "GET", "/api/owner/stats");
    if (!r.ok) return { error: r.error };
    stats = r.data as CustomerStats;
  }
  await prisma.customer.update({ where: { id: c.id }, data: { lastStats: stats as object, lastSyncAt: new Date() } });
  return { stats };
}

/** Sets a customer's monthly credits and/or adds credits for this month, wherever their data lives. */
export async function applyCredits(c: CustomerRow, change: { setMonthly?: number; grant?: { credits: number; note: string | null } }, byId: string | null): Promise<{ ok: true } | { error: string }> {
  if (c.hosting === "SHARED") {
    if (!c.branchId) return { error: "This customer isn't linked to a company here." };
    if (change.setMonthly !== undefined) await setBranchAllowance(c.branchId, change.setMonthly);
    if (change.grant) await grantBranchCredits(c.branchId, change.grant.credits, change.grant.note, byId);
  } else {
    const r = await callCustomer(c, "POST", "/api/owner/credits", { code: c.code, setMonthly: change.setMonthly, grant: change.grant ? { credits: change.grant.credits, note: change.grant.note ?? undefined } : undefined });
    if (!r.ok) return { error: r.error };
  }
  if (change.setMonthly !== undefined) await prisma.customer.update({ where: { id: c.id }, data: { aiMonthlyCredits: change.setMonthly } });
  await syncCustomer(c).catch(() => undefined);
  return { ok: true };
}

export async function applySuspended(c: CustomerRow, suspended: boolean): Promise<{ ok: true } | { error: string }> {
  if (c.hosting === "SHARED") {
    if (!c.branchId) return { error: "This customer isn't linked to a company here." };
    await prisma.branch.update({ where: { id: c.branchId }, data: { suspendedAt: suspended ? new Date() : null } });
  } else {
    const r = await callCustomer(c, "POST", "/api/owner/suspend", { suspended });
    if (!r.ok) return { error: r.error };
  }
  return { ok: true };
}
