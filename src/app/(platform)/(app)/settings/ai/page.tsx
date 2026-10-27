import Link from "next/link";
import { Sparkles } from "lucide-react";
import { HeroHeader } from "@/components/HeroHeader";
import { prisma } from "@/lib/db";
import { requireAdmin, resolveSuperAdminBranchId } from "@/lib/auth";
import { FEATURE_LABEL, monthKey, monthRange } from "@/lib/aiCredits";
import { loadCreditStatus } from "@/lib/aiCreditsServer";
import { cn } from "@/lib/cn";
import { CreditForms, RequestStrip } from "./credit-forms";

export const metadata = { title: "AI credits" };

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");
const date = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Dubai" });
const when = (d: Date) => d.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Dubai" });
const dubaiDay = (d: Date) => Number(d.toLocaleDateString("en-GB", { day: "numeric", timeZone: "Asia/Dubai" }));
const TABS = [["overview", "Overview"], ["usage", "Usage"], ["requests", "Requests"], ["alerts", "Alerts"]] as const;
const REQUEST_TONE: Record<string, string> = { PENDING: "bg-[var(--warning-soft)] text-[var(--warning)]", APPROVED: "bg-[var(--success-soft)] text-[var(--success)]", DECLINED: "bg-surface-sunken text-secondary" };
const REQUEST_LABEL: Record<string, string> = { PENDING: "Waiting", APPROVED: "Approved", DECLINED: "Declined" };

export default async function AiCreditsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requireAdmin();
  const { tab: rawTab } = await searchParams;
  const tab = TABS.some(([k]) => k === rawTab) ? (rawTab as (typeof TABS)[number][0]) : "overview";
  const isSuperAdmin = user.role === "SUPER_ADMIN";
  const branchId = isSuperAdmin ? await resolveSuperAdminBranchId() : user.branchId;
  if (!branchId) {
    return <p className="card p-6 text-sm text-muted">Sign in as a company administrator to see its AI credits.</p>;
  }
  const now = new Date();
  const { start, end } = monthRange(monthKey(now));
  const [status, branch, byFeature, rows, grants, requests, admins, branches] = await Promise.all([
    loadCreditStatus(branchId, now),
    prisma.branch.findUnique({ where: { id: branchId }, select: { name: true, aiMonthlyCredits: true } }),
    prisma.aiUsage.groupBy({ by: ["feature"], where: { branchId, createdAt: { gte: start, lt: end } }, _sum: { credits: true }, _count: { _all: true }, orderBy: { _sum: { credits: "desc" } } }),
    prisma.aiUsage.findMany({ where: { branchId, createdAt: { gte: start, lt: end } }, orderBy: { createdAt: "desc" }, select: { id: true, createdAt: true, feature: true, userId: true, credits: true } }),
    prisma.aiCreditGrant.findMany({ where: { branchId, grantedAt: { gte: start, lt: end } }, orderBy: { grantedAt: "desc" } }),
    prisma.aiCreditRequest.findMany({ where: { branchId }, orderBy: { createdAt: "desc" }, take: 30 }),
    prisma.user.findMany({ where: { branchId, role: "BRANCH_ADMIN", isActive: true }, select: { name: true, email: true, notifyEmail: true }, orderBy: { name: "asc" } }),
    isSuperAdmin ? prisma.branch.findMany({ where: { isActive: true }, orderBy: { code: "asc" }, select: { id: true, name: true, code: true, aiMonthlyCredits: true } }) : Promise.resolve([]),
  ]);
  const people = await prisma.user.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.userId).filter((x): x is string => !!x))] } }, select: { id: true, name: true } });
  const nameOf = new Map(people.map((p) => [p.id, p.name]));
  const allBranches = await Promise.all(branches.map(async (b) => ({ ...b, status: await loadCreditStatus(b.id, now) })));
  const tone = status.level === "out" ? "bg-[var(--error)]" : status.level === "warn" ? "bg-[var(--warning)]" : "bg-[var(--brand-primary)]";
  const totalUsed = byFeature.reduce((s, f) => s + (f._sum.credits ?? 0), 0);
  const daysInMonth = Math.round((end.getTime() - start.getTime()) / 86_400_000);
  const perDay = Array.from({ length: daysInMonth }, () => 0);
  for (const r of rows) perDay[Math.min(daysInMonth, Math.max(1, dubaiDay(r.createdAt))) - 1] += r.credits;
  const peak = Math.max(1, ...perDay);
  const daysLeft = Math.max(0, Math.ceil((status.resetsAt.getTime() - now.getTime()) / 86_400_000));
  const waiting = requests.filter((r) => r.status === "PENDING").length;

  return (
    <div className="space-y-6">
      <HeroHeader
        icon={Sparkles}
        title="AI credits"
        subtitle={`Used by ${branch?.name ?? "this company"} across all modules. Reading a document, the assistant or matching names in an import uses credits. When they are used up AI pauses until they reset; everything can still be done by hand.`}
      />

      <section className="card flex flex-wrap items-center gap-x-10 gap-y-4 bg-[var(--brand-primary-soft)] p-6">
        <div className="min-w-[14rem]">
          <p className="text-xs font-semibold tracking-wide text-[var(--brand-primary)] uppercase">{status.level === "out" ? "AI is paused" : status.level === "warn" ? "Running low" : "AI credits"}</p>
          <p className="tabular text-4xl font-bold tracking-tight text-primary">{fmt(status.used)} <span className="text-xl font-medium text-muted">/ {fmt(status.total)}</span></p>
          <p className="text-xs text-secondary">credits used this month ({status.pct}%)</p>
          <div className="mt-2 h-2 w-72 max-w-full overflow-hidden rounded-full bg-surface" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={status.pct} aria-label="AI credits used this month"><div className={cn("h-full rounded-full", tone)} style={{ width: `${Math.max(status.pct, status.pct > 0 ? 2 : 0)}%` }} /></div>
        </div>
        <div className="border-l border-[var(--brand-primary-border)] pl-8"><p className="tabular text-2xl font-bold text-primary">{fmt(status.remaining)}</p><p className="text-xs text-secondary">Credits remaining</p></div>
        <div><p className="tabular text-2xl font-bold text-primary">{fmt(branch?.aiMonthlyCredits ?? 0)}</p><p className="text-xs text-secondary">Monthly allowance</p></div>
        <div className="ml-auto text-right"><p className="text-xs text-secondary">Resets on</p><p className="text-xl font-bold text-primary">{date(status.resetsAt)}</p><p className="text-xs text-secondary">in {daysLeft} {daysLeft === 1 ? "day" : "days"}</p></div>
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Total allowance", fmt(status.total), "per month"],
          ["Used this month", fmt(status.used), `${status.pct}%`],
          ["Remaining", fmt(status.remaining), status.level === "out" ? "AI is paused" : ""],
          ["Resets on", new Date(status.resetsAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Asia/Dubai" }), `in ${daysLeft} ${daysLeft === 1 ? "day" : "days"}`],
        ].map(([label, value, note]) => (
          <div key={label} className="card p-4"><p className="text-xs text-muted">{label}</p><p className={cn("tabular text-2xl font-bold", label === "Remaining" ? (status.level === "out" ? "text-[var(--error)]" : "text-[var(--success)]") : "text-primary")}>{value}</p><p className="text-xs text-muted">{note || " "}</p></div>
        ))}
      </div>

      <RequestStrip />

      {isSuperAdmin && <CreditForms branchId={branchId} allowance={branch?.aiMonthlyCredits ?? 0} />}

      <nav className="flex gap-6 border-b border-default" aria-label="AI credits sections">
        {TABS.map(([k, label]) => (
          <Link key={k} href={k === "overview" ? "/settings/ai" : `/settings/ai?tab=${k}`} aria-current={tab === k ? "page" : undefined} className={cn("-mb-px border-b-2 py-2.5 text-sm transition", tab === k ? "border-[var(--brand-primary)] font-semibold text-[var(--brand-primary)]" : "border-transparent text-secondary hover:text-primary")}>
            {label}{k === "requests" && waiting > 0 ? <span className="ml-1.5 rounded-full bg-[var(--warning-soft)] px-1.5 text-xs text-[var(--warning)]">{waiting}</span> : null}
          </Link>
        ))}
      </nav>

      {tab === "overview" && (
        <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
          <section className="card p-4">
            <h2 className="text-sm font-semibold text-primary">Usage this month</h2>
            <p className="mb-3 text-xs text-muted">{fmt(status.used)} of {fmt(status.total)} credits used · {status.pct}%</p>
            {status.used === 0 ? <p className="py-8 text-sm text-muted">No AI has been used this month yet.</p> : (
              <div className="flex h-32 items-end gap-1" role="img" aria-label="Credits used each day this month">
                {perDay.map((v, i) => <div key={i} title={`${i + 1}: ${fmt(v)} credits`} className="flex-1 rounded-t bg-[var(--brand-primary-border)]" style={{ height: `${v === 0 ? 2 : Math.max(6, Math.round((v / peak) * 100))}%` }} />)}
              </div>
            )}
            <div className="mt-1 flex justify-between text-xs text-muted"><span>1</span><span>{Math.round(daysInMonth / 2)}</span><span>{daysInMonth}</span></div>
          </section>
          <section className="card overflow-hidden">
            <h2 className="border-b border-default px-4 py-3 text-sm font-semibold text-primary">Top AI credit usage</h2>
            {byFeature.length === 0 ? <p className="px-4 py-6 text-sm text-muted">Nothing used yet this month.</p> : (
              <ul className="divide-y divide-[var(--border)]">
                {byFeature.map((f) => {
                  const credits = f._sum.credits ?? 0;
                  return (
                    <li key={f.feature} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                      <span className="min-w-0 flex-1 text-primary">{FEATURE_LABEL[f.feature] ?? f.feature}<span className="block text-xs text-muted">{f._count._all} call{f._count._all === 1 ? "" : "s"}</span></span>
                      <span className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-sunken"><span className="block h-full rounded-full bg-[var(--brand-primary)]" style={{ width: `${totalUsed > 0 ? Math.max(3, Math.round((credits / totalUsed) * 100)) : 0}%` }} /></span>
                      <span className="tabular w-12 text-right text-secondary">{fmt(credits)}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      )}

      {tab === "usage" && (
        <section className="card overflow-hidden">
          <h2 className="border-b border-default px-4 py-3 text-sm font-semibold text-primary">Everything that used credits this month</h2>
          {rows.length === 0 ? <p className="px-4 py-6 text-sm text-muted">No AI has been used this month yet.</p> : (
            <table className="w-full text-sm">
              <thead className="bg-surface-subtle text-left text-xs font-medium tracking-wide text-muted uppercase"><tr><th className="px-4 py-2">When</th><th className="px-4 py-2">What</th><th className="px-4 py-2">Who</th><th className="px-4 py-2 text-right">Credits</th></tr></thead>
              <tbody className="divide-y divide-[var(--border)]">
                {rows.slice(0, 200).map((r) => (
                  <tr key={r.id}><td className="px-4 py-2 text-secondary">{when(r.createdAt)}</td><td className="px-4 py-2 text-primary">{FEATURE_LABEL[r.feature] ?? r.feature}</td><td className="px-4 py-2 text-secondary">{r.userId ? nameOf.get(r.userId) ?? "A former user" : "Background work"}</td><td className="tabular px-4 py-2 text-right text-secondary">{r.credits < 1 ? r.credits.toFixed(2) : fmt(r.credits)}</td></tr>
                ))}
              </tbody>
            </table>
          )}
          {rows.length > 200 && <p className="border-t border-default px-4 py-2 text-xs text-muted">Showing the latest 200 of {rows.length}.</p>}
        </section>
      )}

      {tab === "requests" && (
        <div className="space-y-6">
          <section className="card overflow-hidden">
            <h2 className="border-b border-default px-4 py-3 text-sm font-semibold text-primary">Requests for extra credits</h2>
            {requests.length === 0 ? <p className="px-4 py-6 text-sm text-muted">No requests yet. Use the box above to ask for more credits.</p> : (
              <ul className="divide-y divide-[var(--border)] text-sm">
                {requests.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                    <span className="text-primary"><span className="tabular font-semibold">+{fmt(r.credits)}</span> credits{r.reason ? <span className="ml-2 text-xs text-muted">{r.reason}</span> : null}<span className="block text-xs text-muted">{r.requestedByName ?? "Someone"} · {when(r.createdAt)}{r.decidedNote ? ` · ${r.decidedNote}` : ""}</span></span>
                    <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", REQUEST_TONE[r.status] ?? "")}>{REQUEST_LABEL[r.status] ?? r.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          {grants.length > 0 && (
            <section className="card overflow-hidden">
              <h2 className="border-b border-default px-4 py-3 text-sm font-semibold text-primary">Credits added this month</h2>
              <ul className="divide-y divide-[var(--border)] text-sm">
                {grants.map((g) => (
                  <li key={g.id} className="flex items-center justify-between gap-3 px-4 py-2.5"><span className="text-primary">+{fmt(g.credits)}{g.note ? <span className="ml-2 text-xs text-muted">{g.note}</span> : null}</span><span className="text-xs text-muted">{date(g.grantedAt)}</span></li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      {tab === "alerts" && (
        <section className="card space-y-3 p-4">
          <h2 className="text-sm font-semibold text-primary">Who is told when credits run low</h2>
          <p className="text-sm text-secondary">The company administrators get a message in the app and an email when 80% of the month&apos;s credits are used, and again if AI pauses at 100%. It happens once each month for each level.</p>
          {admins.length === 0 ? <p className="text-sm text-muted">No administrators found for this company.</p> : (
            <ul className="divide-y divide-[var(--border)] rounded-lg border border-default text-sm">
              {admins.map((a) => <li key={a.email} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"><span className="text-primary">{a.name}<span className="ml-2 text-xs text-muted">{a.email}</span></span><span className="text-xs text-muted">{a.notifyEmail ? "In the app and by email" : "In the app only"}</span></li>)}
            </ul>
          )}
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
