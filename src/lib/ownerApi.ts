import { createHmac, timingSafeEqual } from "crypto";

/**
 * How the owner's dashboard talks to a customer that has its own deployment. Every request carries a timestamp and a signature
 * made with a secret that belongs to that one customer, so a request for one customer can't be replayed against another, and an
 * old request stops working after a few minutes. Pure: no environment or database, so it can be tested.
 */

/** The secret one customer's deployment holds, worked out from the owner's master secret and the customer's code. */
export function customerSecret(masterSecret: string, code: string): string {
  return createHmac("sha256", masterSecret).update(`customer:${code.toUpperCase()}`).digest("hex");
}

export function signRequest(secret: string, timestamp: number, method: string, path: string, body: string): string {
  return createHmac("sha256", secret).update(`${timestamp}\n${method.toUpperCase()}\n${path}\n${body}`).digest("hex");
}

export const OWNER_API_WINDOW_MS = 5 * 60 * 1000;

export function verifyRequest(secret: string, input: { timestamp: string | null; signature: string | null; method: string; path: string; body: string; now?: number }): boolean {
  const ts = Number(input.timestamp);
  const now = input.now ?? Date.now();
  if (!Number.isFinite(ts) || !input.signature || Math.abs(now - ts) > OWNER_API_WINDOW_MS) return false;
  const expected = Buffer.from(signRequest(secret, ts, input.method, input.path, input.body), "hex");
  let given: Buffer;
  try { given = Buffer.from(input.signature, "hex"); } catch { return false; }
  return given.length === expected.length && timingSafeEqual(given, expected);
}
