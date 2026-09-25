import Link from "next/link";
import { ListChecks } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { DemandRequestList } from "./demand-request-list";
import { KanbanBoard } from "@/components/KanbanBoard";
import { ProgressBar } from "@/components/ProgressBar";
import { ViewToggle } from "@/components/ViewToggle";

function ageInDays(d: Date) {
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86_400_000));
}

export default async function DemandRequestsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const view = (await searchParams).view === "board" ? "board" : "list";
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
        <div className="flex items-center gap-3">
          <ViewToggle base="/demand" view={view} />
          <Link href="/demand/new" className="btn btn-primary">
            + New Request
          </Link>
        </div>
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
      ) : view === "board" ? (
        <KanbanBoard
          weightLabel="workers"
          emptyText="No requests at this stage"
          columns={[
            { id: "review", title: "Awaiting approval", tone: "amber", hint: "Client hasn't confirmed quantities yet" },
            { id: "allocating", title: "Allocating workers", tone: "blue", hint: "Approved, still short of people" },
            { id: "ready", title: "Fully allocated", tone: "green", hint: "Ready to mobilise" },
            { id: "closed", title: "Closed", tone: "slate" },
            { id: "rejected", title: "Rejected", tone: "red" },
          ]}
          cards={requests.map((r) => {
            const requested = r.trades.reduce((n, t) => n + t.quantity, 0);
            const decided = r.trades.some((t) => t.approvedQuantity !== null);
            const target = decided ? r.trades.reduce((n, t) => n + (t.approvedQuantity ?? 0), 0) : requested;
            const allocated = r.trades.reduce((n, t) => n + t._count.allocations, 0);
            const stage = r.status === "Rejected" ? "rejected" : r.status === "Closed" ? "closed" : r.status === "Open" ? "review" : allocated >= target && target > 0 ? "ready" : "allocating";
            const age = ageInDays(r.createdAt);
            return {
              id: r.id,
              columnId: stage,
              weight: requested,
              content: (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <Link href={`/demand/${r.id}`} className="text-sm font-medium text-primary hover:underline">#{r.requestNo}</Link>
                    <span className="flex items-center gap-1.5 text-xs text-subtle">
                      {r.priority === "High" && <span className="rounded bg-[var(--error-soft)] px-1 text-[10px] font-medium text-[var(--error)]">HIGH</span>}
                      {age === 0 ? "Today" : `${age}d`}
                    </span>
                  </div>
                  <p className="truncate text-sm text-secondary">{r.client.name}</p>
                  <p className="truncate text-xs text-muted">{r.project.name}</p>
                  <p className="truncate text-xs text-secondary">{r.trades.map((t) => `${t.quantity} ${t.trade}`).join(" · ")}</p>
                  {target > 0 && stage !== "review" && stage !== "rejected" && <ProgressBar value={allocated} total={target} label={`${allocated}/${target}`} />}
                  {r.supplierOffers.length > 0 && <p className="text-[11px] text-subtle">{r.supplierOffers.length} offer{r.supplierOffers.length > 1 ? "s" : ""} sent · {r.supplierOffers.filter((o) => o.status === "ACCEPTED").length} accepted</p>}
                </div>
              ),
            };
          })}
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
