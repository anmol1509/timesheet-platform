import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { isOutsideBranch } from "@/lib/branch";
import { DeleteButton } from "@/components/DeleteButton";
import { STAGES, statusKind } from "@/lib/onboarding";
import { CandidateForm } from "../candidate-form";
import { StageRow } from "../stage-row";
import { JoinPanel } from "../join-panel";
import { deleteCandidateAction } from "../actions";

export default async function CandidateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { branchId, isSuperAdmin } = await requireUserWithBranch();

  const candidate = await prisma.candidateOnboarding.findUnique({
    where: { id },
    include: { agency: { select: { name: true } }, project: { select: { name: true, code: true } }, assignedHr: { select: { name: true } } },
  });
  if (!candidate || isOutsideBranch(candidate.branchId, branchId, isSuperAdmin)) notFound();

  const [agencies, projects, demandRequests, hrUsers, history] = await Promise.all([
    prisma.supplier.findMany({ where: branchWhere(branchId), select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.project.findMany({ where: branchWhere(branchId), select: { id: true, name: true, code: true }, orderBy: { name: "asc" } }),
    prisma.demandRequest.findMany({
      where: branchWhere(branchId),
      select: { id: true, requestNo: true, project: { select: { name: true } } },
      orderBy: { requestNo: "desc" },
      take: 100,
    }),
    prisma.user.findMany({ where: { ...branchWhere(branchId), isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.candidateOnboardingHistory.findMany({
      where: { onboardingId: id },
      orderBy: { updatedAt: "desc" },
      include: { updatedBy: { select: { name: true } } },
    }),
  ]);

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <Link href="/onboarding" className="inline-flex items-center gap-1 text-sm text-muted hover:underline">
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Candidate onboarding
        </Link>
        <div className="mt-2 flex items-center justify-between gap-3">
          <h1 className="text-xl font-semibold tracking-tight text-primary">{candidate.candidateName}</h1>
          <DeleteButton
            action={deleteCandidateAction}
            hiddenFields={{ id: candidate.id }}
            confirmMessage={`Remove "${candidate.candidateName}" from onboarding? This can't be undone.`}
            label="Remove"
          />
        </div>
        <p className="mt-1 text-sm text-muted">
          {candidate.trade ?? "No trade set"} · {candidate.agency?.name ?? "No agency"}
          {candidate.project ? ` · ${candidate.project.code} · ${candidate.project.name}` : ""}
        </p>
      </div>

      <JoinPanel candidate={candidate} />

      <div className="card overflow-hidden">
        <div className="border-b border-default px-4 py-3">
          <p className="text-sm font-medium text-primary">Onboarding stages</p>
          <p className="text-xs text-muted">Expand a stage to record its status, date, reference and remarks.</p>
        </div>
        {STAGES.map((stage) => (
          <StageRow key={stage.key} candidateId={candidate.id} stage={stage} status={candidate[stage.field]} kind={statusKind(stage, candidate[stage.field])} />
        ))}
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-primary">Candidate details</p>
        <CandidateForm candidate={candidate} agencies={agencies} projects={projects} demandRequests={demandRequests} hrUsers={hrUsers} />
      </div>

      <div className="card overflow-x-auto">
        <div className="border-b border-default px-4 py-3">
          <p className="text-sm font-medium text-primary">History</p>
        </div>
        <table className="w-full text-sm">
          <thead className="border-b border-default bg-surface-subtle text-left text-xs font-medium uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-2">Stage</th>
              <th className="px-3 py-2">Change</th>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Reference</th>
              <th className="px-3 py-2">Remarks</th>
              <th className="px-3 py-2">Updated by</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {history.map((h) => (
              <tr key={h.id}>
                <td className="px-4 py-2 text-secondary">{STAGES.find((s) => s.key === h.stage)?.label ?? h.stage}</td>
                <td className="px-3 py-2 text-secondary">{h.oldStatus} → {h.newStatus}</td>
                <td className="px-3 py-2 text-secondary">{new Date(h.statusDate).toLocaleDateString()}</td>
                <td className="px-3 py-2 text-secondary">{h.referenceNo ?? "—"}</td>
                <td className="px-3 py-2 text-secondary">{h.remarks ?? "—"}</td>
                <td className="px-3 py-2 text-secondary">{h.updatedBy?.name ?? "—"}</td>
              </tr>
            ))}
            {history.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-muted">
                  No stage updates recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
