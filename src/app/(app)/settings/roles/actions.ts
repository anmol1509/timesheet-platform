"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { sanitizePermissions } from "@/lib/permissions";
import { assertContactsValid } from "@/lib/validators";

type State = { error: string | null; ok?: boolean };

async function editableRole(id: string) {
  const admin = await requireAdmin();
  const role = await prisma.accessRole.findUnique({ where: { id } });
  if (!role) return { admin, role: null };
  // Branch admins can edit only their own branch's roles, never a global one.
  if (admin.role !== "SUPER_ADMIN" && role.branchId !== admin.branchId) return { admin, role: null };
  return { admin, role };
}

export async function saveRoleAction(_prev: State, formData: FormData): Promise<State> {
  assertContactsValid(formData);
  const admin = await requireAdmin();
  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "").trim();
  const description = String(formData.get("description") || "").trim() || null;
  const permissions = sanitizePermissions(formData.getAll("permission").map(String));
  if (!name) return { error: "Give the role a name." };
  if (permissions.length === 0) return { error: "Tick at least one permission." };
  // An action without View on its module would be unreachable — reject it clearly.
  for (const p of permissions) {
    const [mod] = p.split(":");
    if (!permissions.includes(`${mod}:view`)) return { error: `Grant View on ${mod} too — its other actions can't work without it.` };
  }

  let branchId: string | null;
  if (admin.role === "SUPER_ADMIN") branchId = String(formData.get("branchId") || "") || null;
  else branchId = admin.branchId;

  try {
    if (id) {
      const { role } = await editableRole(id);
      if (!role) return { error: "You can't edit that role." };
      await prisma.accessRole.update({ where: { id }, data: { name, description, permissions } });
      await logAudit({
        entityType: "ACCESS_ROLE",
        entityId: id,
        action: "UPDATE",
        before: { name: role.name, description: role.description, permissions: role.permissions },
        after: { name, description, permissions },
        userId: admin.id,
        userName: admin.name,
        branchId: role.branchId,
      });
    } else {
      const created = await prisma.accessRole.create({ data: { name, description, permissions, branchId } });
      await logAudit({
        entityType: "ACCESS_ROLE",
        entityId: created.id,
        action: "CREATE",
        after: { name, description, permissions, branchId },
        userId: admin.id,
        userName: admin.name,
        branchId,
      });
    }
  } catch {
    return { error: "A role with that name already exists in this scope." };
  }
  revalidatePath("/settings/roles");
  revalidatePath("/settings/team");
  return { error: null, ok: true };
}

export async function deleteRoleAction(formData: FormData) {
  assertContactsValid(formData);
  const { admin, role } = await editableRole(String(formData.get("id") || ""));
  if (!role) return;
  // Users on this role fall back to legacy staff access (SetNull), so refuse
  // while anyone is still assigned rather than silently widening their access.
  const inUse = await prisma.user.count({ where: { accessRoleId: role.id } });
  if (inUse > 0) return;
  await prisma.accessRole.delete({ where: { id: role.id } });
  await logAudit({
    entityType: "ACCESS_ROLE",
    entityId: role.id,
    action: "DELETE",
    before: { name: role.name, permissions: role.permissions },
    userId: admin.id,
    userName: admin.name,
    branchId: role.branchId,
  });
  revalidatePath("/settings/roles");
}
