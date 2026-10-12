import { prisma } from "@/lib/db";
import { ASK_PREFIX, askLabels, substituteInHtml, templateHtml } from "@/lib/letterHtml";
import { presetByKey, presetHtml } from "@/lib/letterPresets";
import { sanitizeLetterHtml } from "@/lib/letterSanitize";

/**
 * The wording of a letter that is made from records (an advance, a salary revision, a settlement, a deduction notice):
 * the company's own copy of the template if it has made one in Letters, else the built-in wording, with every field filled in.
 */
export async function renderPresetDoc(opts: { branchId: string; presetKey: string; values: Record<string, string> }): Promise<{ html: string; title: string; templateName: string }> {
  const preset = presetByKey(opts.presetKey);
  if (!preset) throw new Error(`No built-in template "${opts.presetKey}".`);
  const own = await prisma.letterTemplate.findFirst({ where: { branchId: opts.branchId, audience: "EMPLOYEE", presetKey: opts.presetKey }, orderBy: { createdAt: "desc" } });
  const html = own ? templateHtml(own) : presetHtml(preset);
  const values = { ...opts.values };
  // "Ask when issuing" blanks have no one to ask here: leave them visibly open to fill in by hand.
  for (const label of askLabels(html)) values[`${ASK_PREFIX}${label}`] = `[${label}]`;
  return {
    html: sanitizeLetterHtml(substituteInHtml(html, values)),
    title: (own?.title || own?.category || preset.title).toUpperCase(),
    templateName: own ? own.name : `${preset.name} (built in)`,
  };
}
