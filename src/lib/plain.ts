import { Prisma } from "@/generated/prisma/client";

/**
 * Database rows go to client components through React's serializer, which refuses class instances: a Prisma
 * Decimal (money, rates, multipliers) is one, and raw file bytes are not worth shipping to the browser at all.
 * Decimals become numbers, bytes are dropped, and dates and plain data pass through unchanged.
 */
export function toPlain<T>(value: T): T {
  return walk(value) as T;
}

function walk(v: unknown): unknown {
  if (v === null || v === undefined) return v;
  if (v instanceof Prisma.Decimal) return v.toNumber();
  if (v instanceof Date) return v;
  if (v instanceof Uint8Array) return null;
  if (Array.isArray(v)) return v.map(walk);
  if (typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) out[k] = walk(x);
    return out;
  }
  return v;
}
