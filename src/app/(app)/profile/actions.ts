"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";
import { logAudit } from "@/lib/audit";
import { deleteImage, storeImage } from "@/lib/storedImage";

type State = { error: string | null; ok?: boolean };

export async function updateProfileAction(_prev: State, formData: FormData): Promise<State> {
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
  const user = await requireUser();
  const current = String(formData.get("current") || "");
  const next = String(formData.get("next") || "");
  const confirm = String(formData.get("confirm") || "");

  if (!verifyPassword(current, user.passwordHash)) return { error: "Current password is incorrect." };
  if (next.length < 8) return { error: "New password must be at least 8 characters." };
  if (next !== confirm) return { error: "New passwords don't match." };
  if (next === current) return { error: "Choose a password different from the current one." };

  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: hashPassword(next) } });
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
