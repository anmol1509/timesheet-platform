import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const SESSION_COOKIE = "session";
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 30; // 30 days

function getSecretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export type SessionPayload = {
  userId: string;
  // Only meaningful for SUPER_ADMIN — the branch they're currently viewing.
  // Undefined/null means "all branches". Branch-scoped users ignore this and
  // always resolve to their own User.branchId (see requireUserWithBranch).
  activeBranchId?: string | null;
  // Preserved across re-issues (e.g. switching branch) so a "remember me"
  // login doesn't silently become a session-only cookie later.
  remember?: boolean;
};

export async function createSessionToken(payload: SessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(getSecretKey());
}

export async function verifySessionToken(
  token: string
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (typeof payload.userId !== "string") return null;
    return {
      userId: payload.userId,
      activeBranchId:
        typeof payload.activeBranchId === "string" ? payload.activeBranchId : null,
      remember: payload.remember === true,
    };
  } catch {
    return null;
  }
}

async function writeSessionCookie(payload: SessionPayload, remember: boolean) {
  const token = await createSessionToken(payload);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    ...(remember ? { maxAge: SESSION_DURATION_SECONDS } : {}),
  });
}

export async function setSessionCookie(userId: string, remember: boolean = true) {
  await writeSessionCookie({ userId, remember }, remember);
}

// Re-issues the session cookie with a different active branch, preserving
// the signed-in user and the original "remember me" choice.
export async function setActiveBranchCookie(activeBranchId: string | null) {
  const current = await getSessionFromCookies();
  if (!current) return;
  await writeSessionCookie(
    { userId: current.userId, activeBranchId, remember: current.remember },
    current.remember ?? true
  );
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function getSessionFromCookies(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export { SESSION_COOKIE };
