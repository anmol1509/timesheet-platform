"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUserWithBranch, requireWrite } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { logAudit } from "@/lib/audit";
import { RENEWAL_STATUS_KEYS, type RenewalRef } from "@/lib/renewalCases";
import { COMPLIANCE_FIELDS } from "@/lib/compliance";

export type RenewalPatch = { status?: string; ownerId?: string | null; note?: string | null };

const MAX_AT_ONCE = 300;

/**
 * Sets the status, owner and/or note on one or more renewals. Only the fields in `patch` change. A renewal is
 * named by who it belongs to, the document and its expiry date, so nothing is stored until someone touches it.
 */
export async function updateRenewalsAction(refs: RenewalRef[], patch: RenewalPatch): Promise<{ ok: true; count: number } | { error: string }> {
  await requireWrite("workforce.renewals");
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  if (!Array.isArray(refs) || refs.length === 0) return { error: "Choose at least one renewal." };
  if (refs.length > MAX_AT_ONCE) return { error: `Change at most ${MAX_AT_ONCE} renewals at a time.` };
  if (patch.status !== undefined && !RENEWAL_STATUS_KEYS.includes(patch.status)) return { error: "That status isn't one of the choices." };
  const note = patch.note === undefined ? undefined : (patch.note ?? "").trim().slice(0, 300) || null;

  // Each renewal's branch comes from the person or supplier it belongs to, never from what the browser sent.
  const clean = refs.filter((r) => ["employee", "supplier", "party", "vehicle", "record"].includes(r.kind) && typeof r.subjectId === "string" && typeof r.document === "string" && /^\d{4}-\d{2}-\d{2}/.test(r.expiry));
  const employeeIds = [...new Set(clean.filter((r) => r.kind === "employee").map((r) => r.subjectId))];
  const supplierIds = [...new Set(clean.filter((r) => r.kind === "supplier").map((r) => r.subjectId))];
  const partyIds = [...new Set(clean.filter((r) => r.kind === "party").map((r) => r.subjectId))];
  const vehicleIds = [...new Set(clean.filter((r) => r.kind === "vehicle").map((r) => r.subjectId))];
  // A "record" renewal is a document kept on a client, project, quotation, enquiry, bill or expense: its id says which table.
  const recordIds = clean.filter((r) => r.kind === "record").map((r) => r.subjectId);
  const part = (src: string) => [...new Set(recordIds.filter((i) => i.startsWith(`${src}:`)).map((i) => i.slice(src.length + 1)))];
  const [employees, suppliers, parties, vehicles, clientDocs, projectDocs, attached] = await Promise.all([
    prisma.employee.findMany({ where: { id: { in: employeeIds } }, select: { id: true, branchId: true } }),
    prisma.supplier.findMany({ where: { id: { in: supplierIds } }, select: { id: true, branchId: true } }),
    prisma.supplierParty.findMany({ where: { id: { in: partyIds } }, select: { id: true, branchId: true } }),
    prisma.vehicle.findMany({ where: { id: { in: vehicleIds }, branchId: { not: null } }, select: { id: true, branchId: true } }),
    prisma.clientDocument.findMany({ where: { id: { in: part("clientdoc") } }, select: { id: true, client: { select: { branchId: true } } } }),
    prisma.projectDocument.findMany({ where: { id: { in: part("projdoc") } }, select: { id: true, project: { select: { branchId: true } } } }),
    prisma.attachment.findMany({ where: { id: { in: part("attach") }, branchId: { not: null } }, select: { id: true, branchId: true } }),
  ]);
  const branchOf = new Map<string, string>([
    ...employees.map((e) => [`employee|${e.id}`, e.branchId] as const),
    ...suppliers.map((s) => [`supplier|${s.id}`, s.branchId] as const),
    ...parties.map((p) => [`party|${p.id}`, p.branchId] as const),
    ...vehicles.map((v) => [`vehicle|${v.id}`, v.branchId!] as const),
    ...clientDocs.map((d) => [`record|clientdoc:${d.id}`, d.client.branchId] as const),
    ...projectDocs.map((d) => [`record|projdoc:${d.id}`, d.project.branchId] as const),
    ...attached.map((a) => [`record|attach:${a.id}`, a.branchId!] as const),
  ]);
  const targets = clean.filter((r) => {
    const b = branchOf.get(`${r.kind}|${r.subjectId}`);
    return b && !isOutsideBranch(b, branchId, isSuperAdmin);
  });
  if (targets.length === 0) return { error: "Those renewals aren't in this company." };

  // An owner must be an active person of the same branch (or an administrator without a branch).
  let ownerName: string | null | undefined;
  if (patch.ownerId !== undefined && patch.ownerId !== null) {
    const owner = await prisma.user.findUnique({ where: { id: patch.ownerId }, select: { id: true, name: true, isActive: true, branchId: true, role: true } });
    if (!owner || !owner.isActive) return { error: "That person can't be given renewals." };
    const branches = new Set(targets.map((t) => branchOf.get(`${t.kind}|${t.subjectId}`)));
    if (owner.role !== "SUPER_ADMIN" && (branches.size !== 1 || !branches.has(owner.branchId ?? ""))) return { error: "That person belongs to a different company." };
    ownerName = owner.name;
  }

  const data = {
    ...(patch.status !== undefined ? { status: patch.status } : {}),
    ...(patch.ownerId !== undefined ? { ownerId: patch.ownerId } : {}),
    ...(note !== undefined ? { note } : {}),
    updatedById: user.id,
    updatedByName: user.name,
  };
  await prisma.$transaction(
    targets.map((t) => {
      const expiry = new Date(`${t.expiry.slice(0, 10)}T00:00:00Z`);
      return prisma.renewalCase.upsert({
        where: { kind_subjectId_document_expiry: { kind: t.kind, subjectId: t.subjectId, document: t.document, expiry } },
        update: data,
        create: { kind: t.kind, subjectId: t.subjectId, document: t.document, expiry, branchId: branchOf.get(`${t.kind}|${t.subjectId}`)!, ...data },
      });
    }),
  );
  await logAudit({
    entityType: "RENEWAL",
    entityId: targets[0].subjectId,
    action: "UPDATE",
    after: { renewals: targets.length, ...(patch.status !== undefined ? { status: patch.status } : {}), ...(ownerName !== undefined ? { owner: ownerName } : patch.ownerId === null ? { owner: null } : {}), ...(note !== undefined ? { note } : {}) },
    userId: user.id,
    userName: user.name,
    branchId: branchId ?? null,
  });
  revalidatePath("/employees/renewals");
  return { ok: true, count: targets.length };
}

/** Sets the new expiry on a worker's record after a renewal, for documents the scanner doesn't read (medical, insurance, ...) or when its date needs correcting. */
export async function setRenewalExpiryAction(input: { employeeId: string; field: string; expiry: string }): Promise<{ ok: true } | { error: string }> {
  await requireWrite("workforce.renewals");
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const field = COMPLIANCE_FIELDS.find((f) => f.key === input.field);
  if (!field) return { error: "That isn't a renewable date." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.expiry)) return { error: "Choose the new expiry date." };
  const next = new Date(`${input.expiry}T00:00:00.000Z`);
  if (Number.isNaN(next.getTime()) || next.getUTCFullYear() < 2000 || next.getUTCFullYear() > 2100) return { error: "That date doesn't look right." };
  const e = await prisma.employee.findUnique({ where: { id: input.employeeId } });
  if (!e || isOutsideBranch(e.branchId, branchId, isSuperAdmin)) return { error: "That employee isn't in this company." };
  const before = (e as Record<string, unknown>)[field.key] as Date | null;
  await prisma.employee.update({ where: { id: e.id }, data: { [field.key]: next } });
  await logAudit({ entityType: "EMPLOYEE", entityId: e.id, action: "UPDATE", before: { [field.key]: before }, after: { [field.key]: next, source: "renewal" }, userId: user.id, userName: user.name, branchId });
  revalidatePath("/employees/renewals");
  revalidatePath(`/employees/${e.id}`);
  return { ok: true };
}
