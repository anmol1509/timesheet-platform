import { after } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { notifyUsers } from "@/lib/notifications/notify";
import { decryptSecret, signPayload } from "./crypto";
import { postJson } from "./http";
import { resolveSafeTarget } from "./safeUrl";
import { TEST_EVENT } from "./events";

/** Delays before the 2nd, 3rd... attempt. After the 6th failure the delivery is given up on. */
export const BACKOFF_MS = [5_000, 60_000, 10 * 60_000, 60 * 60_000, 6 * 60 * 60_000];
export const MAX_ATTEMPTS = BACKOFF_MS.length + 1;
const SWITCH_OFF_AFTER = 10; // deliveries given up on, in a row
const LEASE_MS = 2 * 60_000;
const KEEP_DAYS = 30;

export const newEventId = () => "evt_" + randomBytes(10).toString("hex");

export function buildPayload(eventId: string, type: string, branchId: string, data: Record<string, unknown>) {
  return JSON.stringify({ id: eventId, type, created: new Date().toISOString(), branch_id: branchId, data });
}

/** Runs after the response when there is a request to hang it on; otherwise (scripts, tests) it just runs. */
async function runLater(fn: () => Promise<unknown>) {
  try {
    after(async () => {
      await fn().catch((e) => console.error("[webhooks]", e instanceof Error ? e.message : e));
    });
  } catch {
    await fn().catch((e) => console.error("[webhooks]", e instanceof Error ? e.message : e));
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Whether anyone is listening for this event, so callers can skip building a payload nobody will get. */
export async function hasSubscribers(branchId: string, type: string) {
  return (
    (await prisma.webhookEndpoint.count({ where: { branchId, isActive: true, events: { has: type }, branch: { apiAccess: true, isActive: true } } })) > 0
  );
}

/** Queues an event for every endpoint of the branch that subscribed to it, then sends it. Never throws. */
export async function emitWebhookEvent(branchId: string, type: string, data: Record<string, unknown>) {
  try {
    const endpoints = await prisma.webhookEndpoint.findMany({
      where: { branchId, isActive: true, events: { has: type }, branch: { apiAccess: true, isActive: true } },
      select: { id: true },
    });
    if (endpoints.length === 0) return [];
    const eventId = newEventId();
    const payload = buildPayload(eventId, type, branchId, data);
    const rows = await Promise.all(
      endpoints.map((e) => prisma.webhookDelivery.create({ data: { endpointId: e.id, branchId, eventId, type, payload, nextAttemptAt: new Date() }, select: { id: true } }))
    );
    const ids = rows.map((r) => r.id);
    await runLater(async () => {
      await Promise.all(ids.map(sendWithQuickRetry));
      await processDue({ branchId, limit: 10 });
    });
    return ids;
  } catch (e) {
    console.error("[webhooks] emit failed:", e instanceof Error ? e.message : e);
    return [];
  }
}

export type AttemptResult = { status: "SUCCESS" | "PENDING" | "FAILED" | "SKIPPED"; code: number | null; error: string | null };

async function sendWithQuickRetry(deliveryId: string) {
  const first = await attempt(deliveryId);
  if (first.status === "PENDING") {
    await sleep(BACKOFF_MS[0] + 100);
    await attempt(deliveryId);
  }
}

/** One try at one delivery. Safe to call twice at once: only one caller gets to send. */
export async function attempt(deliveryId: string): Promise<AttemptResult> {
  const now = new Date();
  const claimed = await prisma.webhookDelivery.updateMany({
    where: { id: deliveryId, status: "PENDING", OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }] },
    data: { nextAttemptAt: new Date(now.getTime() + LEASE_MS) },
  });
  if (claimed.count === 0) return { status: "SKIPPED", code: null, error: null };

  const d = await prisma.webhookDelivery.findUnique({ where: { id: deliveryId }, include: { endpoint: true } });
  if (!d) return { status: "SKIPPED", code: null, error: null };
  const isTest = d.type === TEST_EVENT;

  const finish = async (data: { status: "SUCCESS" | "PENDING" | "FAILED"; code: number | null; error: string | null; snippet?: string | null; durationMs?: number | null }) => {
    const attempts = d.attempts + 1;
    const next = data.status === "PENDING" ? new Date(Date.now() + BACKOFF_MS[Math.min(attempts - 1, BACKOFF_MS.length - 1)]) : null;
    await prisma.webhookDelivery.update({
      where: { id: d.id },
      data: {
        status: data.status, attempts, nextAttemptAt: next, lastStatusCode: data.code, lastError: data.error, responseSnippet: data.snippet ?? null, durationMs: data.durationMs ?? null,
        deliveredAt: data.status === "SUCCESS" ? new Date() : null,
      },
    });
    if (data.status === "SUCCESS") {
      await prisma.webhookEndpoint.update({ where: { id: d.endpointId }, data: { consecutiveFailures: 0, lastDeliveryAt: new Date(), lastStatusCode: data.code } });
    } else if (data.status === "FAILED" && !isTest) {
      await markFailure(d.endpointId, d.endpoint.url, d.branchId, data.code);
    } else if (data.status !== "PENDING") {
      await prisma.webhookEndpoint.update({ where: { id: d.endpointId }, data: { lastDeliveryAt: new Date(), lastStatusCode: data.code } });
    }
    return { status: data.status, code: data.code, error: data.error } as AttemptResult;
  };

  if (!d.endpoint.isActive) return finish({ status: "FAILED", code: null, error: "This endpoint is switched off." });

  let target;
  try {
    target = await resolveSafeTarget(d.endpoint.url);
  } catch (e) {
    return finish({ status: isTest || d.attempts + 1 >= MAX_ATTEMPTS ? "FAILED" : "PENDING", code: null, error: e instanceof Error ? e.message : "Address check failed" });
  }

  const secret = decryptSecret(d.endpoint.secretEnc);
  const res = await postJson(
    target,
    {
      "Content-Type": "application/json",
      "User-Agent": "ManpowerSync-Webhooks/1.0",
      "ManpowerSync-Event": d.type,
      "ManpowerSync-Delivery": d.id,
      "ManpowerSync-Signature": signPayload(secret, d.payload),
    },
    d.payload
  );
  const ok = res.status !== null && res.status >= 200 && res.status < 300;
  if (ok) return finish({ status: "SUCCESS", code: res.status, error: null, snippet: res.snippet, durationMs: res.durationMs });
  const error = res.error ?? `Your server replied ${res.status}${res.status && res.status >= 300 && res.status < 400 ? " (redirects are not followed)" : ""}`;
  const final = isTest || d.attempts + 1 >= MAX_ATTEMPTS;
  return finish({ status: final ? "FAILED" : "PENDING", code: res.status, error, snippet: res.snippet, durationMs: res.durationMs });
}

async function markFailure(endpointId: string, url: string, branchId: string, code: number | null) {
  const ep = await prisma.webhookEndpoint.update({ where: { id: endpointId }, data: { consecutiveFailures: { increment: 1 }, lastDeliveryAt: new Date(), lastStatusCode: code } });
  if (ep.isActive && ep.consecutiveFailures >= SWITCH_OFF_AFTER) {
    await prisma.webhookEndpoint.update({ where: { id: endpointId }, data: { isActive: false, disabledReason: `Switched off automatically after ${SWITCH_OFF_AFTER} failed deliveries in a row.` } });
    const admins = await prisma.user.findMany({ where: { isActive: true, OR: [{ role: "SUPER_ADMIN" }, { role: "BRANCH_ADMIN", branchId }] }, select: { id: true } });
    await notifyUsers({
      userIds: admins.map((a) => a.id),
      kind: "WEBHOOK_DISABLED",
      title: "A webhook was switched off",
      body: `${url} failed ${SWITCH_OFF_AFTER} deliveries in a row, so we stopped sending to it. Fix it, then switch it back on.`,
      href: "/settings/developers",
    });
  }
}

/** Sends deliveries whose retry time has come. Called when events are emitted, when the Developers page opens, and by the daily sweep. */
export async function processDue({ branchId, limit = 20 }: { branchId?: string; limit?: number } = {}) {
  const due = await prisma.webhookDelivery.findMany({
    where: { status: "PENDING", nextAttemptAt: { lte: new Date() }, ...(branchId ? { branchId } : {}) },
    orderBy: { nextAttemptAt: "asc" },
    take: limit,
    select: { id: true },
  });
  let sent = 0;
  for (const d of due) {
    const r = await attempt(d.id);
    if (r.status !== "SKIPPED") sent++;
  }
  return sent;
}

/** Deletes delivery records older than the retention period. */
export async function purgeOldDeliveries() {
  const r = await prisma.webhookDelivery.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - KEEP_DAYS * 86_400_000) } } });
  return r.count;
}

/** Sends a one-off test event to a single endpoint and reports what happened. */
export async function sendTestEvent(endpointId: string, branchId: string) {
  const eventId = newEventId();
  const payload = buildPayload(eventId, TEST_EVENT, branchId, { message: "This is a test event from ManpowerSync. Your endpoint is working if you can read this." });
  const row = await prisma.webhookDelivery.create({ data: { endpointId, branchId, eventId, type: TEST_EVENT, payload, nextAttemptAt: new Date() }, select: { id: true } });
  return attempt(row.id);
}

/** Sends a past delivery's exact payload again as a new delivery. */
export async function resendDelivery(deliveryId: string, branchId: string) {
  const old = await prisma.webhookDelivery.findFirst({ where: { id: deliveryId, branchId } });
  if (!old) return null;
  const row = await prisma.webhookDelivery.create({
    data: { endpointId: old.endpointId, branchId, eventId: old.eventId, type: old.type, payload: old.payload, nextAttemptAt: new Date() },
    select: { id: true },
  });
  return attempt(row.id);
}
