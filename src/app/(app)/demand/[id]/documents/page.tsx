import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { branchWhere, isOutsideBranch } from "@/lib/branch";
import { DocumentTabs } from "./document-tabs";

export default async function DemandDocumentsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { branchId, isSuperAdmin } = await requireUserWithBranch();

  const demand = await prisma.demandRequest.findUnique({
    where: { id },
    include: {
      client: true,
      project: true,
      nocs: { orderBy: { docNo: "desc" }, select: { id: true, docNo: true, status: true } },
      trades: {
        include: {
          allocations: {
            include: {
              employee: {
                select: {
                  id: true, name: true, employeeIdNo: true, trade: true,
                  supplierId: true,
                  sponsorSupplierId: true,
                  supplier: { select: { name: true, fullName: true } },
                  sponsorSupplier: { select: { name: true, fullName: true } },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!demand || isOutsideBranch(demand.branchId, branchId, isSuperAdmin)) notFound();

  const templates = await prisma.letterTemplate.findMany({
    where: branchWhere(branchId),
    select: { id: true, name: true, category: true },
    orderBy: { name: "asc" },
  });

  const workers = demand.trades.flatMap((t) => t.allocations.map((a) => a.employee));

  // NOCs are issued by each worker's visa sponsor (their own company when none is
  // set), on that sponsor's letterhead. Worked out here rather than left to the
  // download, so nobody prints a stack of letters before noticing one came out plain.
  const issuerOf = (w: (typeof workers)[number]) => w.sponsorSupplierId ?? w.supplierId;
  const issuerIds = [...new Set(workers.map(issuerOf).filter((x): x is string => !!x))];
  const withLetterhead = new Set(
    issuerIds.length
      ? (
          await prisma.attachment.findMany({
            where: { entityType: "SUPPLIER", entityId: { in: issuerIds }, docType: "LETTERHEAD" },
            select: { entityId: true },
            distinct: ["entityId"],
          })
        ).map((a) => a.entityId)
      : []
  );
  const issuers = issuerIds.map((sid) => {
    const w = workers.find((x) => issuerOf(x) === sid)!;
    const named = w.sponsorSupplierId === sid ? w.sponsorSupplier : w.supplier;
    return { name: named?.fullName || named?.name || "Unnamed company", hasLetterhead: withLetterhead.has(sid) };
  });
  if (workers.some((w) => !issuerOf(w))) {
    issuers.push({ name: "Workers with no sponsor or company set", hasLetterhead: false });
  }

  // The undertaking is issued by our own company, on the company profile letterhead.
  const branch = await prisma.branch.findUnique({ where: { id: demand.branchId }, select: { name: true, letterheadImageId: true } });
  const undertakingIssuer = { name: branch?.name ?? "Your company", hasLetterhead: !!branch?.letterheadImageId };

  return (
    <div className="space-y-5">
      <div>
        <Link href={`/demand/${demand.id}`} className="text-sm text-muted hover:underline">
          ← Request #{demand.requestNo}
        </Link>
        <h1 className="mt-2 text-xl font-semibold tracking-tight text-primary">
          Mobilisation documents
        </h1>
        <p className="mt-1 text-sm text-muted">
          {demand.client.name} — {demand.project.name}
        </p>
      </div>

      <DocumentTabs
        demandId={demand.id}
        requestNo={demand.requestNo}
        nocs={demand.nocs}
        nocTemplates={templates.filter((t) => t.category === "No Objection Letter")}
        undertakingTemplates={templates.filter(
          (t) => t.category === "Undertaking Letter" || t.category === "Supplier Undertaking"
        )}
        workers={workers}
        issuers={issuers}
        undertakingIssuer={undertakingIssuer}
      />
    </div>
  );
}
