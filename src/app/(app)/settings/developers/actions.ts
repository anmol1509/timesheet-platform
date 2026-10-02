"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin, resolveSuperAdminBranchId } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { generateApiKey, isScope } from "@/lib/api/keys";

type State = { error: string | null; secret?: string; name?: string };
const MAX_ACTIVE_KEYS = 10;

async function branchFor(admin: Awaited<ReturnType<typeof requireAdmin>>) {
  return admin.role === "SUPER_ADMIN" ? await resolveSuperAdminBranchId() : admin.branchId;
}

export async function createApiKeyAction(_prev: State, formData: FormData): Promise<State> {
  const admin = await requireAdmin();
  const branchId = await branchFor(admin);
  if (!branchId) return { error: "Pick a branch from the switcher first." };

  const branch = await prisma.branch.findUnique({ where: { id: branchId }, select: { apiAccess: true, isActive: true } });
  if (!branch?.isActive) return { error: "That branch is not active." };
  if (!branch.apiAccess) return { error: "API access is part of the Pro and Custom plans. Contact us to switch it on." };

  const name = String(formData.get("name") || "").trim();
  if (name.length < 2 || name.length > 60) return { error: "Give the key a name of 2 to 60 characters, such as “Zoho Books sync”." };
  const scopes = [...new Set(formData.getAll("scopes").map(String))];
  if (scopes.length === 0) return { error: "Choose at least one permission for this key." };
  if (!scopes.every(isScope)) return { error: "One of the permissions is not valid." };

  let expiresAt: Date | null = null;
  const rawExpiry = String(formData.get("expiresAt") || "").trim();
  if (rawExpiry) {
    expiresAt = new Date(rawExpiry);
    if (Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date()) return { error: "The expiry date must be in the future." };
  }

  const active = await prisma.apiKey.count({ where: { branchId, revokedAt: null } });
  if (active >= MAX_ACTIVE_KEYS) return { error: `You can have up to ${MAX_ACTIVE_KEYS} active keys. Revoke one you no longer use first.` };

  const { secret, hash, prefix } = generateApiKey();
  const created = await prisma.apiKey.create({
    data: { name, prefix, keyHash: hash, scopes, branchId, createdById: admin.id, expiresAt },
  });
  await logAudit({
    entityType: "API_KEY",
    entityId: created.id,
    action: "CREATE",
    after: { name, prefix, scopes, expiresAt: expiresAt?.toISOString() ?? null },
    userId: admin.id,
    userName: admin.name,
    branchId,
  });
  revalidatePath("/settings/developers");
  // The only time the full secret exists outside the customer's own copy.
  return { error: null, secret, name };
}

export async function revokeApiKeyAction(formData: FormData): Promise<{ error: string | null }> {
  const admin = await requireAdmin();
  const branchId = await branchFor(admin);
  const id = String(formData.get("id") || "");
  const key = await prisma.apiKey.findUnique({ where: { id }, select: { id: true, name: true, prefix: true, branchId: true, revokedAt: true } });
  if (!key || key.branchId !== branchId) return { error: "Key not found." };
  if (key.revokedAt) return { error: null };
  await prisma.apiKey.update({ where: { id }, data: { revokedAt: new Date() } });
  await logAudit({
    entityType: "API_KEY",
    entityId: id,
    action: "DELETE",
    before: { name: key.name, prefix: key.prefix },
    userId: admin.id,
    userName: admin.name,
    branchId: key.branchId,
  });
  revalidatePath("/settings/developers");
  return { error: null };
}
