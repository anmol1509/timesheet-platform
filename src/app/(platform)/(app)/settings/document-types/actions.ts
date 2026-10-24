"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin, resolveSuperAdminBranchId } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { BUILT_IN_DOC_TYPES, DOC_TARGETS, docTypeKey, parseReminderDays } from "@/lib/documentTypes";

async function branchOf() {
  const admin = await requireAdmin();
  const branchId = admin.role === "SUPER_ADMIN" ? await resolveSuperAdminBranchId() : admin.branchId;
  return { admin, branchId };
}

const TARGETS = new Set<string>(DOC_TARGETS);
const REQUIRED = new Set(["NO", "YES", "OWN_COMPANY"]);

/** Creates a custom type, or saves the branch's changes to a built-in one (the row is created on first edit). */
export async function saveDocumentTypeAction(formData: FormData): Promise<{ error?: string }> {
  const { admin, branchId } = await branchOf();
  if (!branchId) return { error: "Pick a branch from the switcher first." };
  const appliesTo = String(formData.get("appliesTo") || "");
  const label = String(formData.get("label") || "").trim();
  const hasExpiry = formData.get("hasExpiry") === "on";
  const required = String(formData.get("required") || "NO");
  const isActive = formData.get("isActive") !== "off";
  if (!TARGETS.has(appliesTo)) return { error: "Choose what the document is for." };
  if (!label) return { error: "Enter a name." };
  if (!REQUIRED.has(required)) return { error: "Choose whether it is required." };
  if (appliesTo !== "SUPPLIER" && required === "OWN_COMPANY") return { error: "Only company documents can be required for own companies." };

  const existingKey = String(formData.get("key") || "");
  const key = existingKey || docTypeKey(label);
  if (!key) return { error: "Use letters or numbers in the name." };
  const builtIn = BUILT_IN_DOC_TYPES.some((d) => d.appliesTo === appliesTo && d.key === key);
  if (!existingKey && builtIn) return { error: "A built-in document type already has that name — edit it in the list." };
  const reminderDays = hasExpiry ? parseReminderDays(String(formData.get("reminderDays") || "")) : [];

  const where = { branchId_appliesTo_key: { branchId, appliesTo, key } };
  const before = await prisma.documentType.findUnique({ where });
  if (!existingKey && before) return { error: "You already have a document type with that name." };
  const data = { label, hasExpiry, required, reminderDays, isActive };
  const row = await prisma.documentType.upsert({ where, update: data, create: { ...data, branchId, appliesTo, key } });
  await logAudit({ entityType: "DOCUMENT_TYPE", entityId: row.id, action: before ? "UPDATE" : "CREATE", before: before ? { label: before.label, hasExpiry: before.hasExpiry, required: before.required, isActive: before.isActive } : null, after: { appliesTo, key, ...data }, userId: admin.id, userName: admin.name, branchId });
  revalidatePath("/settings/document-types");
  return {};
}

/** Deletes a custom type, or resets a built-in one to its defaults. Files already filed under the key stay. */
export async function resetDocumentTypeAction(formData: FormData): Promise<void> {
  const { admin, branchId } = await branchOf();
  if (!branchId) return;
  const appliesTo = String(formData.get("appliesTo") || "");
  const key = String(formData.get("key") || "");
  const row = await prisma.documentType.findUnique({ where: { branchId_appliesTo_key: { branchId, appliesTo, key } } });
  if (!row) return;
  const inUse = await prisma.attachment.count({ where: { docType: key, branchId, entityType: appliesTo } });
  const builtIn = BUILT_IN_DOC_TYPES.some((d) => d.appliesTo === appliesTo && d.key === key);
  // A custom type that still has files is switched off instead, so those files keep a label.
  if (!builtIn && inUse > 0) await prisma.documentType.update({ where: { id: row.id }, data: { isActive: false } });
  else await prisma.documentType.delete({ where: { id: row.id } });
  await logAudit({ entityType: "DOCUMENT_TYPE", entityId: row.id, action: "DELETE", before: { appliesTo, key, label: row.label }, userId: admin.id, userName: admin.name, branchId });
  revalidatePath("/settings/document-types");
}
