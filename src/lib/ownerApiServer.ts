import { NextResponse } from "next/server";
import { verifyRequest } from "@/lib/ownerApi";

/**
 * Checks that a request to /api/owner/* really comes from the owner's dashboard. Each deployment holds one secret
 * (OWNER_API_SECRET) that only the owner's dashboard can work out; without it the routes simply don't exist. Returns the raw
 * body to read, or the response to send back.
 */
export async function authenticateOwnerRequest(request: Request, path: string): Promise<{ body: string } | NextResponse> {
  const secret = process.env.OWNER_API_SECRET;
  if (!secret) return new NextResponse("Not found", { status: 404 });
  const body = await request.text();
  const ok = verifyRequest(secret, { timestamp: request.headers.get("x-owner-timestamp"), signature: request.headers.get("x-owner-signature"), method: request.method, path, body });
  if (!ok) return NextResponse.json({ error: "Not allowed." }, { status: 401 });
  return { body };
}

export function parseJson<T>(body: string): T | null {
  try { return JSON.parse(body || "{}") as T; } catch { return null; }
}
