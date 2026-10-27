"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { assertContactsValid } from "@/lib/validators";
import { parseEmailPrefs } from "@/lib/emailPrefs";
import { sendEmail } from "@/lib/notifications/email";
import { appBaseUrl, brandForBranch } from "@/lib/email/brand";
import { testMail } from "@/lib/email/templates";

// Deliberately getCurrentUser (not requireUser): these are fired from the bell
// in the shared header on every page, so the per-module write gate — which keys
// off the page the action was invoked from — must not apply to them. Each only
// ever touches the caller's own rows.
export async function markNotificationReadAction(formData: FormData) {
  assertContactsValid(formData);
  const user = await getCurrentUser();
  if (!user) return;
  const id = String(formData.get("id") || "");
  await prisma.notification.updateMany({ where: { id, userId: user.id, readAt: null }, data: { readAt: new Date() } });
  revalidatePath("/", "layout");
}

export async function markAllNotificationsReadAction() {
  const user = await getCurrentUser();
  if (!user) return;
  await prisma.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
  revalidatePath("/", "layout");
}

export async function saveNotificationPrefsAction(
  _prev: { error: string | null; ok?: boolean },
  formData: FormData
): Promise<{ error: string | null; ok?: boolean }> {
  assertContactsValid(formData);
  const user = await getCurrentUser();
  if (!user) return { error: "Not signed in." };
  const notifyEmail = formData.get("notifyEmail") === "on";
  await prisma.user.update({ where: { id: user.id }, data: { notifyEmail } });
  revalidatePath("/profile");
  return { error: null, ok: true };
}

/** Saves the whole email settings page. What is stored is cleaned by parseEmailPrefs; notifyEmail is kept in step with the master switch. */
export async function saveEmailPrefsAction(input: unknown): Promise<{ error: string | null; ok?: boolean; prefs?: ReturnType<typeof parseEmailPrefs> }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not signed in." };
  const prefs = parseEmailPrefs(input, user.notifyEmail);
  await prisma.user.update({ where: { id: user.id }, data: { emailPrefs: prefs, notifyEmail: prefs.enabled } });
  revalidatePath("/profile");
  return { error: null, ok: true, prefs };
}

/** Sends one test email to the person, so they can see that email reaches them. Sent even if their emails are off or paused. */
export async function sendTestEmailAction(): Promise<{ error: string | null; ok?: boolean }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not signed in." };
  const brand = await brandForBranch(user.branchId);
  const mail = testMail({ name: user.name, appUrl: appBaseUrl(), brand });
  const res = await sendEmail(user.email, mail.subject, mail.text, { html: mail.html });
  if (res.sent) return { error: null, ok: true };
  return { error: res.reason === "not_configured" ? "Email isn't set up on this system yet, so nothing could be sent." : "The email couldn't be sent. Try again in a minute." };
}
