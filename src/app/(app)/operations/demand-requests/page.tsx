import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { DemandRequestList } from "./demand-request-list";

export default async function DemandRequestsPage() {
  const { branchId } = await requireUserWithBranch();
  const requests = await prisma.demandRequest.findMany({
    where: branchWhere(branchId),
    include: { client: true, project: true },
    orderBy: { requestNo: "desc" },
  });

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Demand Requests</h1>
          <p className="mt-1 text-sm text-slate-500">
            Staffing requests raised against a client project, tracked through allocation.
          </p>
        </div>
        <Link
          href="/operations/demand-requests/new"
          className="rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--brand-primary-hover)]"
        >
          + New Request
        </Link>
      </div>

      {requests.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center text-sm text-slate-500">
          No demand requests yet.
        </p>
      ) : (
        <DemandRequestList
          requests={requests.map((r) => ({
            id: r.id,
            requestNo: r.requestNo,
            clientName: r.client.name,
            projectName: r.project.name,
            status: r.status,
            priority: r.priority,
            salesExecutive: r.salesExecutive,
          }))}
        />
      )}
    </div>
  );
}
