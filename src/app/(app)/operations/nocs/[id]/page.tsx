import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { Badge } from "@/components/Badge";
import { DeleteButton } from "@/components/DeleteButton";
import { deleteNocAction } from "../actions";

export default async function NocDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { branchId, isSuperAdmin } = await requireUserWithBranch();

  const noc = await prisma.noc.findUnique({
    where: { id },
    include: {
      template: true,
      demandRequest: { include: { client: true, project: true } },
      employees: { include: { employee: true } },
    },
  });
  if (!noc || isOutsideBranch(noc.branchId, branchId, isSuperAdmin)) notFound();

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link href="/operations/nocs" className="text-sm text-slate-500 hover:underline">
          ← NOCs
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold text-slate-900">NOC-{noc.docNo}</h1>
          <div className="flex items-center gap-2">
            <a
              href={`/api/nocs/${noc.id}`}
              className="rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--brand-primary-hover)]"
            >
              Download PDF
            </a>
            <DeleteButton
              action={deleteNocAction}
              hiddenFields={{ nocId: noc.id }}
              confirmMessage={`Delete NOC-${noc.docNo}?`}
              label="Delete"
              className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
            />
          </div>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          {noc.demandRequest.client.name} — {noc.demandRequest.project.name}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 rounded-3xl border border-slate-200 bg-white p-5 sm:grid-cols-2">
        <div>
          <span className="block text-xs font-medium text-slate-500">Template</span>
          <span className="text-sm text-slate-900">{noc.template.name}</span>
        </div>
        <div>
          <span className="block text-xs font-medium text-slate-500">Status</span>
          <Badge color={noc.status === "Mobilization Complete" ? "green" : "amber"}>{noc.status}</Badge>
        </div>
        <div>
          <span className="block text-xs font-medium text-slate-500">Mobilize Date</span>
          <span className="text-sm text-slate-900">
            {noc.mobilizeDate ? noc.mobilizeDate.toLocaleDateString("en-GB") : "—"}
          </span>
        </div>
        <div>
          <span className="block text-xs font-medium text-slate-500">Requested</span>
          <span className="text-sm text-slate-900">{noc.createdAt.toLocaleDateString("en-GB")}</span>
        </div>
        {noc.remarks && (
          <div className="sm:col-span-2">
            <span className="block text-xs font-medium text-slate-500">Remarks</span>
            <span className="text-sm text-slate-900">{noc.remarks}</span>
          </div>
        )}
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Employees ({noc.employees.length})</h2>
        <ul className="space-y-1">
          {noc.employees.map((ne) => (
            <li key={ne.id} className="text-sm text-slate-900">
              {ne.employee.name} <span className="text-slate-400">{ne.employee.employeeIdNo}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
