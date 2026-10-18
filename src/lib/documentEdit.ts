import { prisma } from "@/lib/db";

/**
 * Wording changed for one document only. Stored with its merge fields, so it still fills in from the records every time
 * the document is printed, and the template it began as is never touched.
 */
export type DocEditKind = "noc" | "noc-draft" | "undertaking" | "salary-revision" | "final-settlement" | "deduction-notice" | "advance-request" | "advance-receipt";

/** The wording saved for this document, or null when it uses the template as written. */
export async function findDocEdit(kind: DocEditKind, subjectId: string): Promise<string | null> {
  const row = await prisma.documentEdit.findUnique({ where: { kind_subjectId: { kind, subjectId } }, select: { bodyHtml: true } });
  return row?.bodyHtml ?? null;
}
