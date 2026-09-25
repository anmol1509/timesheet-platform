import Link from "next/link";
import { Check, Minus, Plus, X } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { cn } from "@/lib/cn";
import { STAGES, currentStage, daysSince, statusKind, type StatusKind } from "@/lib/onboarding";

export const metadata = { title: "Candidate onboarding" };

function StatusIcon({ kind }: { kind: StatusKind }) {
  if (kind === "done") return <Check className="h-4 w-4 text-[var(--success)]" aria-label="Completed" />;
  if (kind === "issue") return <X className="h-4 w-4 text-[var(--error)]" aria-label="Issue" />;
  if (kind === "pending") return <Minus className="h-4 w-4 text-subtle" aria-label="Pending" />;
  return <span className="inline-block h-2.5 w-2.5 rounded-full bg-[var(--warning)]" aria-label="In progress" />;
}

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

  const stagePending: Record<string, number> = {};
  for (const stage of STAGES) stagePending[stage.key] = 0;
  const workQueue: { id: string; name: string; agency: string | null; stageLabel: string; days: number }[] = [];
  for (const c of active) {
    const stage = currentStage(c);
    if (!stage) continue;
    stagePending[stage.key]++;
    workQueue.push({ id: c.id, name: c.candidateName, agency: c.agency?.name ?? null, stageLabel: stage.label, days: daysSince(c.updatedAt) });
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

      <div className="grid gap-3 sm:grid-cols-4">
        <div className="card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Total candidates</p>
          <p className="mt-1 text-2xl font-semibold text-primary">{total}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">In progress</p>
          <p className="mt-1 text-2xl font-semibold text-primary">{active.length - readyCount}</p>
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
            <p className="text-xs text-muted">Sorted by how long each candidate has sat at their current stage.</p>
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
                <tr key={row.id}>
                  <td className="px-4 py-2">
                    <Link href={`/onboarding/${row.id}`} className="font-medium text-primary hover:underline">
                      {row.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-secondary">{row.agency ?? "—"}</td>
                  <td className="px-4 py-2 text-secondary">{row.stageLabel}</td>
                  <td className={cn("px-4 py-2", row.days >= 5 ? "font-medium text-[var(--error)]" : "text-secondary")}>{row.days}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-default bg-surface-subtle text-left text-xs font-medium uppercase tracking-wide text-muted">
            <tr>
              <th className="sticky left-0 z-10 bg-surface-subtle px-4 py-3">Candidate</th>
              <th className="px-3 py-3">Agency</th>
              <th className="px-3 py-3">Trade</th>
              {STAGES.map((stage) => (
                <th key={stage.key} className="px-2 py-3 text-center" title={stage.label}>
                  {stage.label.split(" ")[0]}
                </th>
              ))}
              <th className="px-2 py-3 text-center">Ready</th>
              <th className="px-2 py-3 text-center">Joined</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {candidates.map((c) => (
              <tr key={c.id}>
                <td className="sticky left-0 z-10 bg-surface px-4 py-2.5">
                  <Link href={`/onboarding/${c.id}`} className="font-medium text-primary hover:underline">
                    {c.candidateName}
                  </Link>
                </td>
                <td className="px-3 py-2.5 text-secondary">{c.agency?.name ?? "—"}</td>
                <td className="px-3 py-2.5 text-secondary">{c.trade ?? "—"}</td>
                {STAGES.map((stage) => (
                  <td key={stage.key} className="px-2 py-2.5 text-center">
                    <span className="inline-flex items-center justify-center">
                      <StatusIcon kind={statusKind(stage, c[stage.field])} />
                    </span>
                  </td>
                ))}
                <td className="px-2 py-2.5 text-center">
                  {c.readyToJoin && !c.joined ? <Check className="mx-auto h-4 w-4 text-[var(--success)]" /> : <Minus className="mx-auto h-4 w-4 text-subtle" />}
                </td>
                <td className="px-2 py-2.5 text-center">
                  {c.joined ? <Check className="mx-auto h-4 w-4 text-[var(--success)]" /> : <Minus className="mx-auto h-4 w-4 text-subtle" />}
                </td>
              </tr>
            ))}
            {candidates.length === 0 && (
              <tr>
                <td colSpan={STAGES.length + 5} className="px-4 py-8 text-center text-muted">
                  No candidates yet. Add one to start tracking their onboarding.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
