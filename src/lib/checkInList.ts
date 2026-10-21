import { prisma } from "@/lib/db";
import { substituteInHtml, templateHtml } from "@/lib/letterHtml";
import { presetByKey, presetHtml } from "@/lib/letterPresets";
import { sanitizeLetterHtml } from "@/lib/letterSanitize";

export const CHECKIN_PRESET_KEY = "checkin-list";

/** The wording of the check-in list: the company's own copy from Letters (so it can be edited like any letter), else the built-in one. */
export async function checkInListWording(branchId: string | null): Promise<{ html: string; title: string }> {
  const preset = presetByKey(CHECKIN_PRESET_KEY)!;
  const own = branchId
    ? await prisma.letterTemplate.findFirst({ where: { branchId, audience: "SITE", presetKey: CHECKIN_PRESET_KEY }, orderBy: { createdAt: "desc" } })
    : null;
  return { html: own ? templateHtml(own) : presetHtml(preset), title: own?.title || own?.category || preset.title };
}

export type CheckInValues = { companyName: string; campName: string; campType: string; checkInDate: string; count: number; date: string };

/** Fills the template's merge fields; the marker where the table goes is kept for the PDF to split on. */
export function fillCheckInWording(html: string, v: CheckInValues): string {
  return sanitizeLetterHtml(
    substituteInHtml(html, {
      COMPANYNAME: v.companyName,
      BRANCHNAME: v.companyName,
      CAMPNAME: v.campName,
      CAMPTYPE: v.campType,
      CHECKINDATE: v.checkInDate,
      CHECKINCOUNT: String(v.count),
      WORKERCOUNT: String(v.count),
      DATE: v.date,
    })
  );
}
