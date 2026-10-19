"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { setSessionCookie } from "@/lib/session";
import { startSession } from "@/lib/userSessions";
import { parsePreferences } from "@/lib/preferences";
import { canOpenPage, writePreferenceCookies } from "@/lib/preferenceCookies";

const MAX_FAILURES = 5;
const LOCK_WINDOW_MS = 15 * 60 * 1000;

export async function loginAction(
  _prevState: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const email = String(formData.get("email") || "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") || "");
  const remember = formData.get("remember") === "on";

  if (!email || !password) {
    return { error: "Enter your email and password." };
  }

  // Brute-force guard: failed attempts are logged per email in OtpChallenge
  // (kind STAFF_LOGIN) so the count is shared across serverless instances.
  const key = `email:${email}`.slice(0, 200);
  const failures = await prisma.otpChallenge.count({
    where: { kind: "STAFF_LOGIN", phone: key, createdAt: { gt: new Date(Date.now() - LOCK_WINDOW_MS) } },
  });
  if (failures >= MAX_FAILURES) {
    return { error: "Too many failed attempts. Try again in 15 minutes." };
  }

  const user = await prisma.user.findUnique({ where: { email }, include: { accessRole: { select: { permissions: true } } } });
  if (!user || !verifyPassword(password, user.passwordHash)) {
    await prisma.otpChallenge.create({
      data: { kind: "STAFF_LOGIN", phone: key, codeHash: "-", expiresAt: new Date(Date.now() + LOCK_WINDOW_MS) },
    });
    return { error: "Invalid email or password." };
  }
  await prisma.otpChallenge.deleteMany({ where: { kind: "STAFF_LOGIN", phone: key } });
  if (!user.isActive) {
    return { error: "This account has been suspended. Contact your administrator." };
  }

  const sid = await startSession(user.id);
  await setSessionCookie(user.id, remember, sid);
  // Their own look follows them to this device, and they land where they chose to start.
  const prefs = parsePreferences(user.preferences);
  if (user.preferences) await writePreferenceCookies(prefs);
  const subject = { role: user.role, permissions: user.accessRole?.permissions ?? null };
  redirect(prefs.startPage !== "/" && canOpenPage(subject, prefs.startPage) ? prefs.startPage : "/");
}
