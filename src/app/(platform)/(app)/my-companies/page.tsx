import Link from "next/link";
import { redirect } from "next/navigation";
import { Landmark, Users, UserRound } from "lucide-react";
import { PageHeader, CountPill } from "@/components/PageHeader";
import { Badge } from "@/components/Badge";
import { prisma } from "@/lib/db";
import { requireUserWithBranch, subjectOf } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { canMyCompanies } from "@/lib/permissions";
import { buildChecklist, resolveDocTypes, type ChecklistItem } from "@/lib/documentTypes";
import { AddCompanyForm } from "./add-company-form";

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
    select: { id: true, name: true, code: true, fullName: true, status: true, trn: true, branchId: true, parentSupplierId: true, _count: { select: { employees: true } }, parties: { select: { id: true, role: true, name: true } } },
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

  const cards = companies.map((c) => {
    const rows = typeRows.filter((r) => r.branchId === c.branchId);
    const own = summarise(buildChecklist(resolveDocTypes(rows, "SUPPLIER"), files.filter((f) => f.entityId === c.id).map(iso), true));
    const partyTypes = resolveDocTypes(rows, "SUPPLIER_PARTY");
    const people = c.parties.reduce(
      (acc, p) => {
        const s = summarise(buildChecklist(partyTypes, partyFiles.filter((f) => f.entityId === p.id).map(iso), false));
        return { missing: acc.missing + s.missing, expired: acc.expired + s.expired, expiring: acc.expiring + s.expiring };
      },
      { missing: 0, expired: 0, expiring: 0 },
    );
    return { c, own, people };
  });
  const top = cards.filter((x) => !x.c.parentSupplierId || !cards.some((y) => y.c.id === x.c.parentSupplierId));
  const subsOf = (id: string) => cards.filter((x) => x.c.parentSupplierId === id);

  const chips = (s: { missing: number; expired: number; expiring: number }, what: string) =>
    s.missing + s.expired + s.expiring === 0 ? (
      <Badge color="green">{what}: in order</Badge>
    ) : (
      <>
        {s.missing > 0 && <Badge color="red">{what}: {s.missing} missing</Badge>}
        {s.expired > 0 && <Badge color="red">{what}: {s.expired} expired</Badge>}
        {s.expiring > 0 && <Badge color="amber">{what}: {s.expiring} expiring</Badge>}
      </>
    );

  const card = (x: (typeof cards)[number], nested = false) => (
    <div key={x.c.id} className={nested ? "rounded-xl border border-default p-3" : "card p-4"}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <Link href={`/suppliers/${x.c.id}`} className="text-base font-semibold text-primary hover:underline">{x.c.name}</Link>
          {x.c.code && <span className="tabular ml-2 rounded-md bg-surface-sunken px-1.5 py-0.5 text-xs font-medium text-secondary">{x.c.code}</span>}
          {x.c.fullName && x.c.fullName !== x.c.name && <p className="truncate text-xs text-muted">{x.c.fullName}</p>}
        </div>
        <Badge color={x.c.status === "ACTIVE" ? "green" : "red"}>{x.c.status}</Badge>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" aria-hidden />{x.c._count.employees} employee{x.c._count.employees === 1 ? "" : "s"}</span>
        <span className="inline-flex items-center gap-1"><UserRound className="h-3.5 w-3.5" aria-hidden />{x.c.parties.length} owner{x.c.parties.length === 1 ? "" : "s"} &amp; sponsor{x.c.parties.length === 1 ? "" : "s"}</span>
        {x.c.trn && <span className="tabular">TRN {x.c.trn}</span>}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {chips(x.own, "Company documents")}
        {x.c.parties.length > 0 && chips(x.people, "Owners & sponsors")}
      </div>
      {!nested && subsOf(x.c.id).length > 0 && (
        <div className="mt-3 space-y-2 border-t border-default pt-3">
          <p className="text-xs font-medium text-muted">Subsidiaries</p>
          {subsOf(x.c.id).map((s) => card(s, true))}
        </div>
      )}
    </div>
  );

  return (
    <div className="max-w-4xl space-y-5">
      <PageHeader
        title="My Companies"
        icon={Landmark}
        meta={<CountPill>{companies.length}</CountPill>}
        description="The companies you own: their documents, owners and sponsors, and bank details. Third-party suppliers stay under Business Partners."
      />
      {canMyCompanies(subject, "create") && <AddCompanyForm />}
      {top.length === 0 ? (
        <p className="empty-state text-sm text-muted">
          No own companies yet. Add one above, or tick &ldquo;Own company&rdquo; on an existing supplier&rsquo;s Company tab and it will appear here.
        </p>
      ) : (
        <div className="space-y-3">{top.map((x) => card(x))}</div>
      )}
    </div>
  );
}
