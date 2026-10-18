"use server";

import { prisma } from "@/lib/db";
import { requireUserWithBranch, requirePermission, requireWrite, subjectOf } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { can } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { htmlToText, templateHtml } from "@/lib/letterHtml";
import { sanitizeLetterHtml } from "@/lib/letterSanitize";
import { unknownFieldsIn, type Audience } from "@/lib/letterFields";
import { presetBase } from "@/lib/docTemplate";
import type { DocEditKind } from "@/lib/documentEdit";

/** What a person asks to edit. An advance is one record whose letter changes from a request to a receipt, so the server decides which. */
export type DocTarget = { kind: "noc" | "noc-draft" | "undertaking" | "salary-revision" | "final-settlement" | "deduction-notice" | "advance"; subjectId: string };
export type DocEditState = { html: string; edited: boolean; audience: Audience; label: string } | { error: string };

type Resolved = { kind: DocEditKind; subjectId: string; branchId: string; audience: Audience; baseHtml: string; label: string; payroll: boolean };

const SITE_LABEL: Record<string, string> = { noc: "NOC", "noc-draft": "NOC", undertaking: "Undertaking letter" };

/** The document the target names, its starting wording, and where it belongs. Null when it isn't found. */
async function resolve(t: DocTarget): Promise<Resolved | null> {
  const id = String(t.subjectId || "");
  if (!id) return null;
  if (t.kind === "noc") {
    const n = await prisma.noc.findUnique({ where: { id }, select: { branchId: true, template: true } });
    return n ? { kind: "noc", subjectId: id, branchId: n.branchId, audience: "SITE", baseHtml: templateHtml(n.template), label: SITE_LABEL.noc, payroll: false } : null;
  }
  if (t.kind === "noc-draft" || t.kind === "undertaking") {
    const [demandId, templateId] = id.split(":");
    if (!demandId || !templateId) return null;
    const [d, tpl] = await Promise.all([prisma.demandRequest.findUnique({ where: { id: demandId }, select: { branchId: true } }), prisma.letterTemplate.findUnique({ where: { id: templateId } })]);
    if (!d || !tpl || tpl.branchId !== d.branchId) return null;
    return { kind: t.kind, subjectId: id, branchId: d.branchId, audience: "SITE", baseHtml: templateHtml(tpl), label: SITE_LABEL[t.kind], payroll: false };
  }
  const own = async (branchId: string, key: string, label: string, kind: DocEditKind): Promise<Resolved> => ({ kind, subjectId: id, branchId, audience: "EMPLOYEE", baseHtml: (await presetBase(branchId, key)).html, label, payroll: true });
  if (t.kind === "salary-revision") { const r = await prisma.salaryRevision.findUnique({ where: { id }, select: { branchId: true } }); return r ? own(r.branchId, "salary-revision", "Salary revision letter", "salary-revision") : null; }
  if (t.kind === "final-settlement") { const s = await prisma.finalSettlement.findUnique({ where: { id }, select: { branchId: true } }); return s ? own(s.branchId, "final-settlement", "Settlement letter", "final-settlement") : null; }
  if (t.kind === "deduction-notice") { const l = await prisma.payrollLine.findUnique({ where: { id }, select: { run: { select: { branchId: true } } } }); return l ? own(l.run.branchId, "deduction-notice", "Deduction notice", "deduction-notice") : null; }
  if (t.kind === "advance") {
    const a = await prisma.employeeLoan.findUnique({ where: { id }, select: { branchId: true, givenDate: true } });
    return a ? own(a.branchId, a.givenDate ? "advance-receipt" : "advance-request", a.givenDate ? "Advance receipt" : "Advance request", a.givenDate ? "advance-receipt" : "advance-request") : null;
  }
  return null;
}

async function guard(t: DocTarget, write: boolean): Promise<{ r: Resolved; user: Awaited<ReturnType<typeof requireUserWithBranch>>["user"] } | { error: string }> {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const r = await resolve(t);
  if (!r || isOutsideBranch(r.branchId, branchId, isSuperAdmin)) return { error: "Document not found." };
  const target = r.payroll ? "payroll.payroll" : "demand";
  if (write) {
    await requireWrite(target);
    if (r.payroll) await requirePermission("payroll.payroll", "edit");
  } else if (!can(subjectOf(user), target, "view")) return { error: "You can't open this document." };
  return { r, user };
}

/** The wording to edit: what was saved for this document, else the template. */
export async function loadDocEditAction(t: DocTarget): Promise<DocEditState> {
  const g = await guard(t, false);
  if ("error" in g) return g;
  const saved = await prisma.documentEdit.findUnique({ where: { kind_subjectId: { kind: g.r.kind, subjectId: g.r.subjectId } }, select: { bodyHtml: true } });
  return { html: saved?.bodyHtml ?? g.r.baseHtml, edited: !!saved, audience: g.r.audience, label: g.r.label };
}

/** Keeps new wording for this one document. The merge fields stay in it, so the figures still come from the records. */
export async function saveDocEditAction(t: DocTarget, html: string): Promise<{ error: string | null }> {
  const g = await guard(t, true);
  if ("error" in g) return { error: g.error };
  const clean = sanitizeLetterHtml(String(html ?? "").slice(0, 40_000));
  if (htmlToText(clean).length === 0) return { error: "The wording is empty." };
  const unknown = unknownFieldsIn(clean, g.r.audience);
  if (unknown.length > 0) return { error: `These fields aren't recognised: ${unknown.map((k) => `%%${k}%%`).join(", ")}. Remove them or pick from Insert field.` };
  const { r, user } = g;
  await prisma.documentEdit.upsert({
    where: { kind_subjectId: { kind: r.kind, subjectId: r.subjectId } },
    create: { kind: r.kind, subjectId: r.subjectId, bodyHtml: clean, branchId: r.branchId, editedById: user.id, editedByName: user.name },
    update: { bodyHtml: clean, editedById: user.id, editedByName: user.name },
  });
  await logAudit({ entityType: "DOCUMENT_EDIT", entityId: r.subjectId, action: "UPDATE", after: { kind: r.kind, wording: htmlToText(clean).slice(0, 300) }, userId: user.id, userName: user.name, branchId: r.branchId });
  return { error: null };
}

/** Goes back to the template's wording for this document. */
export async function resetDocEditAction(t: DocTarget): Promise<{ error: string | null }> {
  const g = await guard(t, true);
  if ("error" in g) return { error: g.error };
  const { r, user } = g;
  await prisma.documentEdit.deleteMany({ where: { kind: r.kind, subjectId: r.subjectId } });
  await logAudit({ entityType: "DOCUMENT_EDIT", entityId: r.subjectId, action: "DELETE", after: { kind: r.kind, resetToTemplate: true }, userId: user.id, userName: user.name, branchId: r.branchId });
  return { error: null };
}
