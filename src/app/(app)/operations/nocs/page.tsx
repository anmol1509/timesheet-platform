import Link from "next/link";
import { FileText } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { NocList } from "./noc-list";

export default async function NocsPage() {
  const { branchId } = await requireUserWithBranch();
  const nocs = await prisma.noc.findMany({
    where: branchWhere(branchId),
    include: { demandRequest: { include: { client: true, project: true } }, template: true },
    orderBy: { docNo: "desc" },
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl tracking-tight text-primary font-semibold">NOCs</h1>
          <p className="mt-1 text-sm text-muted">
            No-objection and mobilization letters generated from Demand Requests.
          </p>
        </div>
        <Link
          href="/operations/nocs/new"
          className="btn btn-primary"
        >
          + New NOC
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
          }))}
        />
      )}
    </div>
  );
}
