"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUserWithBranch, requirePermission } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { logAudit } from "@/lib/audit";
import { assertContactsValid } from "@/lib/validators";

function stringOrNull(value: FormDataEntryValue | null) {
  const s = String(value || "").trim();
  return s || null;
}

async function assertItemInBranch(itemId: string, branchId: string | null, isSuperAdmin: boolean) {
  const item = await prisma.inventoryItem.findUnique({ where: { id: itemId }, select: { branchId: true } });
  return !!item && !isOutsideBranch(item.branchId, branchId, isSuperAdmin);
}

export async function createInventoryItemAction(
  _prevState: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  assertContactsValid(formData);
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

  // A quantity entered up front becomes the item's first (default) variant, so the
  // stock shows on the list straight away; sizes and colours can be split out later.
  const quantity = Math.max(0, Math.trunc(Number(formData.get("quantity")) || 0));
  const item = await prisma.inventoryItem.create({
    data: { ...data, ...(quantity > 0 ? { variants: { create: { name: "Standard", stock: quantity } } } : {}) },
  });

  await logAudit({
    entityType: "INVENTORY_ITEM",
    entityId: item.id,
    action: "CREATE",
    after: { ...data, quantity },
    userId: user.id,
    userName: user.name,
    branchId,
  });

  revalidatePath("/inventory");
  redirect(`/inventory/${item.id}`);
}

export async function updateInventoryItemAction(formData: FormData) {
  assertContactsValid(formData);
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
  assertContactsValid(formData);
  await requirePermission("facilities", "delete");
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

export async function createVariantAction(
  formData: FormData
): Promise<{ error?: string } | void> {
  assertContactsValid(formData);
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const itemId = String(formData.get("itemId") || "");
  const name = String(formData.get("name") || "").trim();
  const sku = stringOrNull(formData.get("sku"));
  const stock = Math.max(0, Number(formData.get("stock")) || 0);
  if (!itemId || !name) return { error: "Variant name is required." };
  if (!(await assertItemInBranch(itemId, branchId, isSuperAdmin))) return;

  const existing = await prisma.inventoryVariant.findUnique({
    where: { itemId_name: { itemId, name } },
  });
  if (existing) return { error: `A variant named "${name}" already exists for this item.` };

  const variant = await prisma.inventoryVariant.create({ data: { itemId, name, sku, stock } });

  await logAudit({
    entityType: "INVENTORY_VARIANT",
    entityId: variant.id,
    action: "CREATE",
    after: { itemId, name, sku, stock },
    userId: user.id,
    userName: user.name,
    branchId,
  });

  revalidatePath(`/inventory/${itemId}`);
}

export async function updateVariantStockAction(formData: FormData) {
  assertContactsValid(formData);
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const variantId = String(formData.get("variantId") || "");
  const stock = Math.max(0, Number(formData.get("stock")) || 0);
  if (!variantId) return;

  const existing = await prisma.inventoryVariant.findUnique({ where: { id: variantId } });
  if (!existing || !(await assertItemInBranch(existing.itemId, branchId, isSuperAdmin))) return;

  await prisma.inventoryVariant.update({ where: { id: variantId }, data: { stock } });

  await logAudit({
    entityType: "INVENTORY_VARIANT",
    entityId: variantId,
    action: "UPDATE",
    before: { stock: existing.stock },
    after: { stock },
    userId: user.id,
    userName: user.name,
    branchId,
  });

  revalidatePath(`/inventory/${existing.itemId}`);
}

export async function deleteVariantAction(formData: FormData) {
  assertContactsValid(formData);
  await requirePermission("facilities", "delete");
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const variantId = String(formData.get("variantId") || "");
  if (!variantId) return;

  const existing = await prisma.inventoryVariant.findUnique({ where: { id: variantId } });
  if (!existing || !(await assertItemInBranch(existing.itemId, branchId, isSuperAdmin))) return;

  const heldCount = await prisma.employeeInventoryAssignment.count({
    where: { variantId, returnDate: null },
  });
  if (heldCount > 0) {
    redirect(
      `/inventory/${existing.itemId}?error=${encodeURIComponent(
        `Can't delete "${existing.name}" — ${heldCount} employee(s) still hold it. Return it first.`
      )}`
    );
  }

  await prisma.inventoryVariant.delete({ where: { id: variantId } });

  await logAudit({
    entityType: "INVENTORY_VARIANT",
    entityId: variantId,
    action: "DELETE",
    before: { itemId: existing.itemId, name: existing.name, sku: existing.sku, stock: existing.stock },
    userId: user.id,
    userName: user.name,
    branchId,
  });

  revalidatePath(`/inventory/${existing.itemId}`);
}

