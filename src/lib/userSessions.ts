import { cache } from "react";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import type { VerifiedSession } from "@/lib/session";

/** "Chrome on Windows", "Safari on iPhone": enough for a person to recognise their own devices. */
export function describeDevice(userAgent: string | null | undefined): string {
  const ua = userAgent ?? "";
  if (!ua) return "Unknown device";
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\/|Opera/.test(ua) ? "Opera" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\/|CriOS\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac OS X|Macintosh/.test(ua) ? "Mac" : /CrOS/.test(ua) ? "Chromebook" : /Linux/.test(ua) ? "Linux" : "";
  return os ? `${browser} on ${os}` : browser;
}

/** Records a new sign-in and returns its id, which goes into the session cookie. */
export async function startSession(userId: string): Promise<string> {
  const h = await headers();
  const userAgent = (h.get("user-agent") ?? "").slice(0, 300) || null;
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim().slice(0, 64) || null;
  const row = await prisma.userSession.create({ data: { userId, userAgent, ip, label: describeDevice(userAgent) }, select: { id: true } });
  // Old rows (ended, or older than a session can live) are of no use to anyone; tidy them as people sign in.
  await prisma.userSession.deleteMany({ where: { userId, createdAt: { lt: new Date(Date.now() - SESSION_ROW_KEEP_MS) } } }).catch(() => {});
  return row.id;
}

/** A session cookie lasts 30 days, so a row older than that can no longer be in use. */
export const SESSION_ROW_KEEP_MS = 31 * 24 * 60 * 60 * 1000;

/** Sign-ins older than this can no longer be in use. */
export const sessionCutoff = () => new Date(Date.now() - SESSION_ROW_KEEP_MS);

/** Ends one sign-in on the server, so a copied cookie stops working too. */
export async function endSession(sid: string | undefined) {
  if (!sid) return;
  await prisma.userSession.updateMany({ where: { id: sid, revokedAt: null }, data: { revokedAt: new Date() } }).catch(() => {});
}

/**
 * Ends every sign-in of a person, optionally keeping one (the device in use). Used when a password changes by any route
 * (their own change, a reset by email, an admin setting it), so whoever held the old password or a copied cookie is out.
 */
export async function endSessionsFor(userId: string, keepSid?: string) {
  const now = new Date();
  await prisma.userSession.updateMany({ where: { userId, revokedAt: null, ...(keepSid ? { NOT: { id: keepSid } } : {}) }, data: { revokedAt: now } });
  await prisma.user.update({ where: { id: userId }, data: { sessionsValidAfter: now } });
}

const TOUCH_EVERY_MS = 10 * 60 * 1000;

/**
 * Whether a verified session may still be used: not older than the person's "sign out of other devices", and, when it
 * is tracked, not ended. Marks the session as seen now and then, so the list shows when each device was last used.
 */
export async function sessionStillValid(session: VerifiedSession, validAfter: Date | null): Promise<boolean> {
  // A page asks who the user is several times (layout, page, actions); the answer is the same within one request.
  return checkOnce(session.userId, session.sid ?? "", session.iat ?? 0, validAfter ? validAfter.getTime() : 0);
}

const checkOnce = cache(async (userId: string, sid: string, iat: number, validAfterMs: number): Promise<boolean> => {
  const session = { userId, sid: sid || undefined, iat: iat || undefined };
  const validAfter = validAfterMs ? new Date(validAfterMs) : null;
  if (validAfter && session.iat !== undefined && session.iat < Math.floor(validAfter.getTime() / 1000)) return false;
  if (!session.sid) return true;
  const row = await prisma.userSession.findUnique({ where: { id: session.sid }, select: { revokedAt: true, lastSeenAt: true, userId: true } });
  if (!row || row.revokedAt || row.userId !== session.userId) return false;
  if (Date.now() - row.lastSeenAt.getTime() > TOUCH_EVERY_MS) {
    await prisma.userSession.update({ where: { id: session.sid }, data: { lastSeenAt: new Date() } }).catch(() => {});
  }
  return true;
});
