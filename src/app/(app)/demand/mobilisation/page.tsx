import Link from "next/link";
import { HardHat } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { Badge } from "@/components/Badge";
import { EmptyState } from "@/components/EmptyState";

/**
 * Demands waiting to be staffed.
 *
 * Approved first, since those are the ones that can actually be mobilised; a
 * demand still Open is listed so it's visible, but it links through to the
 * demand itself for approval rather than pretending it's ready.
 */
export default async function MobilisationQueuePage() {
  const { branchId } = await requireUserWithBranch();

  const demands = await prisma.demandRequest.findMany({
    where: { ...branchWhere(branchId), status: { in: ["Open", "Approved"] } },
    include: {
      client: { select: { name: true } },
      project: { select: { name: true, code: true } },
      trades: { include: { _count: { select: { allocations: true } } } },
    },
    orderBy: [{ status: "asc" }, { requestNo: "desc" }],
  });

  const rows = demands.map((d) => {
    const needed = d.trades.reduce((sum, t) => sum + t.quantity, 0);
    const filled = d.trades.reduce((sum, t) => sum + t._count.allocations, 0);
    return { ...d, needed, filled };
  });

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
          description="Approved demands appear here once they're raised."
        />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[46rem] text-sm">
              <thead className="border-b border-default bg-surface-subtle text-left text-xs font-medium tracking-wide text-muted uppercase">
                <tr>
                  <th className="px-4 py-3">Request</th>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Project</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Mobilised</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {rows.map((d) => (
                  <tr key={d.id}>
                    <td className="tabular px-4 py-3 font-medium text-primary">
                      #{d.requestNo}
                    </td>
                    <td className="px-4 py-3 text-secondary">{d.client.name}</td>
                    <td className="px-4 py-3 text-secondary">
                      {d.project.code} — {d.project.name}
                    </td>
                    <td className="px-4 py-3">
                      <Badge color={d.status === "Approved" ? "green" : "slate"}>
                        {d.status}
                      </Badge>
                    </td>
                    <td className="tabular px-4 py-3 text-secondary">
                      {d.filled} / {d.needed}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <Link
                        href={`/demand/${d.id}/mobilise`}
                        className="text-xs font-medium text-blue-600 hover:underline"
                      >
                        {d.status === "Approved" ? "Mobilise" : "Review"}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
