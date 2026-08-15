/**
 * Per-user request budget for the endpoints that cost money.
 *
 * Document extraction bills a model call per upload, so an authenticated user
 * looping 8MB PDFs runs up a real invoice. This caps that.
 *
 * The counters live in module memory, which means a serverless deployment
 * enforces the limit per warm instance rather than globally — a determined
 * caller spread across cold starts gets more than the nominal budget. That's
 * accepted deliberately: it removes the runaway case without adding a Redis
 * dependency. Move this to a shared store if abuse ever becomes targeted.
 */
type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  /** Seconds until the window resets, for a Retry-After header. */
  retryAfter: number;
};

export function rateLimit(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number }
): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfter: 0 };
  }

  existing.count += 1;
  const retryAfter = Math.ceil((existing.resetAt - now) / 1000);

  // Opportunistic cleanup: without it the map grows one entry per user for the
  // lifetime of the instance.
  if (buckets.size > 500) {
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
  }

  return {
    allowed: existing.count <= limit,
    remaining: Math.max(0, limit - existing.count),
    retryAfter,
  };
}

/** Document extraction: enough for a busy onboarding session, not a loop. */
export const EXTRACTION_LIMIT = { limit: 60, windowMs: 60 * 60 * 1000 };
