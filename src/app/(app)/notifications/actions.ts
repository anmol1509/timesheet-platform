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
  const notifyWhatsapp = formData.get("notifyWhatsapp") === "on";
  const raw = String(formData.get("whatsappNumber") || "").replace(/[\s()-]/g, "");
  const whatsappNumber = raw || null;
  if (whatsappNumber && !/^\+\d{8,15}$/.test(whatsappNumber)) {
    return { error: "Enter the WhatsApp number in international format, e.g. +971501234567." };
  }
  if (notifyWhatsapp && !whatsappNumber) return { error: "Add a WhatsApp number to turn WhatsApp alerts on." };
  await prisma.user.update({ where: { id: user.id }, data: { notifyEmail, notifyWhatsapp, whatsappNumber } });
  revalidatePath("/profile");
  return { error: null, ok: true };
}
