"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { canMyCompanies, canViewSensitive } from "@/lib/permissions";
import { requireUserWithBranch, subjectOf } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { logAudit } from "@/lib/audit";
import { OWNER_ROLE, isValidShare } from "@/lib/ownership";
import { PARTY_ROLES, PARTY_ROLE_LABEL } from "@/lib/documentTypes";
import { contactsError } from "@/lib/validators";
import { sameName } from "@/lib/people";

/**
 * Merges a duplicate person into the one to keep: their company roles, shares and documents move across, details the kept
 * person lacks are filled in, and the duplicate is removed. Where both held the same role in a company the roles become
 * one (an owner's two shares are added). Needs My Companies edit and Sensitive documents, since personal documents move.
 */
export async function mergePeopleAction(input: { keepId: string; dropId: string }): Promise<{ error?: string }> {
  const ctx = await requireUserWithBranch();
  const subject = subjectOf(ctx.user);
  if (!canMyCompanies(subject, "edit") || !canViewSensitive(subject)) return { error: "Merging people needs My Companies edit access and the Sensitive documents permission." };
  const keepId = String(input?.keepId || "");
  const dropId = String(input?.dropId || "");
  if (!keepId || !dropId || keepId === dropId) return { error: "Choose two different people." };

  const [keep, drop] = await Promise.all([
    prisma.supplierParty.findUnique({ where: { id: keepId } }),
    prisma.supplierParty.findUnique({ where: { id: dropId } }),
  ]);
  if (!keep || !drop || isOutsideBranch(keep.branchId, ctx.branchId, ctx.isSuperAdmin) || isOutsideBranch(drop.branchId, ctx.branchId, ctx.isSuperAdmin)) return { error: "That person wasn't found." };
  if (keep.branchId !== drop.branchId) return { error: "These people belong to different companies." };
  if (!sameName(keep.name, drop.name)) return { error: "Only people with the same name can be merged." };

  await prisma.$transaction(async (tx) => {
    const keepLinks = await tx.supplierPartyLink.findMany({ where: { partyId: keep.id } });
    const dropLinks = await tx.supplierPartyLink.findMany({ where: { partyId: drop.id } });
    for (const l of dropLinks) {
      const twin = keepLinks.find((k) => k.supplierId === l.supplierId && k.role === l.role);
      if (!twin) { await tx.supplierPartyLink.update({ where: { id: l.id }, data: { partyId: keep.id } }); continue; }
      if (l.role === OWNER_ROLE && (l.ownershipPercent != null || twin.ownershipPercent != null)) {
        await tx.supplierPartyLink.update({ where: { id: twin.id }, data: { ownershipPercent: Math.min(100, (twin.ownershipPercent ?? 0) + (l.ownershipPercent ?? 0)) } });
      }
      await tx.supplierPartyLink.delete({ where: { id: l.id } });
    }
    await tx.attachment.updateMany({ where: { entityType: "SUPPLIER_PARTY", entityId: drop.id }, data: { entityId: keep.id } });
    await tx.supplierParty.update({
      where: { id: keep.id },
      data: { nationality: keep.nationality ?? drop.nationality, phone: keep.phone ?? drop.phone, email: keep.email ?? drop.email, notes: keep.notes ?? drop.notes },
    });
    await tx.supplierParty.delete({ where: { id: drop.id } });
  });
  await logAudit({ entityType: "SUPPLIER_PARTY", entityId: keep.id, action: "UPDATE", before: { merged: drop.name, duplicateId: drop.id }, after: { kept: keep.name }, userId: ctx.user.id, userName: ctx.user.name, branchId: keep.branchId });
  revalidatePath("/my-companies");
  revalidatePath("/suppliers");
  return {};
}

export type PersonLinkInput = { supplierId: string; role: string; percent?: number | null };
export type NewPerson = { name: string; nationality?: string; phone?: string; email?: string };

const clean = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

/**
 * Saves a person to the Owners & sponsors list and gives them their companies and roles. A new person is described
 * (`person`); an existing one is named (`partyId`) and only gains links. Links are optional: a person can be saved with
 * no company and assigned later, from here or from the company's own page. A person can hold several roles, in several
 * companies, even two in the same one. Owners need a share, and a company's owner shares can never pass 100%.
 */
export async function savePersonAction(input: { partyId?: string; person?: NewPerson; links: PersonLinkInput[] }): Promise<{ error?: string; partyId?: string }> {
  const ctx = await requireUserWithBranch();
  const subject = subjectOf(ctx.user);
  if (!canMyCompanies(subject, "edit")) return { error: "Adding owners and sponsors needs My Companies edit access." };
  const branchId = ctx.branchId;
  if (!branchId) return { error: "Sign in as a company administrator first. All companies is selected." };

  const links = Array.isArray(input?.links) ? input.links.slice(0, 40) : [];
  const roles = new Set<string>(PARTY_ROLES.map((r) => r.value));
  const seen = new Set<string>();
  for (const l of links) {
    if (!l?.supplierId) return { error: "Choose a company for each line." };
    if (!roles.has(l.role)) return { error: "Choose a role for each line." };
    if (l.role === OWNER_ROLE && !isValidShare(l.percent)) return { error: "Choose a share from 1% to 100% for each owner line." };
    const key = `${l.supplierId}|${l.role}`;
    if (seen.has(key)) return { error: "The same company and role is listed twice." };
    seen.add(key);
  }

  const companyIds = [...new Set(links.map((l) => l.supplierId))];
  const companies = companyIds.length ? await prisma.supplier.findMany({ where: { id: { in: companyIds }, isOwnCompany: true, branchId }, select: { id: true, name: true } }) : [];
  if (companies.length !== companyIds.length) return { error: "One of the companies wasn't found among your own companies." };

  // Owner shares already held in each company, so a new share can't push it past 100%.
  const held = companyIds.length ? await prisma.supplierPartyLink.groupBy({ by: ["supplierId"], where: { supplierId: { in: companyIds }, role: OWNER_ROLE, ...(input.partyId ? { partyId: { not: input.partyId } } : {}) }, _sum: { ownershipPercent: true } }) : [];
  for (const c of companies) {
    const adding = links.filter((l) => l.supplierId === c.id && l.role === OWNER_ROLE).reduce((n, l) => n + (l.percent ?? 0), 0);
    const total = (held.find((h) => h.supplierId === c.id)?._sum.ownershipPercent ?? 0) + adding;
    if (total > 100) return { error: `Owner shares in ${c.name} would add up to ${total}%. Lower this share, or change the other owners from the company page first.` };
  }

  const partyId = input.partyId;
  if (partyId) {
    const found = await prisma.supplierParty.findFirst({ where: { id: partyId, branchId }, select: { id: true } });
    if (!found) return { error: "That person wasn't found." };
    const dup = await prisma.supplierPartyLink.findMany({ where: { partyId, OR: links.map((l) => ({ supplierId: l.supplierId, role: l.role })) }, select: { id: true } });
    if (links.length && dup.length) return { error: "This person already has one of these roles in that company." };
  } else {
    const p = input.person;
    const name = clean(p?.name, 120);
    if (!p || !name) return { error: "Enter the person's name." };
    const fd = new FormData();
    if (p.phone) fd.set("phone", p.phone);
    if (p.email) fd.set("contactEmail", p.email);
    const bad = contactsError(fd);
    if (bad) return { error: bad };
  }

  const id = await prisma.$transaction(async (tx) => {
    const pid = partyId ?? (await tx.supplierParty.create({ data: { name: clean(input.person!.name, 120)!, nationality: clean(input.person!.nationality, 60), phone: clean(input.person!.phone, 40), email: clean(input.person!.email, 120), branchId } })).id;
    for (const l of links) await tx.supplierPartyLink.create({ data: { supplierId: l.supplierId, partyId: pid, role: l.role, ownershipPercent: l.role === OWNER_ROLE ? l.percent! : null, branchId } });
    return pid;
  });
  await logAudit({ entityType: "SUPPLIER_PARTY", entityId: id, action: "CREATE", after: { person: input.person?.name ?? "existing person", links: links.map((l) => `${PARTY_ROLE_LABEL[l.role] ?? l.role} of ${companies.find((c) => c.id === l.supplierId)?.name}`).join(", ") || "none yet" }, userId: ctx.user.id, userName: ctx.user.name, branchId });
  revalidatePath("/my-companies/people");
  revalidatePath("/my-companies");
  for (const c of companyIds) revalidatePath(`/suppliers/${c}`);
  return { partyId: id };
}

/** Deletes a person who is linked to no company, with their documents. Only on purpose, never as a side effect of removing a link. */
export async function deletePersonAction(partyId: string): Promise<{ error?: string }> {
  const ctx = await requireUserWithBranch();
  const subject = subjectOf(ctx.user);
  if (!canMyCompanies(subject, "edit") || !canViewSensitive(subject)) return { error: "Deleting a person needs My Companies edit access and the Sensitive documents permission." };
  const person = await prisma.supplierParty.findUnique({ where: { id: String(partyId || "") }, select: { id: true, name: true, branchId: true, _count: { select: { links: true } } } });
  if (!person || isOutsideBranch(person.branchId, ctx.branchId, ctx.isSuperAdmin)) return { error: "That person wasn't found." };
  if (person._count.links > 0) return { error: `${person.name} is still linked to ${person._count.links} compan${person._count.links === 1 ? "y" : "ies"}. Remove those first.` };
  const files = await prisma.attachment.count({ where: { entityType: "SUPPLIER_PARTY", entityId: person.id } });
  await prisma.$transaction(async (tx) => {
    await tx.attachment.deleteMany({ where: { entityType: "SUPPLIER_PARTY", entityId: person.id } });
    await tx.supplierParty.delete({ where: { id: person.id } });
  });
  await logAudit({ entityType: "SUPPLIER_PARTY", entityId: person.id, action: "DELETE", before: { person: person.name, documents: files }, userId: ctx.user.id, userName: ctx.user.name, branchId: person.branchId });
  revalidatePath("/my-companies/people");
  revalidatePath("/my-companies");
  return {};
}
