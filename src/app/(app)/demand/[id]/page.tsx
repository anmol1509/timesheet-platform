import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUserWithBranch, subjectOf } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { SupplierOffers } from "./supplier-offers";
import { isOutsideBranch } from "@/lib/branch";
import { DeleteButton } from "@/components/DeleteButton";
import { RequestDetailsForm } from "./request-details-form";
import { TradeAllocationSection } from "./trade-allocation-section";
import { getIdleWorkers, supplyForTrade } from "@/lib/demandSupply";
import { deleteDemandRequestAction } from "../actions";

export default async function DemandRequestDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();

  const request = await prisma.demandRequest.findUnique({
    where: { id },
    include: {
      client: true,
      project: true,
      trades: { include: { allocations: { include: { employee: true } } } },
      supplierOffers: { include: { supplier: { select: { name: true } }, lines: true }, orderBy: { sentAt: "desc" } },
    },
  });
  if (!request || isOutsideBranch(request.branchId, branchId, isSuperAdmin)) notFound();

  // Shared with the mobilisation screen so both agree on what "idle" means.
  const idleWorkers = await getIdleWorkers(branchId);
  const offered = new Set(request.supplierOffers.map((o) => o.supplierId));
  const portalSuppliers = await prisma.supplier.findMany({
    where: { branchId: request.branchId, portalEnabled: true, status: "ACTIVE" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const tradeName = new Map(request.trades.map((t) => [t.id, t]));
  const day = (d: Date) => d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });


  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <Link href="/demand" className="text-sm text-muted hover:underline">
          ← Demand Requests
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl tracking-tight text-primary font-semibold">
            Request #{request.requestNo} — {request.client.name}
          </h1>
          <div className="flex items-center gap-2">
            <Link
              href={`/operations/nocs/new?demandRequestId=${request.id}`}
              className="btn btn-primary px-3"
            >
              Create NOC
            </Link>
            <DeleteButton
              action={deleteDemandRequestAction}
              hiddenFields={{ requestId: request.id }}
              confirmMessage={`Delete request #${request.requestNo}?`}
              label="Delete Request"
              className="rounded-lg border border-[var(--error-border)] px-3 py-2 text-sm font-medium text-[var(--error)] hover:bg-[var(--error-soft)]"
            />
          </div>
        </div>
        <p className="mt-1 text-sm text-muted">
          {request.project.code} — {request.project.name}
        </p>
      </div>

      {error && (
        <p className="rounded-lg border border-[var(--error-border)] bg-[var(--error-soft)] px-4 py-2 text-sm text-[var(--error)]">{error}</p>
      )}

      <RequestDetailsForm
        request={{
          id: request.id,
          remarks: request.remarks,
        }}
      />

      <SupplierOffers
        demandId={request.id}
        canEdit={can(subjectOf(user), "demand", "edit")}
        available={portalSuppliers.filter((s) => !offered.has(s.id))}
        offers={request.supplierOffers.map((o) => ({
          id: o.id, supplier: o.supplier.name, status: o.status, note: o.note, sentAt: day(o.sentAt), respondedAt: o.respondedAt ? day(o.respondedAt) : null,
          lines: o.lines.map((l) => ({ trade: tradeName.get(l.demandRequestTradeId)?.trade ?? "Trade", requested: tradeName.get(l.demandRequestTradeId)?.quantity ?? 0, quantity: l.quantity, rate: l.rate ? Number(l.rate) : null })),
        }))}
      />

      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-primary">Trades</h2>
        {request.trades.map((t) => (
          <TradeAllocationSection
            key={t.id}
            supply={supplyForTrade(idleWorkers, t.trade)}
            trade={{
              id: t.id,
              trade: t.trade,
              approvedQuantity: t.approvedQuantity,
              quantity: t.quantity,
              shift: t.shift,
              rate: t.rate,
              allocations: t.allocations.map((a) => ({
                id: a.id,
                employeeId: a.employeeId,
                employeeName: a.employee.name,
                employeeIdNo: a.employee.employeeIdNo,
              })),
            }}
          />
        ))}
      </div>
    </div>
  );
}
