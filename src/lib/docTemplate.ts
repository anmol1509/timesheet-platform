import { prisma } from "@/lib/db";
import { findDocEdit, type DocEditKind } from "@/lib/documentEdit";
import { ASK_PREFIX, askLabels, substituteInHtml, templateHtml } from "@/lib/letterHtml";
import { presetByKey, presetHtml } from "@/lib/letterPresets";
import { sanitizeLetterHtml } from "@/lib/letterSanitize";

/**
 * The wording of a letter that is made from records (an advance, a salary revision, a settlement, a deduction notice):
 * the company's own copy of the template if it has made one in Letters, else the built-in wording, with every field filled in.
 */
/** The wording a letter made from records starts with: the company's own copy of the template, else the built-in one. */
export async function presetBase(branchId: string, presetKey: string) {
  const preset = presetByKey(presetKey);
  if (!preset) throw new Error(`No built-in template "${presetKey}".`);
  const own = await prisma.letterTemplate.findFirst({ where: { branchId, audience: "EMPLOYEE", presetKey }, orderBy: { createdAt: "desc" } });
  return { html: own ? templateHtml(own) : presetHtml(preset), title: own?.title || own?.category || preset.title, name: own ? own.name : `${preset.name} (built in)` };
}

export async function renderPresetDoc(opts: { branchId: string; presetKey: string; values: Record<string, string>; /** The record this letter is about: wording saved for it alone wins over the template. */ subjectId?: string }): Promise<{ html: string; title: string; templateName: string; edited: boolean }> {
  const preset = presetByKey(opts.presetKey);
  if (!preset) throw new Error(`No built-in template "${opts.presetKey}".`);
  const own = await prisma.letterTemplate.findFirst({ where: { branchId: opts.branchId, audience: "EMPLOYEE", presetKey: opts.presetKey }, orderBy: { createdAt: "desc" } });
  const mine = opts.subjectId ? await findDocEdit(opts.presetKey as DocEditKind, opts.subjectId) : null;
  const html = mine?.html ?? (own ? templateHtml(own) : presetHtml(preset));
  const values = { ...opts.values };
  // "Ask when issuing" blanks have no one to ask here: leave them visibly open to fill in by hand.
  for (const label of askLabels(html)) values[`${ASK_PREFIX}${label}`] = `[${label}]`;
  return {
    html: sanitizeLetterHtml(substituteInHtml(html, values)),
    title: (mine?.title || own?.title || own?.category || preset.title).toUpperCase(),
    templateName: own ? own.name : `${preset.name} (built in)`,
    edited: mine !== null,
  };
}
