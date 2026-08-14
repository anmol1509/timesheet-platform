"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { setSessionCookie } from "@/lib/session";
import { passwordlessLoginEnabled } from "@/lib/devLogin";

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

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return { error: "Invalid email or password." };
  }

  await setSessionCookie(user.id, remember);
  redirect("/");
}

/**
 * Password-free sign-in while the UI is under construction. Re-checks
 * `passwordlessLoginEnabled()` here rather than trusting the caller — this is
 * a server action, so it is reachable by anyone who can POST to it, whether or
 * not the button is rendered.
 */
export async function devLoginAction(): Promise<{ error: string | null }> {
  if (!passwordlessLoginEnabled()) {
    return { error: "One-click sign-in is disabled in this environment." };
  }

  const configured = process.env.DEV_LOGIN_EMAIL?.trim().toLowerCase();
  const user = configured
    ? await prisma.user.findUnique({ where: { email: configured } })
    : await prisma.user.findFirst({
        where: { role: "SUPER_ADMIN" },
        orderBy: { createdAt: "asc" },
      });

  if (!user) {
    return {
      error: configured
        ? `No user found for DEV_LOGIN_EMAIL (${configured}).`
        : "No SUPER_ADMIN user exists to sign in as.",
    };
  }

  await setSessionCookie(user.id, true);
  redirect("/");
}
