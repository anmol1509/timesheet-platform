"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { requireAdmin } from "@/lib/auth";

export async function updateIssuedToAction(formData: FormData) {
  await requireAdmin();
  const issuedTo = String(formData.get("issuedTo") || "").trim();
  if (!issuedTo) return;
  await prisma.settings.upsert({
    where: { id: "singleton" },
    update: { issuedTo },
    create: { id: "singleton", issuedTo },
  });
  revalidatePath("/settings");
}

export async function createUserAction(
  _prevState: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  await requireAdmin();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const name = String(formData.get("name") || "").trim();
  const password = String(formData.get("password") || "");
  const role = String(formData.get("role") || "STAFF") === "ADMIN" ? "ADMIN" : "STAFF";

  if (!email || !name || password.length < 8) {
    return { error: "Fill in name, email, and a password of at least 8 characters." };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "A user with that email already exists." };
  }

  await prisma.user.create({
    data: { email, name, passwordHash: hashPassword(password), role },
  });
  revalidatePath("/settings");
  return { error: null };
}

export async function deleteUserAction(formData: FormData) {
  const admin = await requireAdmin();
  const userId = String(formData.get("userId") || "");
  if (!userId || userId === admin.id) return;
  try {
    await prisma.user.delete({ where: { id: userId } });
  } catch {
    // User has uploads or generated sheets on record; keep them for history.
  }
  revalidatePath("/settings");
}
