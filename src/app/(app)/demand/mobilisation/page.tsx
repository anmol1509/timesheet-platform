import { HardHat } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { EmptyState } from "@/components/EmptyState";
import { MobilisationList } from "./mobilisation-list";

/**
 * Demands waiting to be staffed, and how far each has got.
 *
 * Fulfilment is derived from what's actually allocated rather than stored, so
 * it can't drift from the allocations it describes.
 */
export default async function MobilisationQueuePage() {
  const { branchId } = await requireUserWithBranch();

  // Everything not rejected or closed: a demand nobody has touched and one two
  // workers short both still need attention, and the list distinguishes them.
  const demands = await prisma.demandRequest.findMany({
    where: { ...branchWhere(branchId), status: { notIn: ["Rejected", "Closed"] } },
    include: {
      client: { select: { name: true } },
      project: { select: { name: true, code: true } },
      trades: {
        include: { skill: { select: { code: true } }, _count: { select: { allocations: true } } },
        orderBy: { trade: "asc" },
      },
    },
    orderBy: { requestNo: "desc" },
  });

  const rows = demands.map((d) => ({
    id: d.id,
    requestNo: d.requestNo,
    clientName: d.client.name,
    projectLabel: `${d.project.code} — ${d.project.name}`,
    needed: d.trades.reduce((sum, t) => sum + t.quantity, 0),
    filled: d.trades.reduce((sum, t) => sum + t._count.allocations, 0),
    trades: d.trades.map((t) => ({
      id: t.id,
      trade: t.trade,
      code: t.skill?.code ?? null,
      shift: t.shift,
      quantity: t.quantity,
      filled: t._count.allocations,
      approved: t.approved,
    })),
  }));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-primary">Mobilisation</h1>
        <p className="mt-1 text-sm text-muted">
          Put names against approved demands, trade by trade.
        </p>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={HardHat}
          title="Nothing to mobilise"
          description="Demands appear here once they're raised."
        />
      ) : (
        <MobilisationList rows={rows} />
      )}
    </div>
  );
}
