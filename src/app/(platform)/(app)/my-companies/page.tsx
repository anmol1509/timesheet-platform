import { redirect } from "next/navigation";
import { Landmark, Users, FileWarning, Clock } from "lucide-react";
import { PageHeader, CountPill } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { StatTile } from "@/components/StatTile";
import { prisma } from "@/lib/db";
import { requireUserWithBranch, subjectOf } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { canMyCompanies } from "@/lib/permissions";
import { buildChecklist, resolveDocTypes, type ChecklistItem } from "@/lib/documentTypes";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { CompanyTable, type CompanyRow } from "./company-table";

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
    select: { id: true, name: true, code: true, fullName: true, status: true, branchId: true, parentSupplierId: true, _count: { select: { employees: true } }, parties: { select: { id: true } } },
    orderBy: { name: "asc" },
  });
  const ids = companies.map((c) => c.id);
  const partyIds = companies.flatMap((c) => c.parties.map((p) => p.id));
  const [typeRows, files, partyFiles] = await Promise.all([
    prisma.documentType.findMany({ where: branchWhere(branchId) }),
    ids.length ? prisma.attachment.findMany({ where: { entityType: "SUPPLIER", entityId: { in: ids } }, select: { id: true, entityId: true, docType: true, filename: true, expiryDate: true, uploadedAt: true } }) : [],
    partyIds.length ? prisma.attachment.findMany({ where: { entityType: "SUPPLIER_PARTY", entityId: { in: partyIds } }, select: { id: true, entityId: true, docType: true, filename: true, expiryDate: true, uploadedAt: true } }) : [],
  ]);
  const iso = (f: (typeof files)[number]) => ({ id: f.id, docType: f.docType, filename: f.filename, expiryDate: f.expiryDate ? f.expiryDate.toISOString() : null, uploadedAt: f.uploadedAt.toISOString() });

  const built = companies.map((c) => {
    const rows = typeRows.filter((r) => r.branchId === c.branchId);
    const own = summarise(buildChecklist(resolveDocTypes(rows, "SUPPLIER"), files.filter((f) => f.entityId === c.id).map(iso), true));
    const partyTypes = resolveDocTypes(rows, "SUPPLIER_PARTY");
    const owners = c.parties.reduce(
      (acc, p) => {
        const s = summarise(buildChecklist(partyTypes, partyFiles.filter((f) => f.entityId === p.id).map(iso), false));
        return { missing: acc.missing + s.missing, expired: acc.expired + s.expired, expiring: acc.expiring + s.expiring };
      },
      { missing: 0, expired: 0, expiring: 0 },
    );
    return { c, own, owners };
  });

  // A parent, then its subsidiaries just beneath it.
  const known = new Set(companies.map((c) => c.id));
  const toRow = (x: (typeof built)[number], sub: boolean): CompanyRow => ({ id: x.c.id, name: x.c.name, code: x.c.code, fullName: x.c.fullName, status: x.c.status, employees: x.c._count.employees, people: x.c.parties.length, own: x.own, owners: x.owners, sub });
  const rows: CompanyRow[] = built
    .filter((x) => !x.c.parentSupplierId || !known.has(x.c.parentSupplierId))
    .flatMap((x) => [toRow(x, false), ...built.filter((y) => y.c.parentSupplierId === x.c.id).map((y) => toRow(y, true))]);

  const totals = rows.reduce((t, r) => ({ missing: t.missing + r.own.missing + r.owners.missing, expired: t.expired + r.own.expired + r.owners.expired, expiring: t.expiring + r.own.expiring + r.owners.expiring, employees: t.employees + r.employees }), { missing: 0, expired: 0, expiring: 0, employees: 0 });

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
      {rows.length === 0 ? (
        <EmptyState
          icon={Landmark}
          title="No own companies yet"
          description="Add the companies you own to keep their documents, owners and sponsors together. You can also tick “Own company” on an existing supplier's Company tab and it will appear here."
          action={canMyCompanies(subject, "create") ? <Button href="/my-companies/new" size="sm">Add company</Button> : undefined}
        />
      ) : (
        <CompanyTable rows={rows} />
      )}
    </div>
  );
}
