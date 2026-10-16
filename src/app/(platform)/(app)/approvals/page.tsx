import { requireUserWithBranch, subjectOf } from "@/lib/auth";
import { CheckCheck } from "lucide-react";
import { APPROVAL_KINDS, allowedKinds, countByKind, filterApprovals, loadApprovals, type ApprovalKind } from "@/lib/approvals";
import { AgingHistogram } from "@/components/AgingHistogram";
import { Insights } from "@/components/ListSummary";
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
  const value = all.reduce((n, i) => n + (i.amount ?? 0), 0);
  const overdue = all.filter((i) => now.getTime() - i.at.getTime() >= 7 * 86_400_000).length;
  const oldest = all[0] ? Math.floor((now.getTime() - all[0].at.getTime()) / 86_400_000) : 0;

  return (
    <div className="space-y-5">
      <header className="relative overflow-hidden rounded-[var(--radius-overlay,20px)] px-5 py-5 text-white sm:px-7 sm:py-6" style={{ background: "linear-gradient(135deg,#43359f 0%,#5b49d8 55%,#7a4fe3 100%)" }}>
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15"><CheckCheck className="h-5 w-5" aria-hidden /></span>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight">Approvals</h1>
            <p className="text-sm text-white/80">{all.length === 0 ? "Nothing is waiting for a decision." : "Decide here, or open an item to see it in full."}</p>
          </div>
        </div>
        {all.length > 0 && (
          <dl className="mt-4 flex flex-wrap gap-2">
            {[
              { l: "Waiting", v: String(all.length) },
              { l: "Value", v: value > 0 ? `AED ${value.toLocaleString("en-AE", { maximumFractionDigits: 0 })}` : "—" },
              { l: "Longest wait", v: oldest <= 0 ? "today" : `${oldest} day${oldest === 1 ? "" : "s"}` },
              { l: "Overdue (7d+)", v: String(overdue), warn: overdue > 0 },
            ].map((c) => (
              <div key={c.l} className={`flex items-baseline gap-2 rounded-full border px-3 py-1 ${c.warn ? "border-amber-200/60 bg-amber-300/25" : "border-white/20 bg-white/10"}`}>
                <dt className="text-xs text-white/75">{c.l}</dt>
                <dd className="tabular text-sm font-semibold">{c.v}</dd>
              </div>
            ))}
          </dl>
        )}
      </header>
      {kinds.length === 0 ? (
        <div className="empty-state"><p className="text-sm text-muted">Your role doesn&apos;t include approving anything. If you should, ask an admin to add approval permissions to your role.</p></div>
      ) : (
        <>
          {all.length > 0 && (
            <Insights id="approvals" title="How long items have been waiting">
              <AgingHistogram ageDays={all.map((i) => Math.floor((now.getTime() - i.at.getTime()) / 86_400_000))} />
            </Insights>
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
