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
        <Link href="/operations/nocs" className="text-sm text-muted hover:underline">
          ← NOCs
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl tracking-tight text-primary font-semibold">NOC-{noc.docNo}</h1>
          <div className="flex items-center gap-2">
            {/* Two links rather than a toggle: this page has no client state,
                and the choice is made once at download time anyway. */}
            <a href={`/api/nocs/${noc.id}?letterhead=1`} className="btn btn-primary">
              Download on letterhead
            </a>
            <a href={`/api/nocs/${noc.id}`} className="btn btn-secondary">
              Download plain
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
        <p className="mt-1 text-sm text-muted">
          {noc.demandRequest.client.name} — {noc.demandRequest.project.name}
        </p>
      </div>

      <div className="card grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
        <div>
          <span className="block text-xs font-medium text-muted">Template</span>
          <span className="text-sm text-primary">{noc.template.name}</span>
        </div>
        <div>
          <span className="block text-xs font-medium text-muted">Status</span>
          <Badge color={noc.status === "Mobilization Complete" ? "green" : "amber"}>{noc.status}</Badge>
        </div>
        <div>
          <span className="block text-xs font-medium text-muted">Mobilize Date</span>
          <span className="text-sm text-primary">
            {noc.mobilizeDate ? noc.mobilizeDate.toLocaleDateString("en-GB") : "—"}
          </span>
        </div>
        <div>
          <span className="block text-xs font-medium text-muted">Requested</span>
          <span className="text-sm text-primary">{noc.createdAt.toLocaleDateString("en-GB")}</span>
        </div>
        {noc.remarks && (
          <div className="sm:col-span-2">
            <span className="block text-xs font-medium text-muted">Remarks</span>
            <span className="text-sm text-primary">{noc.remarks}</span>
          </div>
        )}
      </div>

      <div className="card p-5">
        <h2 className="mb-3 text-sm font-semibold text-primary">Employees ({noc.employees.length})</h2>
        <ul className="space-y-1">
          {noc.employees.map((ne) => (
            <li key={ne.id} className="text-sm text-primary">
              {ne.employee.name} <span className="text-subtle">{ne.employee.employeeIdNo}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
