"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { assertContactsValid } from "@/lib/validators";

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
