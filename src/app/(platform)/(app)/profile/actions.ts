"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { requireAdmin, requireUser } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";
import { logAudit } from "@/lib/audit";
import { deleteImage, storeImage } from "@/lib/storedImage";
import { assertContactsValid, contactsError } from "@/lib/validators";
import { parsePreferences, type Preferences } from "@/lib/preferences";
import { canOpenPage, writePreferenceCookies } from "@/lib/preferenceCookies";
import { getSessionFromCookies, reissueSessionCookie } from "@/lib/session";
import { subjectOf } from "@/lib/auth";
import { notifyUsers } from "@/lib/notifications/notify";

type State = { error: string | null; ok?: boolean };

export async function updateProfileAction(_prev: State, formData: FormData): Promise<State> {
  { const invalid = contactsError(formData); if (invalid) return { error: invalid }; }
  const user = await requireUser();
  const name = String(formData.get("name") || "").trim();
  const phone = String(formData.get("phone") || "").trim() || null;
  const jobTitle = String(formData.get("jobTitle") || "").trim() || null;
  if (!name) return { error: "Name can't be empty." };

  await prisma.user.update({ where: { id: user.id }, data: { name, phone, jobTitle } });
  await logAudit({
    entityType: "USER",
    entityId: user.id,
    action: "UPDATE",
    before: { name: user.name, phone: user.phone, jobTitle: user.jobTitle },
    after: { name, phone, jobTitle },
    userId: user.id,
    userName: name,
    branchId: user.branchId,
  });
  revalidatePath("/", "layout");
  return { error: null, ok: true };
}

export async function uploadAvatarAction(formData: FormData) {
  assertContactsValid(formData);
  const user = await requireUser();
  const saved = await storeImage(formData.get("image"));
  if ("error" in saved) return { error: saved.error };
  await prisma.user.update({ where: { id: user.id }, data: { avatarId: saved.id } });
  await deleteImage(user.avatarId);
  revalidatePath("/", "layout");
  return { error: null };
}

export async function removeAvatarAction() {
  const user = await requireUser();
  await prisma.user.update({ where: { id: user.id }, data: { avatarId: null } });
  await deleteImage(user.avatarId);
  revalidatePath("/", "layout");
  return { error: null };
}

export async function changePasswordAction(_prev: State, formData: FormData): Promise<State> {
  { const invalid = contactsError(formData); if (invalid) return { error: invalid }; }
  const user = await requireUser();
  const current = String(formData.get("current") || "");
  const next = String(formData.get("next") || "");
  const confirm = String(formData.get("confirm") || "");

  if (!verifyPassword(current, user.passwordHash)) return { error: "Current password is incorrect." };
  if (next.length < 8) return { error: "New password must be at least 8 characters." };
  if (next !== confirm) return { error: "New passwords don't match." };
  if (next === current) return { error: "Choose a password different from the current one." };

  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: hashPassword(next) } });
  // A new password signs everything else out: whoever had the old one loses access.
  await endOtherSessions(user.id, (await getSessionFromCookies())?.sid);
  await notifyUsers({ userIds: [user.id], kind: "SECURITY_PASSWORD_CHANGED", title: "Your password was changed", body: "If you did this, there is nothing to do.\n\nIf you did not, tell your administrator straight away and reset your password.", href: "/profile?tab=security" });
  // Never log the password itself — just that it changed.
  await logAudit({
    entityType: "USER",
    entityId: user.id,
    action: "UPDATE",
    before: { password: "(previous)" },
    after: { password: "(changed by user)" },
    userId: user.id,
    userName: user.name,
    branchId: user.branchId,
  });
  return { error: null, ok: true };
}

/** Saves the person's appearance and start page on their account and in the cookies. */
export async function savePreferencesAction(input: Partial<Preferences>): Promise<State> {
  const user = await requireUser();
  const next = parsePreferences({ ...parsePreferences(user.preferences), ...input });
  if (next.startPage !== "/" && !canOpenPage(subjectOf(user), next.startPage)) return { error: "You don't have access to that page, so it can't be your start page." };
  await prisma.user.update({ where: { id: user.id }, data: { preferences: next } });
  await writePreferenceCookies(next);
  revalidatePath("/", "layout");
  return { error: null, ok: true };
}

/** An administrator sets (or, with null, clears) the look new accounts in their company start with. People who already chose their own look keep it. */
export async function saveCompanyLookAction(input: Partial<Preferences> | null): Promise<State> {
  const user = await requireAdmin();
  if (!user.branchId) return { error: "Open a company first; the default belongs to one company." };
  const { startPage: _start, ...look } = parsePreferences(input);
  await prisma.branch.update({ where: { id: user.branchId }, data: { appearanceDefaults: input ? look : Prisma.DbNull } });
  revalidatePath("/profile");
  return { error: null, ok: true };
}

/** The quick light / dark / match-my-device switch in the account menu. */
export async function setThemeAction(theme: Preferences["theme"]): Promise<State> {
  // Not requireUser: that applies the module rules of whichever page the menu is on, and a view-only person on, say, the
  // timesheets page would be sent to "no access" for flipping the theme. Anyone signed in may change their own look.
  const user = await getCurrentUser();
  if (!user) return { error: "Not signed in." };
  const next = parsePreferences({ ...parsePreferences(user.preferences), theme });
  await prisma.user.update({ where: { id: user.id }, data: { preferences: next } });
  return { error: null, ok: true };
}

/** Ends every other sign-in of this person, keeping the one in use. */
async function endOtherSessions(userId: string, keepSid: string | undefined) {
  const now = new Date();
  await prisma.userSession.updateMany({ where: { userId, revokedAt: null, ...(keepSid ? { NOT: { id: keepSid } } : {}) }, data: { revokedAt: now } });
  await prisma.user.update({ where: { id: userId }, data: { sessionsValidAfter: now } });
  await reissueSessionCookie();
}

export async function signOutOtherDevicesAction(): Promise<State> {
  const user = await requireUser();
  const session = await getSessionFromCookies();
  await endOtherSessions(user.id, session?.sid);
  await logAudit({ entityType: "USER", entityId: user.id, action: "UPDATE", after: { signedOutOtherDevices: true }, userId: user.id, userName: user.name, branchId: user.branchId });
  revalidatePath("/profile");
  return { error: null, ok: true };
}

export async function endSessionAction(id: string): Promise<State> {
  const user = await requireUser();
  const session = await getSessionFromCookies();
  if (session?.sid === id) return { error: "That is the device you are using now." };
  const row = await prisma.userSession.findUnique({ where: { id }, select: { userId: true } });
  if (!row || row.userId !== user.id) return { error: "Device not found." };
  await prisma.userSession.update({ where: { id }, data: { revokedAt: new Date() } });
  revalidatePath("/profile");
  return { error: null, ok: true };
}
