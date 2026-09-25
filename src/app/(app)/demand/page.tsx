import Link from "next/link";
import { ListChecks } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { DemandRequestList } from "./demand-request-list";

function ageInDays(d: Date) {
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86_400_000));
}

export default async function DemandRequestsPage() {
  const { branchId } = await requireUserWithBranch();
  const requests = await prisma.demandRequest.findMany({
    where: branchWhere(branchId),
    include: {
      client: true,
      project: true,
      trades: { select: { trade: true, quantity: true, approvedQuantity: true, _count: { select: { allocations: true } } } },
      supplierOffers: { select: { status: true } },
      _count: { select: { nocs: true } },
    },
    orderBy: { requestNo: "desc" },
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl tracking-tight text-primary font-semibold">Demand Requests</h1>
          <p className="mt-1 text-sm text-muted">
            Staffing requests raised against a client project, tracked through allocation.
          </p>
        </div>
        <Link
          href="/demand/new"
          className="btn btn-primary"
        >
          + New Request
        </Link>
      </div>

      {requests.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="No demand requests yet"
          description="A demand request captures how many workers of each trade a project needs, then tracks allocation against it."
          action={
            <Link href="/demand/new" className="btn btn-primary btn-sm">New demand request</Link>
          }
        />
      ) : (
        <DemandRequestList
          requests={requests.map((r) => ({
            id: r.id,
            requestNo: r.requestNo,
            clientName: r.client.name,
            projectName: r.project.name,
            status: r.status,
            requestType: r.requestType,
            priority: r.priority,
            createdAt: r.createdAt.toISOString(),
            ageDays: ageInDays(r.createdAt),
            trades: r.trades.map((t) => ({ trade: t.trade, quantity: t.quantity })),
            requested: r.trades.reduce((n, t) => n + t.quantity, 0),
            approved: r.trades.some((t) => t.approvedQuantity !== null)
              ? r.trades.reduce((n, t) => n + (t.approvedQuantity ?? 0), 0)
              : null,
            allocated: r.trades.reduce((n, t) => n + t._count.allocations, 0),
            offersSent: r.supplierOffers.length,
            offersAccepted: r.supplierOffers.filter((o) => o.status === "ACCEPTED").length,
            offersDeclined: r.supplierOffers.filter((o) => o.status === "DECLINED").length,
            nocs: r._count.nocs,
          }))}
        />
      )}
    </div>
  );
}
