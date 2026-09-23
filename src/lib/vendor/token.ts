import { SignJWT, jwtVerify } from "jose";

/** Supplier-portal token — its own cookie and claim type, like the employee one. */
export const VENDOR_COOKIE = "vendor_session";
export const VENDOR_DURATION_SECONDS = 60 * 60 * 24 * 7;

function key() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export async function createVendorToken(supplierId: string) {
  return new SignJWT({ supplierId, kind: "vendor" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${VENDOR_DURATION_SECONDS}s`)
    .sign(key());
}

export async function verifyVendorToken(token: string): Promise<{ supplierId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, key());
    if (payload.kind !== "vendor" || typeof payload.supplierId !== "string") return null;
    return { supplierId: payload.supplierId };
  } catch {
    return null;
  }
}
