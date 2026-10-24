"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { can, canMyCompanies, canViewSensitive } from "@/lib/permissions";
import { requireUserWithBranch, subjectOf } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { logAudit } from "@/lib/audit";
import { PARTY_ROLES } from "@/lib/documentTypes";
import { OWNER_ROLE, isValidShare, ownershipProblem, ownershipSummary } from "@/lib/ownership";
import { deleteOrphanParties } from "@/lib/partyLinks";
import { contactsError } from "@/lib/validators";

const NON_OWNER_ROLES = new Set<string>(PARTY_ROLES.filter((r) => r.value !== OWNER_ROLE).map((r) => r.value));
const clean = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

export type NewPersonInput = { name: string; nationality?: string; phone?: string; email?: string };
export type OwnerRowInput = { linkId?: string; partyId?: string; person?: NewPersonInput; percent: number };

/** The signed-in person, if they may change this company's owners and sponsors, with the company they are changing. */
async function guard(supplierId: string) {
  const ctx = await requireUserWithBranch();
  const subject = subjectOf(ctx.user);
  if (!can(subject, "partners.suppliers", "edit")) return { error: "You don't have permission to edit suppliers." } as const;
  const supplier = await prisma.supplier.findUnique({ where: { id: supplierId }, select: { id: true, name: true, branchId: true, isOwnCompany: true } });
  if (!supplier || !supplier.branchId || isOutsideBranch(supplier.branchId, ctx.branchId, ctx.isSuperAdmin)) return { error: "That supplier wasn't found." } as const;
  if (supplier.isOwnCompany && !canMyCompanies(subject, "edit")) return { error: "Changing an own company's owners and sponsors needs My Companies access." } as const;
  return { ctx, supplier, subject, branchId: supplier.branchId } as const;
}

function personProblem(p: NewPersonInput): string | null {
  if (!clean(p.name, 120)) return "Enter a name for each new person.";
  const fd = new FormData();
  if (p.phone) fd.set("phone", p.phone);
  if (p.email) fd.set("contactEmail", p.email);
  return contactsError(fd);
}

const personData = (p: NewPersonInput, branchId: string) => ({ name: clean(p.name, 120)!, nationality: clean(p.nationality, 60), phone: clean(p.phone, 40), email: clean(p.email, 120), branchId });

/**
 * Saves a company's owners and their shares in one go, so the shares can be checked together: every owner needs a share,
 * and they must add up to exactly 100. Existing rows (linkId) keep their person, new rows pick an existing person
 * (partyId) or describe a new one. Owners left out are removed from this company; a person left with no company goes
 * entirely, with their documents.
 */
export async function saveOwnersAction(input: { supplierId: string; owners: OwnerRowInput[] }): Promise<{ error?: string }> {
  const g = await guard(String(input?.supplierId || ""));
  if ("error" in g) return { error: g.error };
  const rows = Array.isArray(input.owners) ? input.owners.slice(0, 30) : [];
  if (rows.some((r) => !isValidShare(r.percent))) return { error: "Choose a share from 1% to 100% for each owner." };
  const summary = ownershipSummary(rows.map((r) => r.percent));
  const problem = ownershipProblem(summary);
  if (problem) return { error: problem };
  for (const r of rows) {
    if (!r.linkId && !r.partyId && !r.person) return { error: "Choose a person for each owner." };
    if (r.person) { const bad = personProblem(r.person); if (bad) return { error: bad }; }
  }

  const current = await prisma.supplierPartyLink.findMany({ where: { supplierId: g.supplier.id, role: OWNER_ROLE }, select: { id: true, partyId: true } });
  const currentById = new Map(current.map((l) => [l.id, l]));
  if (rows.some((r) => r.linkId && !currentById.has(r.linkId))) return { error: "The owners changed while you were editing. Reload the page and try again." };
  const existingIds = rows.filter((r) => r.partyId).map((r) => r.partyId!);
  const known = existingIds.length ? await prisma.supplierParty.findMany({ where: { id: { in: existingIds }, branchId: g.branchId }, select: { id: true } }) : [];
  if (known.length !== new Set(existingIds).size) return { error: "One of the people you chose wasn't found." };
  const kept = new Set(rows.filter((r) => r.linkId).map((r) => r.linkId!));
  const removed = current.filter((l) => !kept.has(l.id));
  const finalParty = [...rows.filter((r) => r.linkId).map((r) => currentById.get(r.linkId!)!.partyId), ...existingIds];
  if (new Set(finalParty).size !== finalParty.length) return { error: "The same person is listed as an owner twice." };

  // Taking someone off their only company deletes them and their documents, which only people who may open those can do.
  if (removed.length && !canViewSensitive(g.subject)) {
    const stillLinked = await prisma.supplierPartyLink.findMany({ where: { partyId: { in: removed.map((l) => l.partyId) }, id: { notIn: removed.map((l) => l.id) } }, select: { partyId: true } });
    const keepers = new Set([...stillLinked.map((l) => l.partyId), ...existingIds]);
    if (removed.some((l) => !keepers.has(l.partyId))) return { error: "Removing this owner would delete their documents, which needs the Sensitive documents permission." };
  }

  await prisma.$transaction(async (tx) => {
    for (const r of rows) {
      if (r.linkId) { await tx.supplierPartyLink.update({ where: { id: r.linkId }, data: { ownershipPercent: r.percent } }); continue; }
      const partyId = r.partyId ?? (await tx.supplierParty.create({ data: personData(r.person!, g.branchId) })).id;
      await tx.supplierPartyLink.create({ data: { supplierId: g.supplier.id, partyId, role: OWNER_ROLE, ownershipPercent: r.percent, branchId: g.branchId } });
    }
    if (removed.length) await tx.supplierPartyLink.deleteMany({ where: { id: { in: removed.map((l) => l.id) } } });
    await deleteOrphanParties(tx, g.branchId);
  });
  await logAudit({ entityType: "SUPPLIER", entityId: g.supplier.id, action: "UPDATE", before: { owners: current.length }, after: { owners: rows.length, ownership: `${summary.total}%` }, userId: g.ctx.user.id, userName: g.ctx.user.name, branchId: g.branchId });
  revalidatePath(`/suppliers/${g.supplier.id}`);
  revalidatePath("/my-companies");
  return {};
}

/** Adds a sponsor, partner or manager (no share) to a company: an existing person or a new one. Owners go through saveOwnersAction. */
export async function addPartyLinkAction(input: { supplierId: string; role: string; partyId?: string; person?: NewPersonInput }): Promise<{ error?: string }> {
  const g = await guard(String(input?.supplierId || ""));
  if ("error" in g) return { error: g.error };
  if (!NON_OWNER_ROLES.has(input.role)) return { error: "Choose a role: sponsor, partner or manager." };
  if (!input.partyId && !input.person) return { error: "Choose a person." };
  if (input.person) { const bad = personProblem(input.person); if (bad) return { error: bad }; }
  if (input.partyId) {
    const exists = await prisma.supplierParty.findFirst({ where: { id: input.partyId, branchId: g.branchId }, select: { id: true } });
    if (!exists) return { error: "That person wasn't found." };
    const dup = await prisma.supplierPartyLink.findFirst({ where: { supplierId: g.supplier.id, partyId: input.partyId, role: input.role }, select: { id: true } });
    if (dup) return { error: "That person already has this role in this company." };
  }
  const link = await prisma.$transaction(async (tx) => {
    const partyId = input.partyId ?? (await tx.supplierParty.create({ data: personData(input.person!, g.branchId) })).id;
    return tx.supplierPartyLink.create({ data: { supplierId: g.supplier.id, partyId, role: input.role, branchId: g.branchId } });
  });
  await logAudit({ entityType: "SUPPLIER_PARTY", entityId: link.partyId, action: "CREATE", after: { company: g.supplier.name, role: input.role }, userId: g.ctx.user.id, userName: g.ctx.user.name, branchId: g.branchId });
  revalidatePath(`/suppliers/${g.supplier.id}`);
  revalidatePath("/my-companies");
  return {};
}

/** Takes a sponsor, partner or manager off this company. If it was the person's only company they are deleted with their documents. */
export async function removePartyLinkAction(formData: FormData): Promise<void> {
  const linkId = String(formData.get("linkId") || "");
  const link = await prisma.supplierPartyLink.findUnique({ where: { id: linkId }, select: { id: true, role: true, partyId: true, supplierId: true, party: { select: { name: true } } } });
  if (!link || link.role === OWNER_ROLE) return; // owners are changed together, so their shares keep adding up to 100
  const g = await guard(link.supplierId);
  if ("error" in g) return;
  const others = await prisma.supplierPartyLink.count({ where: { partyId: link.partyId, id: { not: link.id } } });
  if (others === 0 && !canViewSensitive(g.subject)) return; // would delete their documents
  await prisma.$transaction(async (tx) => {
    await tx.supplierPartyLink.delete({ where: { id: link.id } });
    await deleteOrphanParties(tx, g.branchId);
  });
  await logAudit({ entityType: "SUPPLIER_PARTY", entityId: link.partyId, action: "DELETE", before: { company: g.supplier.name, role: link.role, person: link.party.name }, userId: g.ctx.user.id, userName: g.ctx.user.name, branchId: g.branchId });
  revalidatePath(`/suppliers/${link.supplierId}`);
  revalidatePath("/my-companies");
}

/** Changes a person's details once, for every company they are linked to. */
export async function updatePartyAction(input: { supplierId: string; partyId: string } & NewPersonInput): Promise<{ error?: string }> {
  const g = await guard(String(input?.supplierId || ""));
  if ("error" in g) return { error: g.error };
  const bad = personProblem(input);
  if (bad) return { error: bad };
  const linked = await prisma.supplierPartyLink.findFirst({ where: { partyId: input.partyId, supplierId: g.supplier.id }, select: { id: true } });
  if (!linked) return { error: "That person isn't part of this company." };
  const data = personData(input, g.branchId);
  await prisma.supplierParty.update({ where: { id: input.partyId }, data: { name: data.name, nationality: data.nationality, phone: data.phone, email: data.email } });
  await logAudit({ entityType: "SUPPLIER_PARTY", entityId: input.partyId, action: "UPDATE", after: { name: data.name }, userId: g.ctx.user.id, userName: g.ctx.user.name, branchId: g.branchId });
  const links = await prisma.supplierPartyLink.findMany({ where: { partyId: input.partyId }, select: { supplierId: true } });
  for (const l of links) revalidatePath(`/suppliers/${l.supplierId}`);
  return {};
}
