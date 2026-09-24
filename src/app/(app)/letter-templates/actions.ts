"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAdmin, requireUserWithBranch } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { logAudit } from "@/lib/audit";
import { LETTER_CATEGORIES, LETTER_PRESETS, presetByKey } from "@/lib/letterPresets";
import { LETTER_MERGE_FIELDS } from "@/lib/letterLayout";

type State = { error: string | null; ok?: boolean };
const MAX_BODY = 6000;
const str = (v: FormDataEntryValue | null) => String(v ?? "").trim();

async function ownTemplate(id: string) {
  await requireAdmin();
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const template = await prisma.letterTemplate.findUnique({ where: { id } });
  const ok = template && !isOutsideBranch(template.branchId, branchId, isSuperAdmin);
  return { user, branchId, template: ok ? template : null };
}

/** Starts a template from a built-in preset ("blank" for an empty one) and opens the editor. */
export async function createFromPresetAction(formData: FormData) {
  await requireAdmin();
  const { user, branchId } = await requireUserWithBranch();
  if (!branchId) redirect("/letter-templates?error=" + encodeURIComponent("Pick a branch first."));
  const key = str(formData.get("presetKey"));
  const preset = presetByKey(key);
  const created = await prisma.letterTemplate.create({
    data: preset
      ? { branchId, name: preset.name, category: preset.category, title: preset.title, presetKey: preset.key, remarksText: preset.body }
      : { branchId, name: "Untitled template", category: null, title: null, presetKey: null, remarksText: "Write your letter here. Use the field buttons to insert details like %%CLIENTNAME%% that are filled in automatically." },
  });
  await logAudit({ entityType: "LETTER_TEMPLATE", entityId: created.id, action: "CREATE", after: { name: created.name, presetKey: preset?.key ?? null }, userId: user.id, userName: user.name, branchId });
  revalidatePath("/letter-templates");
  redirect(`/letter-templates/${created.id}`);
}

/** Adds any built-in template this branch doesn't have yet. */
export async function addMissingDefaultsAction(): Promise<State> {
  await requireAdmin();
  const { user, branchId } = await requireUserWithBranch();
  if (!branchId) return { error: "Pick a branch first." };
  const have = await prisma.letterTemplate.findMany({ where: { branchId, presetKey: { not: null } }, select: { presetKey: true } });
  const haveKeys = new Set(have.map((h) => h.presetKey));
  const missing = LETTER_PRESETS.filter((p) => !haveKeys.has(p.key));
  if (missing.length === 0) return { error: null, ok: true };
  await prisma.letterTemplate.createMany({
    data: missing.map((p) => ({ branchId, name: p.name, category: p.category, title: p.title, presetKey: p.key, remarksText: p.body })),
  });
  await logAudit({ entityType: "LETTER_TEMPLATE", entityId: branchId, action: "CREATE", after: { addedDefaults: missing.map((m) => m.key) }, userId: user.id, userName: user.name, branchId });
  revalidatePath("/letter-templates");
  return { error: null, ok: true };
}

export async function saveTemplateAction(_prev: State, formData: FormData): Promise<State> {
  const id = str(formData.get("id"));
  const { user, template } = await ownTemplate(id);
  if (!template) return { error: "Template not found." };
  const name = str(formData.get("name"));
  const category = str(formData.get("category")) || null;
  const title = str(formData.get("title")) || null;
  const body = String(formData.get("body") ?? "").replace(/\r\n/g, "\n").trim();
  if (!name) return { error: "Give the template a name." };
  if (!body) return { error: "The letter body can't be empty." };
  if (body.length > MAX_BODY) return { error: `That's too long (max ${MAX_BODY} characters).` };
  if (category && !(LETTER_CATEGORIES as readonly string[]).includes(category)) return { error: "Choose one of the letter types." };

  // A misspelt field would print as blank in a real letter — refuse it here.
  const known = new Set(LETTER_MERGE_FIELDS.map((f) => f.key));
  const unknown = [...new Set([...body.matchAll(/%%(\w+)%%/g)].map((m) => m[1]).filter((k) => !known.has(k)))];
  if (unknown.length > 0) return { error: `Unknown field${unknown.length > 1 ? "s" : ""}: ${unknown.map((u) => `%%${u}%%`).join(", ")}. Insert fields with the buttons to avoid typos.` };

  await prisma.letterTemplate.update({ where: { id }, data: { name, category, title, remarksText: body } });
  await logAudit({ entityType: "LETTER_TEMPLATE", entityId: id, action: "UPDATE", before: { name: template.name, category: template.category, title: template.title, remarksText: template.remarksText }, after: { name, category, title, remarksText: body }, userId: user.id, userName: user.name, branchId: template.branchId });
  revalidatePath("/letter-templates");
  revalidatePath(`/letter-templates/${id}`);
  return { error: null, ok: true };
}

export async function duplicateTemplateAction(formData: FormData) {
  const { user, template } = await ownTemplate(str(formData.get("id")));
  if (!template) return;
  const created = await prisma.letterTemplate.create({
    data: { branchId: template.branchId, name: `${template.name} (copy)`, category: template.category, title: template.title, presetKey: null, remarksText: template.remarksText },
  });
  await logAudit({ entityType: "LETTER_TEMPLATE", entityId: created.id, action: "CREATE", after: { duplicatedFrom: template.id }, userId: user.id, userName: user.name, branchId: template.branchId });
  revalidatePath("/letter-templates");
  redirect(`/letter-templates/${created.id}`);
}

export async function resetToPresetAction(formData: FormData): Promise<State> {
  const { user, template } = await ownTemplate(str(formData.get("id")));
  const preset = presetByKey(template?.presetKey);
  if (!template || !preset) return { error: "There's no original to reset to." };
  await prisma.letterTemplate.update({ where: { id: template.id }, data: { category: preset.category, title: preset.title, remarksText: preset.body } });
  await logAudit({ entityType: "LETTER_TEMPLATE", entityId: template.id, action: "UPDATE", before: { remarksText: template.remarksText }, after: { resetToPreset: preset.key }, userId: user.id, userName: user.name, branchId: template.branchId });
  revalidatePath(`/letter-templates/${template.id}`);
  revalidatePath("/letter-templates");
  return { error: null, ok: true };
}

export async function deleteTemplateAction(formData: FormData): Promise<State> {
  const { user, template } = await ownTemplate(str(formData.get("id")));
  if (!template) return { error: "Template not found." };
  const used = await prisma.noc.count({ where: { templateId: template.id } });
  if (used > 0) return { error: `This template is used by ${used} NOC${used === 1 ? "" : "s"}, so it can't be deleted. Duplicate it and edit the copy instead.` };
  await prisma.letterTemplate.delete({ where: { id: template.id } });
  await logAudit({ entityType: "LETTER_TEMPLATE", entityId: template.id, action: "DELETE", before: { name: template.name, category: template.category, remarksText: template.remarksText }, userId: user.id, userName: user.name, branchId: template.branchId });
  revalidatePath("/letter-templates");
  redirect("/letter-templates");
}
