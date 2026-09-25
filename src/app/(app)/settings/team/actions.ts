"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { sanitizePermissions } from "@/lib/permissions";
import { assertContactsValid } from "@/lib/validators";

type State = { error: string | null; ok?: boolean };
const ROLES = ["SUPER_ADMIN", "BRANCH_ADMIN", "STAFF"] as const;
type RoleValue = (typeof ROLES)[number];

/** The target user, if this admin is allowed to manage them. A branch admin
 * manages only their own branch's users and never a super admin. */
async function manageable(userId: string) {
  const admin = await requireAdmin();
  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) return { admin, target: null };
  if (admin.role !== "SUPER_ADMIN" && (target.branchId !== admin.branchId || target.role === "SUPER_ADMIN")) {
    return { admin, target: null };
  }
  return { admin, target };
}

/** An access role may be attached only if it's global or belongs to the user's branch. */
async function validAccessRoleId(raw: string, branchId: string | null) {
  if (!raw) return { id: null as string | null, error: null as string | null };
  const role = await prisma.accessRole.findUnique({ where: { id: raw } });
  if (!role || (role.branchId !== null && role.branchId !== branchId)) {
    return { id: null, error: "That permission set isn't available for this user's branch." };
  }
  return { id: role.id, error: null };
}

function parseRole(raw: string, admin: { role: string }): RoleValue | null {
  if (!ROLES.includes(raw as RoleValue)) return null;
  if (raw === "SUPER_ADMIN" && admin.role !== "SUPER_ADMIN") return null;
  return raw as RoleValue;
}

export async function createUserAction(_prev: State, formData: FormData): Promise<State> {
  assertContactsValid(formData);
  const admin = await requireAdmin();
  const isSuperAdmin = admin.role === "SUPER_ADMIN";
  const v = (k: string) => String(formData.get(k) || "").trim();

  const email = v("email").toLowerCase();
  const name = v("name");
  const password = String(formData.get("password") || "");
  const role = parseRole(v("role") || "STAFF", admin);
  if (!role) return { error: "You can't grant that role." };
  if (!email || !name || password.length < 8) {
    return { error: "Fill in name, email, and a temporary password of at least 8 characters." };
  }
  if (v("phone").replace(/\D/g, "").length < 7) return { error: "Add a phone number for this person." };

  let branchId: string | null;
  if (role === "SUPER_ADMIN") branchId = null;
  else if (isSuperAdmin) {
    branchId = v("branchId") || null;
    if (!branchId) return { error: "Choose a branch for this user." };
  } else branchId = admin.branchId;

  if (await prisma.user.findUnique({ where: { email } })) return { error: "A user with that email already exists." };

  // Access for a STAFF member: an existing role, a role defined right here in
  // the same step (saved so it can be reused), or no restriction.
  const accessMode = v("accessMode");
  let accessRoleId: string | null = null;
  let newRole: { name: string; permissions: string[] } | null = null;
  if (role === "STAFF") {
    if (accessMode === "new") {
      const roleName = v("newRoleName");
      const permissions = sanitizePermissions(formData.getAll("permission").map(String));
      if (!roleName) return { error: "Name the role so it can be reused for the next person." };
      if (permissions.length === 0) return { error: "Tick at least one permission for this role." };
      for (const p of permissions) {
        const [mod] = p.split(":");
        if (!permissions.includes(`${mod}:view`)) return { error: `Grant View on ${mod} too — its other actions can't work without it.` };
      }
      newRole = { name: roleName, permissions };
    } else {
      const ar = await validAccessRoleId(accessMode === "existing" ? v("accessRoleId") : "", branchId);
      if (ar.error) return { error: ar.error };
      accessRoleId = ar.id;
    }
  }

  let created;
  try {
    created = await prisma.$transaction(async (tx) => {
      if (newRole) {
        const r = await tx.accessRole.create({ data: { name: newRole.name, permissions: newRole.permissions, branchId } });
        accessRoleId = r.id;
      }
      return tx.user.create({
        data: {
          email,
          name,
          passwordHash: hashPassword(password),
          role,
          branchId,
          accessRoleId,
          phone: v("phone") || null,
          jobTitle: v("jobTitle") || null,
        },
      });
    });
  } catch {
    return { error: "A role with that name already exists for this branch — pick it from the list instead, or use another name." };
  }
  if (newRole) {
    await logAudit({
      entityType: "ACCESS_ROLE",
      entityId: accessRoleId ?? "",
      action: "CREATE",
      after: { name: newRole.name, permissions: newRole.permissions, branchId },
      userId: admin.id,
      userName: admin.name,
      branchId,
    });
  }
  await logAudit({
    entityType: "USER",
    entityId: created.id,
    action: "CREATE",
    after: { email, name, role, branchId, accessRoleId },
    userId: admin.id,
    userName: admin.name,
    branchId,
  });
  revalidatePath("/settings/team");
  return { error: null, ok: true };
}

export async function updateUserAction(_prev: State, formData: FormData): Promise<State> {
  assertContactsValid(formData);
  const v = (k: string) => String(formData.get(k) || "").trim();
  const { admin, target } = await manageable(v("userId"));
  if (!target) return { error: "You can't edit that user." };
  const isSelf = target.id === admin.id;

  const name = v("name");
  if (!name) return { error: "Name can't be empty." };

  let role: RoleValue = target.role;
  let branchId = target.branchId;
  if (!isSelf) {
    const requested = parseRole(v("role") || target.role, admin);
    if (!requested) return { error: "You can't grant that role." };
    role = requested;
    if (role === "SUPER_ADMIN") branchId = null;
    else if (admin.role === "SUPER_ADMIN") {
      branchId = v("branchId") || target.branchId;
      if (!branchId) return { error: "Choose a branch for this user." };
    }
    if (target.role === "SUPER_ADMIN" && role !== "SUPER_ADMIN") {
      const supers = await prisma.user.count({ where: { role: "SUPER_ADMIN", isActive: true } });
      if (supers <= 1) return { error: "This is the last super admin — promote another one first." };
    }
  }

  const ar = role === "STAFF" ? await validAccessRoleId(v("accessRoleId"), branchId) : { id: null, error: null };
  if (ar.error) return { error: ar.error };

  const data = {
    name,
    role,
    branchId,
    accessRoleId: ar.id,
    phone: v("phone") || null,
    jobTitle: v("jobTitle") || null,
  };
  await prisma.user.update({ where: { id: target.id }, data });
  await logAudit({
    entityType: "USER",
    entityId: target.id,
    action: "UPDATE",
    before: { name: target.name, role: target.role, branchId: target.branchId, accessRoleId: target.accessRoleId, phone: target.phone, jobTitle: target.jobTitle },
    after: data,
    userId: admin.id,
    userName: admin.name,
    branchId: target.branchId,
  });
  revalidatePath("/settings/team");
  return { error: null, ok: true };
}

export async function setUserActiveAction(formData: FormData): Promise<State> {
  assertContactsValid(formData);
  const { admin, target } = await manageable(String(formData.get("userId") || ""));
  if (!target || target.id === admin.id) return { error: "You can't change that user." };
  const isActive = formData.get("active") === "1";
  if (!isActive && target.role === "SUPER_ADMIN") {
    const supers = await prisma.user.count({ where: { role: "SUPER_ADMIN", isActive: true } });
    if (supers <= 1) return { error: "This is the last active super admin." };
  }
  await prisma.user.update({ where: { id: target.id }, data: { isActive } });
  await logAudit({
    entityType: "USER",
    entityId: target.id,
    action: "UPDATE",
    before: { isActive: target.isActive },
    after: { isActive },
    userId: admin.id,
    userName: admin.name,
    branchId: target.branchId,
  });
  revalidatePath("/settings/team");
  return { error: null, ok: true };
}

export async function resetUserPasswordAction(_prev: State, formData: FormData): Promise<State> {
  assertContactsValid(formData);
  const { admin, target } = await manageable(String(formData.get("userId") || ""));
  if (!target) return { error: "You can't edit that user." };
  const password = String(formData.get("password") || "");
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  await prisma.user.update({ where: { id: target.id }, data: { passwordHash: hashPassword(password) } });
  await logAudit({
    entityType: "USER",
    entityId: target.id,
    action: "UPDATE",
    before: { password: "(previous)" },
    after: { password: "(reset by admin)" },
    userId: admin.id,
    userName: admin.name,
    branchId: target.branchId,
  });
  return { error: null, ok: true };
}

export async function deleteUserAction(formData: FormData) {
  assertContactsValid(formData);
  const { admin, target } = await manageable(String(formData.get("userId") || ""));
  if (!target || target.id === admin.id) return;
  try {
    await prisma.user.delete({ where: { id: target.id } });
    await logAudit({
      entityType: "USER",
      entityId: target.id,
      action: "DELETE",
      before: { email: target.email, name: target.name, role: target.role, branchId: target.branchId },
      userId: admin.id,
      userName: admin.name,
      branchId: target.branchId,
    });
  } catch {
    // Has uploads / documents on record — suspend instead, to keep history.
  }
  revalidatePath("/settings/team");
}
