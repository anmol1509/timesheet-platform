import { SignJWT, jwtVerify } from "jose";

/**
 * Employee self-service token — jose only, so the proxy can import it without
 * pulling in the database. A separate cookie and token type from the staff
 * session on purpose: staff tokens carry `userId`, these carry `employeeId` +
 * kind "ess", and neither verifier accepts the other's.
 */
export const ESS_COOKIE = "ess_session";
export const ESS_DURATION_SECONDS = 60 * 60 * 24 * 7;

function key() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export async function createEssToken(employeeId: string) {
  return new SignJWT({ employeeId, kind: "ess" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ESS_DURATION_SECONDS}s`)
    .sign(key());
}

export async function verifyEssToken(token: string): Promise<{ employeeId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, key());
    if (payload.kind !== "ess" || typeof payload.employeeId !== "string") return null;
    return { employeeId: payload.employeeId };
  } catch {
    return null;
  }
}
