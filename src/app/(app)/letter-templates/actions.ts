"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAdmin, requireUserWithBranch } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { logAudit } from "@/lib/audit";
import { LETTER_PRESETS, categoriesFor, presetByKey, presetHtml } from "@/lib/letterPresets";
import { htmlToText, templateHtml } from "@/lib/letterHtml";
import { sanitizeLetterHtml } from "@/lib/letterSanitize";
import { unknownFieldsIn, type Audience } from "@/lib/letterFields";
import { assertContactsValid } from "@/lib/validators";

type State = { error: string | null; ok?: boolean };
const MAX_HTML = 40_000;
const str = (v: FormDataEntryValue | null) => String(v ?? "").trim();
const asAudience = (v: string): Audience => (v === "EMPLOYEE" ? "EMPLOYEE" : "SITE");

async function ownTemplate(id: string) {
  await requireAdmin();
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const template = await prisma.letterTemplate.findUnique({ where: { id } });
  const ok = template && !isOutsideBranch(template.branchId, branchId, isSuperAdmin);
  return { user, branchId, template: ok ? template : null };
}

/** Starts a template from a built-in preset ("blank" for an empty one) and opens the editor. */
export async function createFromPresetAction(formData: FormData) {
  assertContactsValid(formData);
  await requireAdmin();
  const { user, branchId } = await requireUserWithBranch();
  if (!branchId) redirect("/letter-templates?error=" + encodeURIComponent("Pick a branch first."));
  const preset = presetByKey(str(formData.get("presetKey")));
  const audience = preset ? preset.audience : asAudience(str(formData.get("audience")));
  const html = preset ? presetHtml(preset) : "<p>Write your letter here. Use <strong>Insert field</strong> to add details that are filled in automatically.</p>";
  const created = await prisma.letterTemplate.create({
    data: {
      branchId, audience,
      name: preset?.name ?? "Untitled template",
      category: preset?.category ?? null,
      title: preset?.title ?? null,
      presetKey: preset?.key ?? null,
      bodyHtml: html,
      remarksText: htmlToText(html),
    },
  });
  await logAudit({ entityType: "LETTER_TEMPLATE", entityId: created.id, action: "CREATE", after: { name: created.name, presetKey: preset?.key ?? null, audience }, userId: user.id, userName: user.name, branchId });
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
    data: missing.map((p) => ({ branchId, audience: p.audience, name: p.name, category: p.category, title: p.title, presetKey: p.key, bodyHtml: presetHtml(p), remarksText: htmlToText(presetHtml(p)) })),
  });
  await logAudit({ entityType: "LETTER_TEMPLATE", entityId: branchId, action: "CREATE", after: { addedDefaults: missing.map((m) => m.key) }, userId: user.id, userName: user.name, branchId });
  revalidatePath("/letter-templates");
  return { error: null, ok: true };
}

export async function saveTemplateAction(_prev: State, formData: FormData): Promise<State> {
  assertContactsValid(formData);
  const id = str(formData.get("id"));
  const { user, template } = await ownTemplate(id);
  if (!template) return { error: "Template not found." };
  const audience = asAudience(template.audience);
  const name = str(formData.get("name"));
  const category = str(formData.get("category")) || null;
  const title = str(formData.get("title")) || null;
  const raw = String(formData.get("bodyHtml") ?? "");
  if (!name) return { error: "Give the template a name." };
  if (raw.length > MAX_HTML) return { error: "That's too long for one letter." };
  const html = sanitizeLetterHtml(raw);
  const text = htmlToText(html);
  if (!text && !html.includes("data-worker-table")) return { error: "The letter body can't be empty." };
  if (category && !categoriesFor(audience).includes(category)) return { error: "Choose one of the letter types." };

  // A misspelt field would print as a blank in a real letter — refuse it here.
  const unknown = unknownFieldsIn(html, audience);
  if (unknown.length > 0) return { error: `Not a real field: ${unknown.map((u) => `%%${u}%%`).join(", ")}. Use Insert field to avoid typos.` };

  await prisma.letterTemplate.update({ where: { id }, data: { name, category, title, bodyHtml: html, remarksText: text } });
  await logAudit({ entityType: "LETTER_TEMPLATE", entityId: id, action: "UPDATE", before: { name: template.name, category: template.category, title: template.title, body: htmlToText(templateHtml(template)) }, after: { name, category, title, body: text }, userId: user.id, userName: user.name, branchId: template.branchId });
  revalidatePath("/letter-templates");
  revalidatePath(`/letter-templates/${id}`);
  return { error: null, ok: true };
}

export async function duplicateTemplateAction(formData: FormData) {
  assertContactsValid(formData);
  const { user, template } = await ownTemplate(str(formData.get("id")));
  if (!template) return;
  const created = await prisma.letterTemplate.create({
    data: { branchId: template.branchId, audience: template.audience, name: `${template.name} (copy)`, category: template.category, title: template.title, presetKey: null, bodyHtml: templateHtml(template), remarksText: template.remarksText },
  });
  await logAudit({ entityType: "LETTER_TEMPLATE", entityId: created.id, action: "CREATE", after: { duplicatedFrom: template.id }, userId: user.id, userName: user.name, branchId: template.branchId });
  revalidatePath("/letter-templates");
  redirect(`/letter-templates/${created.id}`);
}

export async function resetToPresetAction(formData: FormData): Promise<State> {
  assertContactsValid(formData);
  const { user, template } = await ownTemplate(str(formData.get("id")));
  const preset = presetByKey(template?.presetKey);
  if (!template || !preset) return { error: "There's no original to reset to." };
  const html = presetHtml(preset);
  await prisma.letterTemplate.update({ where: { id: template.id }, data: { category: preset.category, title: preset.title, bodyHtml: html, remarksText: htmlToText(html) } });
  await logAudit({ entityType: "LETTER_TEMPLATE", entityId: template.id, action: "UPDATE", before: { body: htmlToText(templateHtml(template)) }, after: { resetToPreset: preset.key }, userId: user.id, userName: user.name, branchId: template.branchId });
  revalidatePath(`/letter-templates/${template.id}`);
  revalidatePath("/letter-templates");
  return { error: null, ok: true };
}

export async function deleteTemplateAction(formData: FormData): Promise<State> {
  assertContactsValid(formData);
  const { user, template } = await ownTemplate(str(formData.get("id")));
  if (!template) return { error: "Template not found." };
  const used = await prisma.noc.count({ where: { templateId: template.id } });
  if (used > 0) return { error: `This template is used by ${used} NOC${used === 1 ? "" : "s"}, so it can't be deleted. Duplicate it and edit the copy instead.` };
  // Letters already issued keep their own copy of the wording, so deleting is safe for them.
  await prisma.letterTemplate.delete({ where: { id: template.id } });
  await logAudit({ entityType: "LETTER_TEMPLATE", entityId: template.id, action: "DELETE", before: { name: template.name, category: template.category, body: template.remarksText }, userId: user.id, userName: user.name, branchId: template.branchId });
  revalidatePath("/letter-templates");
  redirect("/letter-templates");
}
