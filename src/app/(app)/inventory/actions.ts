"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { logAudit } from "@/lib/audit";

function stringOrNull(value: FormDataEntryValue | null) {
  const s = String(value || "").trim();
  return s || null;
}

async function assertItemInBranch(itemId: string, branchId: string | null, isSuperAdmin: boolean) {
  const item = await prisma.inventoryItem.findUnique({ where: { id: itemId }, select: { branchId: true } });
  return !!item && !isOutsideBranch(item.branchId, branchId, isSuperAdmin);
}

async function assertProjectInBranch(projectId: string, branchId: string | null, isSuperAdmin: boolean) {
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { branchId: true } });
  return !!project && !isOutsideBranch(project.branchId, branchId, isSuperAdmin);
}

export async function createInventoryItemAction(
  _prevState: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const name = String(formData.get("name") || "").trim();
  if (!name) return { error: "Item name is required." };
  if (!branchId) {
    return {
      error: isSuperAdmin
        ? "Pick a branch from the switcher before adding an item."
        : "Your account has no branch assigned — contact an admin.",
    };
  }

  const existing = await prisma.inventoryItem.findUnique({ where: { name } });
  if (existing) return { error: "An item with that name already exists." };

  const data = {
    name,
    branchId,
    category: stringOrNull(formData.get("category")),
    notes: stringOrNull(formData.get("notes")),
  };

  const item = await prisma.inventoryItem.create({ data });

  await logAudit({
    entityType: "INVENTORY_ITEM",
    entityId: item.id,
    action: "CREATE",
    after: data,
    userId: user.id,
    userName: user.name,
    branchId,
  });

  revalidatePath("/inventory");
  redirect(`/inventory/${item.id}`);
}

export async function updateInventoryItemAction(formData: FormData) {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const id = String(formData.get("itemId") || "");
  if (!id) return;
  if (!(await assertItemInBranch(id, branchId, isSuperAdmin))) return;

  const before = await prisma.inventoryItem.findUnique({ where: { id } });

  const data = {
    category: stringOrNull(formData.get("category")),
    notes: stringOrNull(formData.get("notes")),
  };

  await prisma.inventoryItem.update({ where: { id }, data });

  await logAudit({
    entityType: "INVENTORY_ITEM",
    entityId: id,
    action: "UPDATE",
    before: before as unknown as Record<string, unknown>,
    after: data,
    userId: user.id,
    userName: user.name,
    branchId,
  });

  revalidatePath(`/inventory/${id}`);
  revalidatePath("/inventory");
}

export async function deleteInventoryItemAction(formData: FormData) {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const id = String(formData.get("itemId") || "");
  if (!id) return;
  if (!(await assertItemInBranch(id, branchId, isSuperAdmin))) return;

  const activeCount = await prisma.projectInventoryAssignment.count({
    where: { itemId: id, returnDate: null },
  });
  if (activeCount > 0) {
    redirect(
      `/inventory/${id}?error=${encodeURIComponent(
        `Can't delete — still assigned to ${activeCount} project(s). Return it first.`
      )}`
    );
  }

  const existing = await prisma.inventoryItem.findUnique({ where: { id } });
  await prisma.inventoryItem.delete({ where: { id } });

  if (existing) {
    await logAudit({
      entityType: "INVENTORY_ITEM",
      entityId: id,
      action: "DELETE",
      before: existing as unknown as Record<string, unknown>,
      userId: user.id,
      userName: user.name,
      branchId,
    });
  }

  revalidatePath("/inventory");
  redirect("/inventory");
}

export async function assignInventoryItemAction(formData: FormData) {
  const { branchId, isSuperAdmin } = await requireUserWithBranch();
  const itemId = String(formData.get("itemId") || "");
  const projectId = String(formData.get("projectId") || "");
  const quantity = Math.max(1, Number(formData.get("quantity")) || 1);
  const condition = stringOrNull(formData.get("condition"));
  if (!itemId || !projectId) return;
  if (!(await assertItemInBranch(itemId, branchId, isSuperAdmin))) return;
  if (!(await assertProjectInBranch(projectId, branchId, isSuperAdmin))) return;

  await prisma.projectInventoryAssignment.create({
    data: { itemId, projectId, quantity, condition, assignedDate: new Date() },
  });

  revalidatePath(`/inventory/${itemId}`);
}

export async function returnInventoryAssignmentAction(formData: FormData) {
  const { branchId, isSuperAdmin } = await requireUserWithBranch();
  const itemId = String(formData.get("itemId") || "");
  const assignmentId = String(formData.get("assignmentId") || "");
  if (!assignmentId) return;
  if (!(await assertItemInBranch(itemId, branchId, isSuperAdmin))) return;

  await prisma.projectInventoryAssignment.update({
    where: { id: assignmentId },
    data: { returnDate: new Date() },
  });

  revalidatePath(`/inventory/${itemId}`);
}
