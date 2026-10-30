import { redirect } from "next/navigation";
import { Building2, Clock, FileWarning, UsersRound } from "lucide-react";
import { PageHeader, CountPill } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { StatTile } from "@/components/StatTile";
import { prisma } from "@/lib/db";
import { requireUserWithBranch, subjectOf } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { canMyCompanies } from "@/lib/permissions";
import { buildChecklist, resolveDocTypes } from "@/lib/documentTypes";
import { PeopleList, type PersonRow, type PersonStatus } from "./people-list";

export const metadata = { title: "Owners & sponsors" };

export default async function PeopleRegisterPage() {
  const { user, branchId } = await requireUserWithBranch();
  if (!canMyCompanies(subjectOf(user))) redirect("/no-access");

  const people = await prisma.supplierParty.findMany({
    where: { ...branchWhere(branchId), links: { some: {} } },
    select: {
      id: true,
      name: true,
      nationality: true,
      phone: true,
      branchId: true,
      links: { select: { role: true, ownershipPercent: true, supplier: { select: { id: true, name: true, isOwnCompany: true } } }, orderBy: { createdAt: "asc" } },
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

  const rows: PersonRow[] = people.map((p) => {
    const mine = files.filter((f) => f.entityId === p.id).map((f) => ({ id: f.id, docType: f.docType, filename: f.filename, expiryDate: f.expiryDate ? f.expiryDate.toISOString() : null, uploadedAt: f.uploadedAt.toISOString() }));
    const items = buildChecklist(resolveDocTypes(typeRows.filter((r) => r.branchId === p.branchId), "SUPPLIER_PARTY"), mine, false);
    const expired = items.filter((i) => i.state === "expired").length;
    const expiring = items.filter((i) => i.state === "expiring").length;
    const missing = items.filter((i) => i.state === "missing" && i.required).length;
    // A document that should carry an expiry but has none recorded can never be reminded about.
    const noExpiry = items.filter((i) => i.state === "uploaded" && i.type.hasExpiry).length;
    const nextDays = items.reduce<number | null>((min, i) => (i.daysLeft !== null && (min === null || i.daysLeft < min) ? i.daysLeft : min), null);
    const status: PersonStatus = mine.length === 0 ? "none" : expired > 0 ? "expired" : expiring > 0 ? "expiring" : missing > 0 ? "missing" : noExpiry > 0 ? "noexpiry" : "ok";
    return {
      id: p.id,
      name: p.name,
      nationality: p.nationality,
      phone: p.phone,
      companies: p.links.map((l) => ({ id: l.supplier.id, name: l.supplier.name, role: l.role, percent: l.ownershipPercent })),
      companyCount: new Set(p.links.map((l) => l.supplier.id)).size,
      docs: mine.length,
      status,
      expired,
      expiring,
      missing,
      noExpiry,
      nextDays,
    };
  });

  const count = (s: PersonStatus) => rows.filter((r) => r.status === s).length;
  const withGaps = rows.filter((r) => r.status !== "ok").length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Owners & sponsors"
        icon={UsersRound}
        meta={<CountPill>{rows.length}</CountPill>}
        description="Everyone who owns, sponsors, partners or manages one of your companies, once each, with how many companies they are linked to and whether their documents are on file and in date."
      />
      {rows.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile label="People" value={rows.length} icon={UsersRound} hint={`${rows.filter((r) => r.companyCount > 1).length} serve more than one company`} />
          <StatTile label="Companies linked" value={new Set(rows.flatMap((r) => r.companies.map((c) => c.id))).size} icon={Building2} hint="with at least one owner or sponsor" />
          <StatTile label="Need attention" value={withGaps} icon={FileWarning} tone={withGaps > 0 ? "warning" : "default"} hint={`${count("none")} with no documents · ${count("noexpiry")} with no expiry`} />
          <StatTile label="Expired or expiring" value={count("expired") + count("expiring")} icon={Clock} tone={count("expired") + count("expiring") > 0 ? "warning" : "default"} hint={`${count("expired")} expired · ${count("expiring")} expiring soon`} />
        </div>
      )}
      {rows.length === 0 ? (
        <EmptyState icon={UsersRound} title="No owners or sponsors yet" description="Add an owner or sponsor from a company's page under My Companies, and they will appear here." />
      ) : (
        <PeopleList rows={rows} />
      )}
    </div>
  );
}
