import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { templateHtml } from "@/lib/letterHtml";
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
      branch: true,
      nocs: { orderBy: { docNo: "desc" }, select: { id: true, docNo: true, status: true, createdAt: true, _count: { select: { employees: true } } } },
      trades: {
        include: {
          allocations: {
            include: {
              employee: {
                select: {
                  id: true, name: true, employeeIdNo: true, trade: true, nationality: true, passportNumber: true, emiratesId: true, visaStatus: true,
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
    where: { branchId: demand.branchId },
    orderBy: { name: "asc" },
  });

  // The same worker can be allocated to more than one trade line.
  const seen = new Set<string>();
  const workers = demand.trades.flatMap((t) => t.allocations.map((a) => a.employee)).filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true)));

  // NOCs are issued by each worker's visa sponsor (their own company when none is set), on that
  // sponsor's letterhead, so the screen needs to know which sponsors have one and what margins to use.
  const issuerIds = [...new Set(workers.map((w) => w.sponsorSupplierId ?? w.supplierId).filter((x): x is string => !!x))];
  const [letterheads, issuers] = await Promise.all([
    issuerIds.length
      ? prisma.attachment.findMany({ where: { entityType: "SUPPLIER", entityId: { in: issuerIds }, docType: "LETTERHEAD" }, select: { entityId: true }, distinct: ["entityId"] })
      : [],
    issuerIds.length
      ? prisma.supplier.findMany({ where: { id: { in: issuerIds } }, select: { id: true, name: true, fullName: true, contactPerson: true, contactPhone: true, contactEmail: true, letterheadTopMm: true, letterheadBottomMm: true } })
      : [],
  ]);
  const hasLetterhead = new Set(letterheads.map((l) => l.entityId));
  const issuerInfo = Object.fromEntries(
    issuers.map((s) => [
      s.id,
      {
        name: s.fullName || s.name,
        hasLetterhead: hasLetterhead.has(s.id),
        contactPerson: s.contactPerson,
        contactPhone: s.contactPhone,
        contactEmail: s.contactEmail,
        topMm: s.letterheadTopMm ?? 65,
        bottomMm: s.letterheadBottomMm ?? 35,
      },
    ])
  );

  const b = demand.branch;
  const asOption = (t: (typeof templates)[number]) => ({ id: t.id, name: t.name, title: t.title || t.category || t.name, html: templateHtml(t) });

  return (
    <div className="space-y-5">
      <div>
        <Link href={`/demand/${demand.id}`} className="text-sm text-muted hover:underline">
          ← Request #{demand.requestNo}
        </Link>
        <h1 className="mt-2 text-xl font-semibold tracking-tight text-primary">Mobilisation documents</h1>
        <p className="mt-1 text-sm text-muted">
          {demand.client.name} — {demand.project.name}
        </p>
      </div>

      <DocumentTabs
        demand={{ id: demand.id, requestNo: demand.requestNo, clientName: demand.client.name, clientAddress: demand.client.billingAddress, projectName: demand.project.name, branchName: b.name }}
        workers={workers.map((w) => ({
          id: w.id, name: w.name, employeeIdNo: w.employeeIdNo, trade: w.trade, nationality: w.nationality, passportNumber: w.passportNumber, emiratesId: w.emiratesId, visaStatus: w.visaStatus,
          supplierId: w.supplierId, sponsorSupplierId: w.sponsorSupplierId,
          supplierName: w.supplier?.fullName || w.supplier?.name || null,
        }))}
        nocTemplates={templates.filter((t) => t.category === "No Objection Letter").map(asOption)}
        undertakingTemplates={templates.filter((t) => t.category === "Undertaking Letter" || t.category === "Supplier Undertaking").map(asOption)}
        nocs={demand.nocs.map((n) => ({ id: n.id, docNo: n.docNo, status: n.status, createdAt: n.createdAt.toISOString(), workers: n._count.employees }))}
        sponsors={issuerInfo}
        company={{
          name: b.name,
          letterheadUrl: b.letterheadImageId ? `/api/images/${b.letterheadImageId}` : null,
          topMm: b.letterheadTopMm,
          bottomMm: b.letterheadBottomMm,
          signatoryName: b.signatoryName ?? "",
          signatoryTitle: b.signatoryTitle ?? "",
          signatureUrl: b.signatureId ? `/api/images/${b.signatureId}` : null,
          stampUrl: b.stampId ? `/api/images/${b.stampId}` : null,
          phone: b.phone,
          email: b.email,
        }}
      />
    </div>
  );
}
