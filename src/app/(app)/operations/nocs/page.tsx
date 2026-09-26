import { PageHeader } from "@/components/PageHeader";
import Link from "next/link";
import { FileText, Plus } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { NocList } from "./noc-list";

function daysUntil(d: Date) {
  return Math.ceil((d.getTime() - Date.now()) / 86_400_000);
}

export default async function NocsPage() {
  const { branchId } = await requireUserWithBranch();
  const nocs = await prisma.noc.findMany({
    where: branchWhere(branchId),
    include: {
      demandRequest: { include: { client: true, project: true, trades: { select: { _count: { select: { allocations: true } } } } } },
      template: true,
      _count: { select: { employees: true } },
      employees: { take: 3, select: { employee: { select: { name: true } } } },
    },
    orderBy: { docNo: "desc" },
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageHeader
          title="NOCs"
          icon={FileText}
          description={<>No-objection and mobilization letters generated from Demand Requests.</>}
        />
        <Link
          href="/operations/nocs/new"
          className="btn btn-primary"
        >
          <Plus className="h-4 w-4" aria-hidden />

          New NOC
        </Link>
      </div>

      {nocs.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No NOCs yet"
          description="Generate No Objection Certificates and other letters for employees from your saved letter templates."
          action={
            <Link href="/operations/nocs/new" className="btn btn-primary btn-sm">New NOC</Link>
          }
        />
      ) : (
        <NocList
          nocs={nocs.map((n) => ({
            id: n.id,
            docNo: n.docNo,
            clientName: n.demandRequest.client.name,
            projectName: n.demandRequest.project.name,
            templateName: n.template.name,
            status: n.status,
            mobilizeDate: n.mobilizeDate ? n.mobilizeDate.toLocaleDateString("en-GB") : null,
            mobilizeInDays: n.mobilizeDate ? daysUntil(n.mobilizeDate) : null,
            demandNo: n.demandRequest.requestNo,
            demandId: n.demandRequestId,
            workers: n._count.employees,
            workerNames: n.employees.map((e) => e.employee.name),
            allocated: n.demandRequest.trades.reduce((sum, t) => sum + t._count.allocations, 0),
          }))}
        />
      )}
    </div>
  );
}
