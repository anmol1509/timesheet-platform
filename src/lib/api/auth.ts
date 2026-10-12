import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rateLimit";
import { apiError } from "./respond";
import { hashApiKey, looksLikeApiKey } from "./keys";

export type ApiContext = { keyId: string; branchId: string; scopes: string[]; requestId: string; rateHeaders: Record<string, string> };

const KEY_LIMIT = { limit: 120, windowMs: 60 * 1000 };
const BAD_KEY_LIMIT = { limit: 30, windowMs: 60 * 1000 };
const TOUCH_AFTER_MS = 5 * 60 * 1000;

/**
 * Turns "Authorization: Bearer <key>" into the branch the key belongs to.
 * Every refusal is the same shape, and a bad key never says whether it was
 * unknown, revoked or expired.
 */
export async function authenticateApiRequest(request: Request, requestId: string): Promise<{ ok: true; ctx: ApiContext } | { ok: false; response: Response }> {
  const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  const header = request.headers.get("authorization") ?? "";
  const secret = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";

  const refuse = () => {
    const budget = rateLimit(`apibad:${ip}`, BAD_KEY_LIMIT);
    if (!budget.allowed) return apiError(429, "rate_limited", "Too many requests with an invalid key. Try again shortly.", requestId, { "Retry-After": String(budget.retryAfter) });
    return apiError(401, "invalid_api_key", "Missing or invalid API key. Send it as 'Authorization: Bearer <key>'.", requestId, { "WWW-Authenticate": "Bearer" });
  };

  if (!secret || !looksLikeApiKey(secret)) return { ok: false, response: refuse() };

  const key = await prisma.apiKey.findUnique({
    where: { keyHash: hashApiKey(secret) },
    select: { id: true, scopes: true, branchId: true, expiresAt: true, revokedAt: true, lastUsedAt: true, branch: { select: { isActive: true, apiAccess: true } } },
  });
  if (!key || key.revokedAt || (key.expiresAt && key.expiresAt <= new Date())) return { ok: false, response: refuse() };
  if (!key.branch.isActive || !key.branch.apiAccess) {
    return { ok: false, response: apiError(403, "api_access_disabled", "API access is part of the Pro and Custom plans and is not enabled for this account.", requestId) };
  }

  const budget = rateLimit(`api:${key.id}`, KEY_LIMIT);
  const rateHeaders = { "X-RateLimit-Limit": String(KEY_LIMIT.limit), "X-RateLimit-Remaining": String(budget.remaining) };
  if (!budget.allowed) {
    return { ok: false, response: apiError(429, "rate_limited", `Rate limit of ${KEY_LIMIT.limit} requests a minute reached.`, requestId, { ...rateHeaders, "Retry-After": String(budget.retryAfter) }) };
  }

  // Recorded at most every few minutes, so a busy integration doesn't write on every call.
  if (!key.lastUsedAt || Date.now() - key.lastUsedAt.getTime() > TOUCH_AFTER_MS) {
    await prisma.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
  }

  return { ok: true, ctx: { keyId: key.id, branchId: key.branchId, scopes: key.scopes, requestId, rateHeaders } };
}

export const hasScope = (ctx: ApiContext, scope: string) => ctx.scopes.includes(scope);
