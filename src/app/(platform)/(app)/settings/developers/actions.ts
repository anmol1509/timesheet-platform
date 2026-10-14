"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin, resolveSuperAdminBranchId } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { generateApiKey, isScope } from "@/lib/api/keys";
import { encryptSecret, newSigningSecret } from "@/lib/webhooks/crypto";
import { isEventType } from "@/lib/webhooks/events";
import { resolveSafeTarget } from "@/lib/webhooks/safeUrl";
import { resendDelivery, sendTestEvent } from "@/lib/webhooks/deliver";

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

// ---------------------------------------------------------------- webhooks
const MAX_ENDPOINTS = 5;
export type HookState = { error: string | null; secret?: string; url?: string };
export type HookResult = { error: string | null; message?: string };

async function ownEndpoint(admin: Awaited<ReturnType<typeof requireAdmin>>, id: string) {
  const branchId = await branchFor(admin);
  const ep = await prisma.webhookEndpoint.findUnique({ where: { id } });
  return ep && ep.branchId === branchId ? ep : null;
}

function readEvents(formData: FormData): string[] | string {
  const events = [...new Set(formData.getAll("events").map(String))];
  if (events.length === 0) return "Choose at least one event to send.";
  if (!events.every(isEventType)) return "One of the events is not valid.";
  return events;
}

export async function createWebhookEndpointAction(_prev: HookState, formData: FormData): Promise<HookState> {
  const admin = await requireAdmin();
  const branchId = await branchFor(admin);
  if (!branchId) return { error: "Pick a branch from the switcher first." };
  const branch = await prisma.branch.findUnique({ where: { id: branchId }, select: { apiAccess: true, isActive: true } });
  if (!branch?.isActive) return { error: "That branch is not active." };
  if (!branch.apiAccess) return { error: "Webhooks are part of the Pro and Custom plans. Contact us to switch them on." };

  const events = readEvents(formData);
  if (typeof events === "string") return { error: events };
  const description = String(formData.get("description") || "").trim().slice(0, 100) || null;
  let url: string;
  try {
    url = (await resolveSafeTarget(String(formData.get("url") || ""))).url.toString();
  } catch (e) {
    return { error: e instanceof Error ? e.message : "That web address isn't valid." };
  }
  if ((await prisma.webhookEndpoint.count({ where: { branchId } })) >= MAX_ENDPOINTS) return { error: `You can have up to ${MAX_ENDPOINTS} webhook endpoints. Delete one you no longer use first.` };

  const secret = newSigningSecret();
  const created = await prisma.webhookEndpoint.create({
    data: { url, description, events, secretEnc: encryptSecret(secret), secretHint: secret.slice(-4), branchId, createdById: admin.id },
  });
  await logAudit({ entityType: "WEBHOOK_ENDPOINT", entityId: created.id, action: "CREATE", after: { url, events, description }, userId: admin.id, userName: admin.name, branchId });
  revalidatePath("/settings/developers");
  return { error: null, secret, url };
}

export async function updateWebhookEndpointAction(_prev: HookResult, formData: FormData): Promise<HookResult> {
  const admin = await requireAdmin();
  const ep = await ownEndpoint(admin, String(formData.get("id") || ""));
  if (!ep) return { error: "Endpoint not found." };
  const events = readEvents(formData);
  if (typeof events === "string") return { error: events };
  const description = String(formData.get("description") || "").trim().slice(0, 100) || null;
  await prisma.webhookEndpoint.update({ where: { id: ep.id }, data: { events, description } });
  await logAudit({ entityType: "WEBHOOK_ENDPOINT", entityId: ep.id, action: "UPDATE", before: { events: ep.events, description: ep.description }, after: { events, description }, userId: admin.id, userName: admin.name, branchId: ep.branchId });
  revalidatePath("/settings/developers");
  return { error: null };
}

export async function toggleWebhookEndpointAction(formData: FormData): Promise<HookResult> {
  const admin = await requireAdmin();
  const ep = await ownEndpoint(admin, String(formData.get("id") || ""));
  if (!ep) return { error: "Endpoint not found." };
  const on = formData.get("active") === "1";
  await prisma.webhookEndpoint.update({ where: { id: ep.id }, data: { isActive: on, ...(on ? { consecutiveFailures: 0, disabledReason: null } : { disabledReason: "Switched off by an admin." }) } });
  await logAudit({ entityType: "WEBHOOK_ENDPOINT", entityId: ep.id, action: "UPDATE", before: { isActive: ep.isActive }, after: { isActive: on }, userId: admin.id, userName: admin.name, branchId: ep.branchId });
  revalidatePath("/settings/developers");
  return { error: null };
}

export async function deleteWebhookEndpointAction(formData: FormData): Promise<HookResult> {
  const admin = await requireAdmin();
  const ep = await ownEndpoint(admin, String(formData.get("id") || ""));
  if (!ep) return { error: "Endpoint not found." };
  await prisma.webhookEndpoint.delete({ where: { id: ep.id } });
  await logAudit({ entityType: "WEBHOOK_ENDPOINT", entityId: ep.id, action: "DELETE", before: { url: ep.url, events: ep.events }, userId: admin.id, userName: admin.name, branchId: ep.branchId });
  revalidatePath("/settings/developers");
  return { error: null };
}

/** A new signing secret; the old one stops working immediately. Shown once. */
export async function rotateWebhookSecretAction(formData: FormData): Promise<HookState> {
  const admin = await requireAdmin();
  const ep = await ownEndpoint(admin, String(formData.get("id") || ""));
  if (!ep) return { error: "Endpoint not found." };
  const secret = newSigningSecret();
  await prisma.webhookEndpoint.update({ where: { id: ep.id }, data: { secretEnc: encryptSecret(secret), secretHint: secret.slice(-4) } });
  await logAudit({ entityType: "WEBHOOK_ENDPOINT", entityId: ep.id, action: "UPDATE", before: { secret: "(previous)" }, after: { secret: "(rotated)" }, userId: admin.id, userName: admin.name, branchId: ep.branchId });
  revalidatePath("/settings/developers");
  return { error: null, secret, url: ep.url };
}

export async function testWebhookAction(formData: FormData): Promise<HookResult> {
  const admin = await requireAdmin();
  const ep = await ownEndpoint(admin, String(formData.get("id") || ""));
  if (!ep) return { error: "Endpoint not found." };
  const r = await sendTestEvent(ep.id, ep.branchId);
  revalidatePath("/settings/developers");
  return r.status === "SUCCESS"
    ? { error: null, message: `Your server replied ${r.code}. The test event arrived.` }
    : { error: r.error ?? "The test event could not be delivered." };
}

export async function resendWebhookDeliveryAction(formData: FormData): Promise<HookResult> {
  const admin = await requireAdmin();
  const branchId = await branchFor(admin);
  if (!branchId) return { error: "Pick a branch first." };
  const r = await resendDelivery(String(formData.get("id") || ""), branchId);
  revalidatePath("/settings/developers");
  if (!r) return { error: "Delivery not found." };
  return r.status === "SUCCESS" ? { error: null, message: `Delivered (${r.code}).` } : { error: r.error ?? "Could not deliver." };
}
