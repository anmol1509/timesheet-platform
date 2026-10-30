import { prisma } from "@/lib/db";
import { branchWhere } from "@/lib/branch";
import { buildChecklist, resolveDocTypes } from "@/lib/documentTypes";
import type { PersonRow } from "@/lib/peopleFlags";

/**
 * Everyone who owns, sponsors, partners or manages a company in this branch, once each. People whose company links are
 * gone are included too: their files are no longer reminded about, so they need to be seen.
 */
export async function loadPeopleRegister(branchId: string | null): Promise<PersonRow[]> {
  const people = await prisma.supplierParty.findMany({
    where: { ...branchWhere(branchId) },
    select: {
      id: true,
      name: true,
      nationality: true,
      phone: true,
      branchId: true,
      links: { select: { role: true, ownershipPercent: true, supplier: { select: { id: true, name: true } } }, orderBy: { createdAt: "asc" } },
    },
    orderBy: { name: "asc" },
  });
  const ids = people.map((p) => p.id);
  const [typeRows, files] = await Promise.all([
    prisma.documentType.findMany({ where: branchWhere(branchId) }),
    ids.length
      ? prisma.attachment.findMany({
          where: { entityType: "SUPPLIER_PARTY", entityId: { in: ids } },
          select: { id: true, entityId: true, docType: true, filename: true, expiryDate: true, uploadedAt: true },
        })
      : [],
  ]);

  return people.map((p) => {
    const mine = files.filter((f) => f.entityId === p.id).map((f) => ({ id: f.id, docType: f.docType, filename: f.filename, expiryDate: f.expiryDate ? f.expiryDate.toISOString() : null, uploadedAt: f.uploadedAt.toISOString() }));
    const items = buildChecklist(resolveDocTypes(typeRows.filter((r) => r.branchId === p.branchId), "SUPPLIER_PARTY"), mine, false);
    return {
      id: p.id,
      name: p.name,
      nationality: p.nationality,
      phone: p.phone,
      companies: p.links.map((l) => ({ id: l.supplier.id, name: l.supplier.name, role: l.role, percent: l.ownershipPercent })),
      companyCount: new Set(p.links.map((l) => l.supplier.id)).size,
      docs: mine.length,
      flags: {
        none: mine.length === 0,
        expired: items.filter((i) => i.state === "expired").length,
        expiring: items.filter((i) => i.state === "expiring").length,
        // Someone with no files at all is already flagged as that; listing every required type as well only adds noise.
        missing: mine.length === 0 ? 0 : items.filter((i) => i.state === "missing" && i.required).length,
        // A document that should carry an expiry but has none recorded can never be reminded about.
        noExpiry: items.filter((i) => i.state === "uploaded" && i.type.hasExpiry).length,
        unlinked: p.links.length === 0,
      },
      nextDays: items.reduce<number | null>((min, i) => (i.daysLeft !== null && (min === null || i.daysLeft < min) ? i.daysLeft : min), null),
    };
  });
}
