import Link from "next/link";
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
    <div className="max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">NOCs</h1>
          <p className="mt-1 text-sm text-slate-500">
            No-objection and mobilization letters generated from Demand Requests.
          </p>
        </div>
        <Link
          href="/operations/nocs/new"
          className="rounded-lg bg-[#166534] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#166534]/90"
        >
          + New NOC
        </Link>
      </div>

      {nocs.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center text-sm text-slate-500">
          No NOCs yet.
        </p>
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
