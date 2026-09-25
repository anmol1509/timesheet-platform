import Link from "next/link";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { cn } from "@/lib/cn";
import { STAGES, currentStage, daysSince, isOverdue } from "@/lib/onboarding";
import { OnboardingTable } from "./onboarding-table";

export const metadata = { title: "Candidate onboarding" };

export default async function OnboardingPage() {
  const { branchId } = await requireUserWithBranch();

  const candidates = await prisma.candidateOnboarding.findMany({
    where: branchWhere(branchId),
    orderBy: { createdAt: "desc" },
    include: { agency: { select: { name: true } } },
  });

  const total = candidates.length;
  const active = candidates.filter((c) => !c.joined);
  const readyCount = active.filter((c) => c.readyToJoin).length;
  const joinedCount = candidates.filter((c) => c.joined).length;
  const overdueCount = active.filter((c) => isOverdue(c, c.updatedAt)).length;

  const stagePending: Record<string, number> = {};
  for (const stage of STAGES) stagePending[stage.key] = 0;
  const workQueue: { id: string; name: string; agency: string | null; stageLabel: string; days: number; overdue: boolean }[] = [];
  for (const c of active) {
    const stage = currentStage(c);
    if (!stage) continue;
    stagePending[stage.key]++;
    workQueue.push({ id: c.id, name: c.candidateName, agency: c.agency?.name ?? null, stageLabel: stage.label, days: daysSince(c.updatedAt), overdue: isOverdue(c, c.updatedAt) });
  }
  workQueue.sort((a, b) => b.days - a.days);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-primary">Candidate onboarding</h1>
          <p className="mt-1 text-sm text-muted">
            From agency submission through to joining — one status per stage, dated and referenced.
          </p>
        </div>
        <Link href="/onboarding/new" className="btn btn-primary">
          <Plus className="h-4 w-4" aria-hidden /> Add candidate
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-5">
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
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Joined</p>
          <p className="mt-1 text-2xl font-semibold text-primary">{joinedCount}</p>
        </div>
      </div>

      <div className="card p-4">
        <p className="mb-3 text-sm font-medium text-primary">Pending by stage</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {STAGES.map((stage) => (
            <div key={stage.key} className="rounded-lg bg-surface-subtle px-3 py-2">
              <p className="truncate text-xs text-muted">{stage.label}</p>
              <p className="text-lg font-semibold text-primary">{stagePending[stage.key]}</p>
            </div>
          ))}
        </div>
      </div>

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
