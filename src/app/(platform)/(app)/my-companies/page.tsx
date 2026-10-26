import { redirect } from "next/navigation";
import { Landmark, Users, FileWarning, Clock } from "lucide-react";
import { PageHeader, CountPill } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { StatTile } from "@/components/StatTile";
import { prisma } from "@/lib/db";
import { requireUserWithBranch, subjectOf } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { can, canMyCompanies, canViewSensitive } from "@/lib/permissions";
import { groupLookups } from "@/lib/lookups";
import { duplicateGroups } from "@/lib/people";
import { PARTY_ROLE_LABEL } from "@/lib/documentTypes";
import { DuplicatePeople, type DupPerson } from "./duplicate-people";
import { buildChecklist, resolveDocTypes, type ChecklistItem } from "@/lib/documentTypes";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { CompanyTable, type CompanyRow, type DocSummary } from "./company-table";
import { OWNER_ROLE, ownershipSummary } from "@/lib/ownership";

export const metadata = { title: "My Companies" };

/** How a company's documents stand: what is missing that is required, what has lapsed, what is about to. */
function summarise(items: ChecklistItem[]) {
  let missing = 0, expired = 0, expiring = 0;
  for (const i of items) {
    if (i.state === "missing" && i.required) missing++;
    else if (i.state === "expired") expired++;
    else if (i.state === "expiring") expiring++;
  }
  return { missing, expired, expiring };
}

export default async function MyCompaniesPage() {
  const { user, branchId } = await requireUserWithBranch();
  const subject = subjectOf(user);
  if (!canMyCompanies(subject)) redirect("/no-access");

  const companies = await prisma.supplier.findMany({
    where: { ...branchWhere(branchId), isOwnCompany: true },
    select: { id: true, name: true, code: true, fullName: true, status: true, branchId: true, parentSupplierId: true, parent: { select: { name: true } }, _count: { select: { employees: true } }, partyLinks: { select: { partyId: true, role: true, ownershipPercent: true } } },
    orderBy: { name: "asc" },
  });
  // The side panel and the employee panel are the Suppliers tools, so they need that permission and its reference data.
  const canSuppliers = can(subject, "partners.suppliers", "view");
  const [projects, allSuppliers, lookupValues] = canSuppliers
    ? await Promise.all([
        prisma.project.findMany({ where: branchWhere(branchId), orderBy: { name: "asc" }, select: { id: true, name: true, code: true, clientId: true } }),
        prisma.supplier.findMany({ where: branchWhere(branchId), orderBy: { name: "asc" }, select: { id: true, name: true } }),
        prisma.lookupValue.findMany({ where: { ...branchWhere(branchId), isActive: true }, orderBy: [{ sortOrder: "asc" }, { value: "asc" }], select: { category: true, value: true } }),
      ])
    : [[], [], []];
  const wizardData = { projects, suppliers: allSuppliers, sponsors: allSuppliers, lookups: groupLookups(lookupValues) };
  const ids = companies.map((c) => c.id);
  const partyIds = [...new Set(companies.flatMap((c) => c.partyLinks.map((l) => l.partyId)))];
  const [typeRows, files, partyFiles] = await Promise.all([
    prisma.documentType.findMany({ where: branchWhere(branchId) }),
    ids.length ? prisma.attachment.findMany({ where: { entityType: "SUPPLIER", entityId: { in: ids } }, select: { id: true, entityId: true, docType: true, filename: true, expiryDate: true, uploadedAt: true } }) : [],
    partyIds.length ? prisma.attachment.findMany({ where: { entityType: "SUPPLIER_PARTY", entityId: { in: partyIds } }, select: { id: true, entityId: true, docType: true, filename: true, expiryDate: true, uploadedAt: true } }) : [],
  ]);
  const iso = (f: (typeof files)[number]) => ({ id: f.id, docType: f.docType, filename: f.filename, expiryDate: f.expiryDate ? f.expiryDate.toISOString() : null, uploadedAt: f.uploadedAt.toISOString() });

  // A person's document status is worked out once, whichever companies they serve.
  const partyTypesFor = (branch: string) => resolveDocTypes(typeRows.filter((r) => r.branchId === branch), "SUPPLIER_PARTY");
  const personStatus = new Map<string, ReturnType<typeof summarise>>();
  for (const c of companies) {
    for (const l of c.partyLinks) {
      if (personStatus.has(l.partyId)) continue;
      personStatus.set(l.partyId, summarise(buildChecklist(partyTypesFor(c.branchId), partyFiles.filter((f) => f.entityId === l.partyId).map(iso), false)));
    }
  }
  const add = (a: DocSummary, b: DocSummary): DocSummary => ({ missing: a.missing + b.missing, expired: a.expired + b.expired, expiring: a.expiring + b.expiring });
  const none: DocSummary = { missing: 0, expired: 0, expiring: 0 };

  const built = companies.map((c) => {
    const rows = typeRows.filter((r) => r.branchId === c.branchId);
    const own = summarise(buildChecklist(resolveDocTypes(rows, "SUPPLIER"), files.filter((f) => f.entityId === c.id).map(iso), true));
    const people = [...new Set(c.partyLinks.map((l) => l.partyId))];
    const owners = people.reduce((acc, id) => add(acc, personStatus.get(id) ?? none), none);
    const ownership = ownershipSummary(c.partyLinks.filter((l) => l.role === OWNER_ROLE).map((l) => l.ownershipPercent));
    return { c, own, owners, people: people.length, ownership };
  });

  // A parent, then its subsidiaries just beneath it.
  const known = new Set(companies.map((c) => c.id));
  const toRow = (x: (typeof built)[number], sub: boolean): CompanyRow => ({ branchId: x.c.branchId, parentId: sub ? x.c.parentSupplierId : null, parentName: x.c.parent?.name ?? null, id: x.c.id, name: x.c.name, code: x.c.code, fullName: x.c.fullName, status: x.c.status, employees: x.c._count.employees, people: x.people, own: x.own, owners: x.owners, ownership: { owners: x.ownership.owners, total: x.ownership.total, ok: x.ownership.ok }, sub });
  const rows: CompanyRow[] = built
    .filter((x) => !x.c.parentSupplierId || !known.has(x.c.parentSupplierId))
    .flatMap((x) => [toRow(x, false), ...built.filter((y) => y.c.parentSupplierId === x.c.id).map((y) => toRow(y, true))]);

  // Tiles count each person once, even when they serve several companies.
  const people = [...personStatus.values()].reduce(add, none);
  const totals = { missing: built.reduce((n, x) => n + x.own.missing, 0) + people.missing, expired: built.reduce((n, x) => n + x.own.expired, 0) + people.expired, expiring: built.reduce((n, x) => n + x.own.expiring, 0) + people.expiring, employees: rows.reduce((n, r) => n + r.employees, 0) };

  // People on file with the same name: usually one person entered twice. Only those who may merge (and open personal documents) see this.
  let dupGroups: DupPerson[][] = [];
  if (canMyCompanies(subject, "edit") && canViewSensitive(subject)) {
    const everyone = await prisma.supplierParty.findMany({
      where: branchWhere(branchId),
      select: { id: true, name: true, links: { select: { role: true, supplier: { select: { name: true } } } } },
    });
    const counts = everyone.length
      ? await prisma.attachment.groupBy({ by: ["entityId"], where: { entityType: "SUPPLIER_PARTY", entityId: { in: everyone.map((p) => p.id) } }, _count: true })
      : [];
    const docs = new Map(counts.map((c) => [c.entityId, c._count]));
    dupGroups = duplicateGroups(everyone).map((g) => g.map((p) => ({
      id: p.id, name: p.name, docs: docs.get(p.id) ?? 0,
      where: p.links.slice(0, 3).map((l) => `${PARTY_ROLE_LABEL[l.role] ?? l.role} of ${l.supplier.name}`).join(", "),
    })));
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="My Companies"
        icon={Landmark}
        meta={<CountPill>{rows.length}</CountPill>}
        description="The companies you own: their documents, owners and sponsors, logo and bank details. Third-party suppliers stay under Business Partners."
        actions={
          canMyCompanies(subject, "create") ? (
            <Button href="/my-companies/new" size="sm">
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Add company
            </Button>
          ) : undefined
        }
      />
      {rows.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile label="Companies" value={rows.length} icon={Landmark} hint={`${rows.filter((r) => r.sub).length} subsidiaries`} />
          <StatTile label="Employees" value={totals.employees} icon={Users} hint="across your companies" />
          <StatTile label="Missing or expired" value={totals.missing + totals.expired} icon={FileWarning} tone={totals.missing + totals.expired > 0 ? "warning" : "default"} hint={totals.missing + totals.expired === 0 ? "nothing outstanding" : `${totals.missing} missing · ${totals.expired} expired`} />
          <StatTile label="Expiring soon" value={totals.expiring} icon={Clock} tone={totals.expiring > 0 ? "warning" : "default"} hint="inside their reminder window" />
        </div>
      )}
      {dupGroups.length > 0 && <DuplicatePeople groups={dupGroups} />}
      {rows.length === 0 ? (
        <EmptyState
          icon={Landmark}
          title="No own companies yet"
          description="Add the companies you own to keep their documents, owners and sponsors together. You can also tick “Own company” on an existing supplier's Company tab and it will appear here."
          action={canMyCompanies(subject, "create") ? <Button href="/my-companies/new" size="sm">Add company</Button> : undefined}
        />
      ) : (
        <CompanyTable rows={rows} canSuppliers={canSuppliers} wizardData={wizardData} />
      )}
    </div>
  );
}
