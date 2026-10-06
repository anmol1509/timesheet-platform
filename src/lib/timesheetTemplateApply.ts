import { prisma } from "@/lib/db";
import { isOutsideBranch } from "@/lib/branch";
import { DEFAULT_TIMESHEET_NOTES } from "@/lib/generateTimesheetPdf";
import type { Letterhead } from "@/lib/letterhead";
import { isTemplateKey, type TimesheetTemplateKey } from "@/lib/timesheetTemplates";
import { normalizeConfig, type TemplateConfig } from "@/lib/timesheetTemplateConfig";

export type ResolvedTemplate = { base: TimesheetTemplateKey; config: TemplateConfig | null; name: string };

export const CUSTOM_PREFIX = "custom:";

/** What a request's `template` value means: a built-in layout, or one of this company's own. Null = not theirs / gone. */
export async function resolveTemplate(value: string, branchId: string | null, isSuperAdmin: boolean): Promise<ResolvedTemplate | null> {
  if (isTemplateKey(value)) return { base: value, config: null, name: value };
  if (!value.startsWith(CUSTOM_PREFIX)) return null;
  const row = await prisma.timesheetTemplate.findUnique({ where: { id: value.slice(CUSTOM_PREFIX.length) } });
  if (!row || isOutsideBranch(row.branchId, branchId, isSuperAdmin) || !isTemplateKey(row.baseKey)) return null;
  return { base: row.baseKey, config: normalizeConfig(row.baseKey, row.config), name: row.name };
}

/** The letterhead with the details the template switched off taken out. */
export function maskLetterhead(l: Letterhead, c: TemplateConfig | null): Letterhead {
  if (!c) return l;
  const h = c.header;
  return {
    ...l,
    logo: h.logo ? l.logo : null,
    addressLines: h.address ? l.addressLines : [],
    phone: h.phone ? l.phone : null,
    fax: h.phone ? l.fax : null,
    email: h.email ? l.email : null,
    poBox: h.poBox ? l.poBox : null,
    trn: h.trn ? l.trn : null,
  };
}

/** What the standard day-by-day layout takes from a template. */
export function standardExtras(c: TemplateConfig | null, vatDefault: number) {
  if (!c) return { vatPercent: vatDefault, notes: DEFAULT_TIMESHEET_NOTES } as const;
  const own = c.notes.split(/\n+/).map((x) => x.trim()).filter(Boolean);
  return {
    vatPercent: c.blocks.vat ? (c.vatPercent ?? vatDefault) : 0,
    notes: c.blocks.notes ? (own.length ? own : DEFAULT_TIMESHEET_NOTES) : [],
    titleText: c.title || undefined,
    signatureLabels: c.signatures,
    footerText: c.footer || undefined,
  };
}
