import Link from "next/link";
import { FileStack } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { Badge } from "@/components/Badge";
import { EmptyState } from "@/components/EmptyState";

/**
 * Pick a demand to generate paperwork for.
 *
 * Documents describe who is going where, so a demand with nobody mobilised has
 * nothing to say yet — those are listed but flagged, rather than leading to an
 * empty NOC.
 */
export default async function DemandDocumentsIndexPage() {
  const { branchId } = await requireUserWithBranch();

  const demands = await prisma.demandRequest.findMany({
    where: { ...branchWhere(branchId), status: { not: "Rejected" } },
    include: {
      client: { select: { name: true } },
      project: { select: { name: true, code: true } },
      _count: { select: { nocs: true } },
      trades: { include: { _count: { select: { allocations: true } } } },
    },
    orderBy: { requestNo: "desc" },
  });

  const rows = demands.map((d) => ({
    ...d,
    mobilised: d.trades.reduce((sum, t) => sum + t._count.allocations, 0),
  }));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-primary">Generate Doc</h1>
        <p className="mt-1 text-sm text-muted">
          NOC, undertaking and the employee document pack for a mobilised demand.
        </p>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={FileStack}
          title="No demands yet"
          description="Raise a demand and mobilise workers against it first."
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
                  <th className="px-4 py-3">Mobilised</th>
                  <th className="px-4 py-3">NOCs</th>
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
                      {d.mobilised === 0 ? (
                        <Badge color="slate">Nobody yet</Badge>
                      ) : (
                        <span className="tabular text-secondary">{d.mobilised}</span>
                      )}
                    </td>
                    <td className="tabular px-4 py-3 text-secondary">{d._count.nocs}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <Link
                        href={`/demand/${d.id}/documents`}
                        className="text-xs font-medium text-blue-600 hover:underline"
                      >
                        Generate
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
