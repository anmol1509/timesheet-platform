"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUserWithBranch, requirePermission, requireWrite } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { logAudit } from "@/lib/audit";
import { assertContactsValid } from "@/lib/validators";
import { blank, cellOf, rowError } from "@/lib/bulkImport";
import type { ImportRowResult } from "@/components/import/report";

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
  await requireWrite("facilities.inventory");
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

  const existing = await prisma.inventoryItem.findFirst({ where: { name, branchId }, select: { id: true } });
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

export async function updateInventoryItemAction(formData: FormData): Promise<{ error: string | null }> {
  await requireWrite("facilities.inventory");
  assertContactsValid(formData);
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const id = String(formData.get("itemId") || "");
  if (!id) return { error: null };
  if (!(await assertItemInBranch(id, branchId, isSuperAdmin))) return { error: null };

  const before = await prisma.inventoryItem.findUnique({ where: { id } });

  // The name can be corrected here; two items in one company can't share a name.
  const name = String(formData.get("name") ?? "").trim() || before?.name || "";
  if (before && name !== before.name) {
    const taken = await prisma.inventoryItem.findFirst({ where: { branchId: before.branchId, name: { equals: name, mode: "insensitive" }, NOT: { id } }, select: { id: true } });
    if (taken) return { error: `Another item is already called "${name}".` };
  }

  const data = {
    name,
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
  return { error: null };
}

export async function deleteInventoryItemAction(formData: FormData) {
  await requireWrite("facilities.inventory");
  assertContactsValid(formData);
  await requirePermission("facilities.inventory", "delete");
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
  await requireWrite("facilities.inventory");
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
  await requireWrite("facilities.inventory");
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
  await requireWrite("facilities.inventory");
  assertContactsValid(formData);
  await requirePermission("facilities.inventory", "delete");
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


/**
 * Bulk add/update stock. One row per item variant (size, colour…); an item with
 * no variant column gets a single "Standard" variant. Items and variants are
 * matched by name, ignoring case, and stock is only changed when the cell is filled.
 */
export async function bulkImportInventoryAction(rows: Record<string, string>[]): Promise<ImportRowResult[]> {
  await requireWrite("facilities.inventory");
  await requirePermission("facilities.inventory", "create");
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  if (!branchId) {
    const message = isSuperAdmin ? "Pick a branch from the switcher before importing." : "Your account has no branch assigned — contact an admin.";
    return rows.map((_, i) => rowError(i, undefined, message));
  }
  const items = await prisma.inventoryItem.findMany({ where: { branchId }, include: { variants: true } });
  const byKey = new Map(items.map((it) => [it.name.trim().toLowerCase(), it]));
  const results: ImportRowResult[] = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const itemName = cellOf(r, "Item").replace(/\s+/g, " ");
    if (!itemName) { results.push(rowError(i, undefined, "Item name is required.")); continue; }
    const variantName = cellOf(r, "Variant") || "Standard";
    const stockText = cellOf(r, "Stock");
    const stock = stockText === "" ? null : Number(stockText.replace(/,/g, ""));
    if (stock !== null && (!Number.isFinite(stock) || stock < 0)) { results.push(rowError(i, itemName, `Stock "${stockText}" isn't a whole number of units.`)); continue; }
    try {
      let item = byKey.get(itemName.toLowerCase());
      let created = false;
      const category = blank(cellOf(r, "Category"));
      const notes = blank(cellOf(r, "Notes"));
      if (!item) {
        const made = await prisma.inventoryItem.create({ data: { name: itemName, branchId, category, notes }, include: { variants: true } });
        await logAudit({ entityType: "INVENTORY_ITEM", entityId: made.id, action: "CREATE", after: { name: itemName, category, notes }, userId: user.id, userName: user.name, branchId });
        item = made;
        byKey.set(itemName.toLowerCase(), made);
        created = true;
      } else if (category || notes) {
        const changes = { ...(category ? { category } : {}), ...(notes ? { notes } : {}) };
        await prisma.inventoryItem.update({ where: { id: item.id }, data: changes });
        await logAudit({ entityType: "INVENTORY_ITEM", entityId: item.id, action: "UPDATE", before: { category: item.category, notes: item.notes }, after: changes, userId: user.id, userName: user.name, branchId });
        Object.assign(item, changes);
      }
      const sku = blank(cellOf(r, "SKU"));
      const variant = item.variants.find((v) => v.name.trim().toLowerCase() === variantName.toLowerCase());
      if (variant) {
        const changes = { ...(stock !== null ? { stock: Math.trunc(stock) } : {}), ...(sku ? { sku } : {}) };
        if (Object.keys(changes).length > 0) await prisma.inventoryVariant.update({ where: { id: variant.id }, data: changes });
        Object.assign(variant, changes);
        results.push({ row: i + 2, name: `${itemName} · ${variant.name}`, status: created ? "created" : "updated" });
      } else {
        const v = await prisma.inventoryVariant.create({ data: { itemId: item.id, name: variantName, sku, stock: stock === null ? 0 : Math.trunc(stock) } });
        item.variants.push(v);
        results.push({ row: i + 2, name: `${itemName} · ${v.name}`, status: created ? "created" : "updated" });
      }
    } catch (e) {
      results.push(rowError(i, itemName, e instanceof Error ? e.message : "Failed to import row."));
    }
  }
  revalidatePath("/inventory");
  return results;
}

/** One line of a bulk issue: who gets how many of which variant. */
export type IssueLine = { employeeId: string; variantId: string | null; quantity: number };

/**
 * Hands one item to several workers in one go. All or nothing: if the stock on any variant can't cover everything
 * asked of it, nothing is issued and the message says which one is short.
 */
export async function issueInventoryBulkAction(input: { itemId: string; issuedDate: string; lines: IssueLine[] }): Promise<{ issued: number; error?: string }> {
  await requireWrite("facilities.inventory");
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const { itemId } = input;
  if (!(await assertItemInBranch(itemId, branchId, isSuperAdmin))) return { issued: 0, error: "That item isn't part of this branch's inventory." };
  const lines = input.lines.filter((l) => l.employeeId && Number.isFinite(l.quantity) && l.quantity >= 1).map((l) => ({ ...l, quantity: Math.trunc(l.quantity) }));
  if (lines.length === 0) return { issued: 0, error: "Add at least one worker." };
  if (lines.length > 200) return { issued: 0, error: "Issue to up to 200 workers at a time." };
  const issuedDate = /^\d{4}-\d{2}-\d{2}$/.test(input.issuedDate) ? new Date(input.issuedDate) : new Date();

  const item = await prisma.inventoryItem.findUnique({ where: { id: itemId }, select: { name: true, variants: { select: { id: true, name: true, stock: true } } } });
  if (!item) return { issued: 0, error: "That item no longer exists." };
  if (item.variants.length === 0) return { issued: 0, error: "This item has no stock recorded. Add stock first." };
  if (item.variants.length > 0 && lines.some((l) => !l.variantId)) return { issued: 0, error: "Choose a size or variant for every worker." };

  const employees = await prisma.employee.findMany({ where: { id: { in: [...new Set(lines.map((l) => l.employeeId))] } }, select: { id: true, branchId: true } });
  const okEmployee = new Set(employees.filter((e) => !isOutsideBranch(e.branchId, branchId, isSuperAdmin)).map((e) => e.id));
  if (lines.some((l) => !okEmployee.has(l.employeeId))) return { issued: 0, error: "One of those workers isn't in this branch." };

  const created: { id: string; employeeId: string; variantId: string | null; quantity: number }[] = [];
  try {
    await prisma.$transaction(async (tx) => {
      const wantedBy = new Map<string, number>();
      for (const l of lines) wantedBy.set(l.variantId!, (wantedBy.get(l.variantId!) ?? 0) + l.quantity);
      for (const [variantId, wanted] of wantedBy) {
        const variant = item.variants.find((v) => v.id === variantId);
        if (!variant) throw new Error("A chosen variant no longer exists.");
        const held = await tx.employeeInventoryAssignment.aggregate({ where: { variantId, returnDate: null }, _sum: { quantity: true } });
        const available = variant.stock - (held._sum.quantity ?? 0);
        if (wanted > available) throw new Error(`Only ${available} of "${variant.name}" left, and ${wanted} were asked for.`);
      }
      for (const l of lines) {
        const row = await tx.employeeInventoryAssignment.create({ data: { employeeId: l.employeeId, itemId, variantId: l.variantId, quantity: l.quantity, issuedDate } });
        created.push({ id: row.id, employeeId: l.employeeId, variantId: l.variantId, quantity: l.quantity });
      }
    });
  } catch (e) {
    return { issued: 0, error: e instanceof Error ? e.message : "Couldn't issue those." };
  }
  for (const c of created) {
    await logAudit({ entityType: "EMPLOYEE_INVENTORY_ASSIGNMENT", entityId: c.id, action: "CREATE", after: { employeeId: c.employeeId, itemId, itemName: item.name, variantId: c.variantId, quantity: c.quantity, issuedDate }, userId: user.id, userName: user.name, branchId });
  }
  for (const id of okEmployee) revalidatePath(`/employees/${id}`);
  revalidatePath(`/inventory/${itemId}`);
  revalidatePath("/inventory");
  return { issued: created.length };
}

/** Marks the chosen issued items as returned today (the ones in this branch that are still out). */
export async function returnInventoryBulkAction(assignmentIds: string[]): Promise<{ returned: number; error?: string }> {
  await requireWrite("facilities.inventory");
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const wanted = [...new Set(assignmentIds.filter(Boolean))].slice(0, 500);
  if (wanted.length === 0) return { returned: 0, error: "Choose at least one." };
  const rows = await prisma.employeeInventoryAssignment.findMany({
    where: { id: { in: wanted }, returnDate: null },
    select: { id: true, itemId: true, employeeId: true, employee: { select: { branchId: true } } },
  });
  const mine = rows.filter((r) => !isOutsideBranch(r.employee.branchId, branchId, isSuperAdmin));
  if (mine.length === 0) return { returned: 0, error: "Nothing to return." };
  const returnDate = new Date();
  await prisma.employeeInventoryAssignment.updateMany({ where: { id: { in: mine.map((r) => r.id) } }, data: { returnDate } });
  for (const r of mine) {
    await logAudit({ entityType: "EMPLOYEE_INVENTORY_ASSIGNMENT", entityId: r.id, action: "UPDATE", before: { returnDate: null }, after: { returnDate }, userId: user.id, userName: user.name, branchId });
    revalidatePath(`/employees/${r.employeeId}`);
  }
  revalidatePath("/inventory");
  for (const itemId of new Set(mine.map((r) => r.itemId))) revalidatePath(`/inventory/${itemId}`);
  return { returned: mine.length };
}
