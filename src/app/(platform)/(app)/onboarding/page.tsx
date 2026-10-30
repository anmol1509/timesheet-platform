import { NewLink } from "@/components/PermissionsProvider";
import { PageHeader } from "@/components/PageHeader";
import Link from "next/link";
import { Plus, ListChecks, Handshake } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireUserWithBranch, subjectOf } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { branchWhere } from "@/lib/branch";
import { cn } from "@/lib/cn";
import { STAGES, currentStage, daysSince, isOverdue, papersPending, pendingSince } from "@/lib/onboarding";
import { candidateDocStatus } from "@/lib/candidateDocs";
import { resolveDocTypes } from "@/lib/documentTypes";
import { OnboardingTable } from "./onboarding-table";
import { DeploymentPipelineFunnel } from "@/components/DeploymentPipelineFunnel";
import { Insights } from "@/components/ListSummary";

export const metadata = { title: "Candidate onboarding" };

export default async function OnboardingPage() {
  const { user, branchId } = await requireUserWithBranch();
  const canEdit = can(subjectOf(user), "onboarding.tracker", "edit");

  const found = await prisma.candidateOnboarding.findMany({
    where: branchWhere(branchId),
    orderBy: { createdAt: "desc" },
    include: { agency: { select: { name: true } } },
  });
  // The documents each candidate has handed over, against what the branch requires.
  const [typeRows, files] = await Promise.all([
    prisma.documentType.findMany({ where: { ...branchWhere(branchId), appliesTo: "CANDIDATE" } }),
    found.length ? prisma.attachment.findMany({ where: { entityType: "CANDIDATE_ONBOARDING", entityId: { in: found.map((c) => c.id) } }, select: { id: true, entityId: true, docType: true, filename: true, expiryDate: true, uploadedAt: true } }) : [],
  ]);
  const docsOf = (c: (typeof found)[number]) => candidateDocStatus(
    resolveDocTypes(typeRows.filter((r) => r.branchId === c.branchId), "CANDIDATE"),
    files.filter((f) => f.entityId === c.id).map((f) => ({ ...f, expiryDate: f.expiryDate?.toISOString() ?? null, uploadedAt: f.uploadedAt.toISOString() })),
  );
  // Days pending count from the last stage change; dropped candidates are out of the queue and the numbers.
  const candidates = found.map((c) => ({ ...c, pendingSince: pendingSince(c), dropped: c.droppedAt !== null, docs: docsOf(c) }));

  const live = candidates.filter((c) => !c.dropped);
  const total = live.length;
  const active = live.filter((c) => !c.joined);
  const readyCount = active.filter((c) => c.readyToJoin).length;
  const joinedCount = live.filter((c) => c.joined).length;
  const overdueCount = active.filter((c) => isOverdue(c, c.pendingSince)).length;
  const papersCount = live.filter((c) => papersPending(c)).length;

  const stagePending: Record<string, number> = {};
  for (const stage of STAGES) stagePending[stage.key] = 0;
  const workQueue: { id: string; name: string; agency: string | null; stageLabel: string; days: number; overdue: boolean }[] = [];
  for (const c of active) {
    const stage = currentStage(c);
    if (!stage) continue;
    stagePending[stage.key]++;
    workQueue.push({ id: c.id, name: c.candidateName, agency: c.agency?.name ?? null, stageLabel: stage.label, days: daysSince(c.pendingSince), overdue: isOverdue(c, c.pendingSince) });
  }
  workQueue.sort((a, b) => b.days - a.days);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeader
          title="Candidate onboarding"
          icon={ListChecks}
          description={<>From agency submission through to joining. One status per stage, dated and referenced.</>}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/onboarding/agencies" className="btn btn-secondary">
            <Handshake className="h-4 w-4" aria-hidden /> Agencies
          </Link>
          {canEdit && (
            <NewLink href="/onboarding/new" className="btn btn-primary">
              <Plus className="h-4 w-4" aria-hidden /> Add candidate
            </NewLink>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <div className="card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Total candidates</p>
          <p className="mt-1 text-2xl font-semibold text-primary">{total}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">In progress</p>
          <p className="mt-1 text-2xl font-semibold text-primary">{active.length - readyCount}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Overdue</p>
          <p className={cn("mt-1 text-2xl font-semibold", overdueCount > 0 ? "text-[var(--error)]" : "text-primary")}>{overdueCount}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Ready to join</p>
          <p className="mt-1 text-2xl font-semibold text-[var(--success-text,#067647)]">{readyCount}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Papers pending</p>
          <p className={cn("mt-1 text-2xl font-semibold", papersCount > 0 ? "text-[var(--warning-text,#92400e)]" : "text-primary")}>{papersCount}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Joined</p>
          <p className="mt-1 text-2xl font-semibold text-primary">{joinedCount}</p>
        </div>
      </div>

      <Insights id="onboarding" title="Pending by stage">
        <DeploymentPipelineFunnel
          href="/onboarding"
          stages={STAGES.map((stage) => ({ key: stage.key, label: stage.label, count: stagePending[stage.key] }))}
        />
      </Insights>

      {workQueue.length > 0 && (
        <div className="card overflow-x-auto">
          <div className="border-b border-default px-4 py-3">
            <p className="text-sm font-medium text-primary">Action required today</p>
            <p className="text-xs text-muted">Sorted by how long each candidate has sat at their current stage; red rows are past that stage&rsquo;s typical turnaround.</p>
          </div>
          <table className="w-full text-sm">
            <thead className="border-b border-default bg-surface-subtle text-left text-xs font-medium uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-2">Candidate</th>
                <th className="px-4 py-2">Agency</th>
                <th className="px-4 py-2">Current stage</th>
                <th className="px-4 py-2">Days pending</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {workQueue.slice(0, 10).map((row) => (
                <tr key={row.id} className={row.overdue ? "bg-[var(--error-soft,#fee4e2)]/30" : undefined}>
                  <td className="px-4 py-2">
                    <Link href={`/onboarding/${row.id}`} className="font-medium text-primary hover:underline">
                      {row.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-secondary">{row.agency ?? "—"}</td>
                  <td className="px-4 py-2 text-secondary">{row.stageLabel}</td>
                  <td className={cn("px-4 py-2", row.overdue ? "font-medium text-[var(--error)]" : "text-secondary")}>{row.days}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <OnboardingTable candidates={candidates} />
    </div>
  );
}
