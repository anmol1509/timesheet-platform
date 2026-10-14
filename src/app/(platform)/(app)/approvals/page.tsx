import { requireUserWithBranch, subjectOf } from "@/lib/auth";
import { CheckCheck } from "lucide-react";
import { PageHeader, CountPill } from "@/components/PageHeader";
import { APPROVAL_KINDS, allowedKinds, countByKind, filterApprovals, loadApprovals, type ApprovalKind } from "@/lib/approvals";
import { AgingHistogram } from "@/components/AgingHistogram";
import { ApprovalsBoard, type BoardItem } from "./approvals-board";

export const metadata = { title: "Approvals" };

const num = (v: string | undefined) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : undefined; };

/**
 * One inbox for everything waiting on a decision. Each kind is listed only if
 * the signed-in person may decide it; the decisions themselves are made by the
 * same server actions the modules use.
 */
export default async function ApprovalsPage({ searchParams }: { searchParams: Promise<{ type?: string; q?: string; age?: string; min?: string; from?: string }> }) {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const subject = subjectOf(user);
  const q = await searchParams;
  const now = new Date();

  const all = await loadApprovals({ branchId, isSuperAdmin, subject, role: user.role });
  const counts = countByKind(all);
  const kinds = allowedKinds(subject);
  const type = (APPROVAL_KINDS.some((k) => k.kind === q.type) ? q.type : undefined) as ApprovalKind | undefined;
  const requesters = [...new Set(all.map((i) => i.requester).filter((x): x is string => !!x))].sort();
  const shown = filterApprovals(all, { type, q: q.q, olderThanDays: num(q.age), minAmount: num(q.min), requester: q.from }, now);

  const items: BoardItem[] = shown.map((i) => ({ ...i, at: i.at.toISOString(), ageDays: Math.floor((now.getTime() - i.at.getTime()) / 86_400_000) }));
  const oldest = all[0] ? Math.floor((now.getTime() - all[0].at.getTime()) / 86_400_000) : 0;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Approvals"
        icon={CheckCheck}
        meta={all.length > 0 ? <CountPill>{all.length}</CountPill> : undefined}
        description={all.length === 0 ? "Nothing is waiting for a decision." : `${all.length} waiting for a decision${oldest >= 7 ? ` · the oldest has waited ${oldest} days` : ""}. Decide here, or open an item to see it in full.`}
      />
      {kinds.length === 0 ? (
        <div className="empty-state"><p className="text-sm text-muted">Your role doesn&apos;t include approving anything. If you should, ask an admin to add approval permissions to your role.</p></div>
      ) : (
        <>
          {all.length > 0 && (
            <section className="card p-5">
              <h2 className="mb-3 text-sm font-semibold text-primary">How long items have been waiting</h2>
              <AgingHistogram ageDays={all.map((i) => Math.floor((now.getTime() - i.at.getTime()) / 86_400_000))} />
            </section>
          )}
          <ApprovalsBoard
            items={items}
            totalShown={shown.length}
            tabs={[{ key: "", label: "All", count: all.length }, ...APPROVAL_KINDS.filter((k) => kinds.includes(k.kind)).map((k) => ({ key: k.kind, label: k.label, count: counts[k.kind] }))]}
            filters={{ type: type ?? "", q: q.q ?? "", age: q.age ?? "", min: q.min ?? "", from: q.from ?? "" }}
            requesters={requesters}
          />
        </>
      )}
    </div>
  );
}
