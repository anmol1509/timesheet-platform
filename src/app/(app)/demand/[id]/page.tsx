import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
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
  const { branchId, isSuperAdmin } = await requireUserWithBranch();

  const request = await prisma.demandRequest.findUnique({
    where: { id },
    include: {
      client: true,
      project: true,
      trades: { include: { allocations: { include: { employee: true } } } },
    },
  });
  if (!request || isOutsideBranch(request.branchId, branchId, isSuperAdmin)) notFound();

  // Shared with the mobilisation screen so both agree on what "idle" means.
  const idleWorkers = await getIdleWorkers(branchId);


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
              className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
            />
          </div>
        </div>
        <p className="mt-1 text-sm text-muted">
          {request.project.code} — {request.project.name}
        </p>
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>
      )}

      <RequestDetailsForm
        request={{
          id: request.id,
          status: request.status,
          priority: request.priority,
          salesExecutive: request.salesExecutive,
          accommodationStatus: request.accommodationStatus,
          transportationStatus: request.transportationStatus,
          remarks: request.remarks,
        }}
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
