import { HeroHeader, heroButton } from "@/components/HeroHeader";
import Link from "next/link";
import { FileText, Plus } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { NocList } from "./noc-list";

export const metadata = { title: "NOCs" };

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
      <HeroHeader
        icon={FileText}
        title="NOCs"
        subtitle="No-objection and mobilization letters, made from a client's demand request."
        pills={nocs.length === 0 ? [] : [
          { label: "Total", value: String(nocs.length) },
          { label: "Pending", value: String(nocs.filter((n) => n.status !== "Mobilization Complete").length), warn: nocs.filter((n) => n.status !== "Mobilization Complete").length > 0 },
          { label: "Mobilization complete", value: String(nocs.filter((n) => n.status === "Mobilization Complete").length) },
          { label: "Workers covered", value: String(nocs.reduce((n, x) => n + x._count.employees, 0)) },
        ]}
        actions={<Link href="/operations/nocs/new" className={heroButton(true)}><Plus className="h-4 w-4" aria-hidden /> New NOC</Link>}
      />

      {nocs.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No NOCs yet"
          description="A NOC is made from a client's demand request: pick the demand, the workers and the wording, and the letter is numbered and saved here."
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
