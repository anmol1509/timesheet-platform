import { Sparkles } from "lucide-react";
import { HeroHeader } from "@/components/HeroHeader";
import { prisma } from "@/lib/db";
import { requireAdmin, resolveSuperAdminBranchId } from "@/lib/auth";
import { FEATURE_LABEL, monthKey, monthRange } from "@/lib/aiCredits";
import { loadCreditStatus } from "@/lib/aiCreditsServer";
import { cn } from "@/lib/cn";
import { CreditForms } from "./credit-forms";

export const metadata = { title: "AI credits" };

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");
const date = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Dubai" });

export default async function AiCreditsPage() {
  const user = await requireAdmin();
  const isSuperAdmin = user.role === "SUPER_ADMIN";
  const branchId = isSuperAdmin ? await resolveSuperAdminBranchId() : user.branchId;
  if (!branchId) {
    return <p className="card p-6 text-sm text-muted">Sign in as a company administrator to see its AI credits.</p>;
  }
  const now = new Date();
  const { start, end } = monthRange(monthKey(now));
  const [status, branch, byFeature, byUser, grants, branches] = await Promise.all([
    loadCreditStatus(branchId, now),
    prisma.branch.findUnique({ where: { id: branchId }, select: { name: true, aiMonthlyCredits: true } }),
    prisma.aiUsage.groupBy({ by: ["feature"], where: { branchId, createdAt: { gte: start, lt: end } }, _sum: { credits: true }, _count: { _all: true }, orderBy: { _sum: { credits: "desc" } } }),
    prisma.aiUsage.groupBy({ by: ["userId"], where: { branchId, createdAt: { gte: start, lt: end } }, _sum: { credits: true }, _count: { _all: true }, orderBy: { _sum: { credits: "desc" } }, take: 8 }),
    prisma.aiCreditGrant.findMany({ where: { branchId, grantedAt: { gte: start, lt: end } }, orderBy: { grantedAt: "desc" } }),
    isSuperAdmin ? prisma.branch.findMany({ where: { isActive: true }, orderBy: { code: "asc" }, select: { id: true, name: true, code: true, aiMonthlyCredits: true } }) : Promise.resolve([]),
  ]);
  const people = await prisma.user.findMany({ where: { id: { in: byUser.map((u) => u.userId).filter((x): x is string => !!x) } }, select: { id: true, name: true } });
  const nameOf = new Map(people.map((p) => [p.id, p.name]));
  const allBranches = await Promise.all(branches.map(async (b) => ({ ...b, status: await loadCreditStatus(b.id, now) })));
  const tone = status.level === "out" ? "bg-[var(--error)]" : status.level === "warn" ? "bg-[var(--warning)]" : "bg-[var(--brand-primary)]";
  const totalUsed = byFeature.reduce((s, f) => s + (f._sum.credits ?? 0), 0);

  return (
    <div className="space-y-6">
      <HeroHeader
        icon={Sparkles}
        title="AI credits"
        subtitle={`${branch?.name ?? "This company"}: every AI action, such as reading a document, the assistant or matching names in an import, uses credits. When they are used up AI pauses until they reset; everything can still be done by hand.`}
        pills={[
          { label: "Left", value: fmt(status.remaining), warn: status.level !== "ok" },
          { label: "Used", value: fmt(status.used) },
          { label: "This month", value: fmt(status.total) },
          { label: "Resets", value: date(status.resetsAt) },
        ]}
      />

      <section className="card space-y-3 p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold text-primary">{status.level === "out" ? "AI is paused" : status.level === "warn" ? "Running low" : "This month"}</h2>
          <p className="tabular text-sm text-secondary">{fmt(status.used)} of {fmt(status.total)} credits used · {status.pct}%</p>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-surface-sunken" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={status.pct} aria-label="AI credits used this month">
          <div className={cn("h-full rounded-full", tone)} style={{ width: `${Math.max(status.pct, status.pct > 0 ? 2 : 0)}%` }} />
        </div>
        <p className="text-xs text-muted">
          {status.level === "out"
            ? "No credits are left. AI features show a message and everything can still be entered by hand. Ask for more credits, or wait for the reset."
            : status.level === "warn"
              ? "More than 80% is used. Admins get a message at 80% and again when AI pauses."
              : "Admins get a message when 80% is used and again if AI pauses."}
        </p>
      </section>

      {isSuperAdmin && <CreditForms branchId={branchId} allowance={branch?.aiMonthlyCredits ?? 0} />}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card overflow-hidden">
          <h2 className="border-b border-default px-4 py-3 text-sm font-semibold text-primary">What used them this month</h2>
          {byFeature.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted">No AI has been used this month yet.</p>
          ) : (
            <table className="w-full text-sm">
              <tbody className="divide-y divide-[var(--border)]">
                {byFeature.map((f) => {
                  const credits = f._sum.credits ?? 0;
                  return (
                    <tr key={f.feature}>
                      <td className="px-4 py-2.5 text-primary">{FEATURE_LABEL[f.feature] ?? f.feature}<span className="block text-xs text-muted">{f._count._all} call{f._count._all === 1 ? "" : "s"}</span></td>
                      <td className="w-32 px-2"><div className="h-1.5 overflow-hidden rounded-full bg-surface-sunken"><div className="h-full rounded-full bg-[var(--brand-primary)]" style={{ width: `${totalUsed > 0 ? Math.max(3, Math.round((credits / totalUsed) * 100)) : 0}%` }} /></div></td>
                      <td className="tabular px-4 py-2.5 text-right text-secondary">{fmt(credits)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>
        <section className="card overflow-hidden">
          <h2 className="border-b border-default px-4 py-3 text-sm font-semibold text-primary">Who used them</h2>
          {byUser.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted">Nobody yet this month.</p>
          ) : (
            <table className="w-full text-sm">
              <tbody className="divide-y divide-[var(--border)]">
                {byUser.map((u) => (
                  <tr key={u.userId ?? "none"}>
                    <td className="px-4 py-2.5 text-primary">{u.userId ? nameOf.get(u.userId) ?? "A former user" : "Background work"}<span className="block text-xs text-muted">{u._count._all} call{u._count._all === 1 ? "" : "s"}</span></td>
                    <td className="tabular px-4 py-2.5 text-right text-secondary">{fmt(u._sum.credits ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      {grants.length > 0 && (
        <section className="card overflow-hidden">
          <h2 className="border-b border-default px-4 py-3 text-sm font-semibold text-primary">Credits added this month</h2>
          <ul className="divide-y divide-[var(--border)] text-sm">
            {grants.map((g) => (
              <li key={g.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <span className="text-primary">+{fmt(g.credits)}{g.note ? <span className="ml-2 text-xs text-muted">{g.note}</span> : null}</span>
                <span className="text-xs text-muted">{date(g.grantedAt)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {isSuperAdmin && allBranches.length > 1 && (
        <section className="card overflow-hidden">
          <h2 className="border-b border-default px-4 py-3 text-sm font-semibold text-primary">All companies</h2>
          <table className="w-full text-sm">
            <thead className="bg-surface-subtle text-left text-xs font-medium tracking-wide text-muted uppercase"><tr><th className="px-4 py-2">Company</th><th className="px-4 py-2 text-right">Allowance</th><th className="px-4 py-2 text-right">Used</th><th className="px-4 py-2 text-right">Left</th></tr></thead>
            <tbody className="divide-y divide-[var(--border)]">
              {allBranches.map((b) => (
                <tr key={b.id}>
                  <td className="px-4 py-2.5 text-primary">{b.name} <span className="text-xs text-muted">{b.code}</span></td>
                  <td className="tabular px-4 py-2.5 text-right text-secondary">{fmt(b.aiMonthlyCredits)}</td>
                  <td className="tabular px-4 py-2.5 text-right text-secondary">{fmt(b.status.used)}</td>
                  <td className={cn("tabular px-4 py-2.5 text-right", b.status.level === "out" ? "font-medium text-[var(--error)]" : b.status.level === "warn" ? "font-medium text-[var(--warning)]" : "text-secondary")}>{fmt(b.status.remaining)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t border-default px-4 py-2 text-xs text-muted">Switch company in the header to change another company&apos;s allowance.</p>
        </section>
      )}
    </div>
  );
}
