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
  return row.id;
}

const TOUCH_EVERY_MS = 10 * 60 * 1000;

/**
 * Whether a verified session may still be used: not older than the person's "sign out of other devices", and, when it
 * is tracked, not ended. Marks the session as seen now and then, so the list shows when each device was last used.
 */
export async function sessionStillValid(session: VerifiedSession, validAfter: Date | null): Promise<boolean> {
  if (validAfter && session.iat !== undefined && session.iat < Math.floor(validAfter.getTime() / 1000)) return false;
  if (!session.sid) return true;
  const row = await prisma.userSession.findUnique({ where: { id: session.sid }, select: { revokedAt: true, lastSeenAt: true, userId: true } });
  if (!row || row.revokedAt || row.userId !== session.userId) return false;
  if (Date.now() - row.lastSeenAt.getTime() > TOUCH_EVERY_MS) {
    await prisma.userSession.update({ where: { id: session.sid }, data: { lastSeenAt: new Date() } }).catch(() => {});
  }
  return true;
}
