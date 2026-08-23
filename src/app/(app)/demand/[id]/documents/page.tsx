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
                  supplier: { select: { name: true, fullName: true } },
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

  // Which companies these letters will be issued by, and which of them have no
  // blank letterhead on file. Worked out here rather than left to the download,
  // so nobody prints a stack of letters before noticing one came out plain.
  const issuerIds = [...new Set(workers.map((w) => w.supplierId).filter((x): x is string => !!x))];
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
    const w = workers.find((x) => x.supplierId === sid)!;
    return {
      name: w.supplier?.fullName || w.supplier?.name || "Unnamed company",
      hasLetterhead: withLetterhead.has(sid),
    };
  });
  if (workers.some((w) => !w.supplierId)) {
    issuers.push({ name: "Workers with no company set", hasLetterhead: false });
  }

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
      />
    </div>
  );
}
