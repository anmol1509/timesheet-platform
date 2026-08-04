"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { requireAdmin } from "@/lib/auth";

const ROLES = ["SUPER_ADMIN", "BRANCH_ADMIN", "STAFF"] as const;
type RoleValue = (typeof ROLES)[number];

export async function updateIssuedToAction(formData: FormData) {
  await requireAdmin();
  const issuedTo = String(formData.get("issuedTo") || "").trim();
  const companyTrn = String(formData.get("companyTrn") || "").trim() || null;
  if (!issuedTo) return;
  await prisma.settings.upsert({
    where: { id: "singleton" },
    update: { issuedTo, companyTrn },
    create: { id: "singleton", issuedTo, companyTrn },
  });
  revalidatePath("/settings");
}

export async function createUserAction(
  _prevState: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const admin = await requireAdmin();
  const isSuperAdmin = admin.role === "SUPER_ADMIN";

  const email = String(formData.get("email") || "").trim().toLowerCase();
  const name = String(formData.get("name") || "").trim();
  const password = String(formData.get("password") || "");
  const requestedRole = String(formData.get("role") || "STAFF");
  const role: RoleValue = ROLES.includes(requestedRole as RoleValue)
    ? (requestedRole as RoleValue)
    : "STAFF";

  if (!email || !name || password.length < 8) {
    return { error: "Fill in name, email, and a password of at least 8 characters." };
  }

  // A BRANCH_ADMIN can only manage their own branch and can't grant
  // cross-branch access.
  if (!isSuperAdmin && role === "SUPER_ADMIN") {
    return { error: "Only a super admin can grant super admin access." };
  }

  let branchId: string | null;
  if (role === "SUPER_ADMIN") {
    branchId = null;
  } else if (isSuperAdmin) {
    branchId = String(formData.get("branchId") || "") || null;
    if (!branchId) return { error: "Choose a branch for this user." };
  } else {
    branchId = admin.branchId;
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "A user with that email already exists." };
  }

  await prisma.user.create({
    data: { email, name, passwordHash: hashPassword(password), role, branchId },
  });
  revalidatePath("/settings");
  return { error: null };
}

export async function deleteUserAction(formData: FormData) {
  const admin = await requireAdmin();
  const userId = String(formData.get("userId") || "");
  if (!userId || userId === admin.id) return;
  if (admin.role !== "SUPER_ADMIN") {
    const target = await prisma.user.findUnique({ where: { id: userId } });
    if (!target || target.branchId !== admin.branchId) return;
  }
  try {
    await prisma.user.delete({ where: { id: userId } });
  } catch {
    // User has uploads or generated sheets on record; keep them for history.
  }
  revalidatePath("/settings");
}

export async function createBranchAction(
  _prevState: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const admin = await requireAdmin();
  if (admin.role !== "SUPER_ADMIN") return { error: "Only a super admin can add branches." };

  const code = String(formData.get("code") || "").trim().toUpperCase();
  const name = String(formData.get("name") || "").trim();
  const emirate = String(formData.get("emirate") || "").trim() || null;

  if (!code || !name) {
    return { error: "Enter a branch code and name." };
  }

  const existing = await prisma.branch.findUnique({ where: { code } });
  if (existing) {
    return { error: "A branch with that code already exists." };
  }

  await prisma.branch.create({ data: { code, name, emirate } });
  revalidatePath("/settings");
  return { error: null };
}
