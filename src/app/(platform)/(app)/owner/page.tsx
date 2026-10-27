import Link from "next/link";
import { Building2, Plus } from "lucide-react";
import { HeroHeader } from "@/components/HeroHeader";
import { Badge } from "@/components/Badge";
import { ActiveLink } from "@/components/ActiveLink";
import { prisma } from "@/lib/db";
import { requireOwner } from "@/lib/ownerServer";
import { CUSTOMER_STATUS_LABEL, PAYING_STATUSES, creditsValueAed, monthlyEquivalent, receivable } from "@/lib/owner";
import type { CustomerStats } from "@/lib/ownerStats";
import { cn } from "@/lib/cn";
import { SyncAllButton } from "./owner-controls";

export const metadata = { title: "Customers" };

const aed = (n: number) => `AED ${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const STATUS_COLOR = { TRIAL: "blue", ACTIVE: "green", SUSPENDED: "amber", CHURNED: "slate" } as const;
const ago = (iso: string | null | undefined) => {
  if (!iso) return "Never";
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return d <= 0 ? "Today" : d === 1 ? "Yesterday" : `${d} days ago`;
};

export default async function OwnerPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireOwner();
  const { status } = await searchParams;
  const customers = await prisma.customer.findMany({ orderBy: { name: "asc" }, include: { invoices: { select: { status: true, total: true, dueDate: true, payments: { select: { amount: true } } } } } });
  const rows = customers.map((c) => {
    const stats = (c.lastStats ?? null) as CustomerStats | null;
    const recv = receivable(c.invoices.map((i) => ({ status: i.status, total: Number(i.total), dueDate: i.dueDate, paid: i.payments.reduce((s, p) => s + Number(p.amount), 0) })));
    return { c, stats, recv, mrr: PAYING_STATUSES.has(c.status) ? monthlyEquivalent(Number(c.planPriceAed), c.billingCycle) : 0 };
  });
  const shown = status ? rows.filter((r) => r.c.status === status) : rows;
  const count = (s: string) => rows.filter((r) => r.c.status === s).length;
  const mrr = rows.reduce((s, r) => s + r.mrr, 0);
  const owed = rows.reduce((s, r) => s + r.recv.owed, 0);
  const overdue = rows.reduce((s, r) => s + r.recv.overdue, 0);
  const aiUsed = rows.reduce((s, r) => s + (r.stats?.ai.used ?? 0), 0);
  const aiValue = rows.reduce((s, r) => s + creditsValueAed(r.stats?.ai.used ?? 0, Number(r.c.aiRateAed)), 0);

  const cards: { label: string; value: string; sub: string; href: string }[] = [
    { label: "Customers", value: String(rows.length), sub: "All, including trials", href: "/owner" },
    { label: "Active", value: String(count("ACTIVE")), sub: `${count("TRIAL")} on trial`, href: "/owner?status=ACTIVE" },
    { label: "Trial", value: String(count("TRIAL")), sub: "Not yet paying", href: "/owner?status=TRIAL" },
    { label: "Suspended", value: String(count("SUSPENDED")), sub: `${count("CHURNED")} have left`, href: "/owner?status=SUSPENDED" },
  ];

  return (
    <div className="space-y-6">
      <HeroHeader
        icon={Building2}
        title="Customers"
        subtitle="Every company that uses the platform: what they pay, how much they use it and how much AI they have left."
        pills={[
          { label: "Monthly revenue", value: aed(mrr) },
          { label: "To collect", value: aed(owed), warn: overdue > 0 },
          { label: "Overdue", value: aed(overdue), warn: overdue > 0 },
          { label: "AI used this month", value: `${Math.round(aiUsed).toLocaleString("en-US")} credits · ${aed(aiValue)}` },
        ]}
        actions={<Link href="/owner/new" className="btn inline-flex items-center gap-1.5 bg-white text-[#43359f] hover:bg-white/90"><Plus className="h-4 w-4" aria-hidden />Add customer</Link>}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((k) => (
          <ActiveLink key={k.label} href={k.href} className="card flex flex-col gap-1 p-4 transition hover:-translate-y-px hover:shadow-sm" activeClassName="border-[var(--brand-primary)] ring-2 ring-[var(--brand-primary)]/30 bg-brand-soft/40">
            <span className="text-sm font-medium text-secondary">{k.label}</span>
            <span className="tabular text-3xl font-semibold tracking-tight text-primary">{k.value}</span>
            <span className="text-xs text-subtle">{k.sub}</span>
          </ActiveLink>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-primary">{status ? `${CUSTOMER_STATUS_LABEL[status] ?? status} customers` : "All customers"} ({shown.length})</h2>
        <SyncAllButton />
      </div>

      {shown.length === 0 ? (
        <p className="card px-4 py-10 text-center text-sm text-muted">{rows.length === 0 ? "No customers yet. Add the first one, or bring in a company that is already on the platform." : "No customers with that status."}</p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[60rem] text-sm">
            <thead className="bg-surface-subtle text-left text-xs font-medium tracking-wide text-muted uppercase">
              <tr><th className="px-4 py-3">Customer</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Plan</th><th className="px-3 py-3 text-right">People</th><th className="px-3 py-3">AI credits</th><th className="px-3 py-3">Last active</th><th className="px-3 py-3 text-right">Owed</th></tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {shown.map(({ c, stats, recv }) => (
                <tr key={c.id} className="hover:bg-surface-hover">
                  <td className="px-4 py-3">
                    <Link href={`/owner/${c.id}`} className="font-medium text-primary hover:underline">{c.name}</Link>
                    <span className="mt-0.5 block text-xs text-muted">{c.code} · {c.hosting === "DEDICATED" ? "Own deployment" : "On this platform"}</span>
                  </td>
                  <td className="px-3 py-3"><Badge color={STATUS_COLOR[c.status as keyof typeof STATUS_COLOR] ?? "slate"}>{CUSTOMER_STATUS_LABEL[c.status] ?? c.status}</Badge></td>
                  <td className="px-3 py-3 text-secondary">{c.plan}<span className="block text-xs text-muted">{Number(c.planPriceAed) > 0 ? `${aed(Number(c.planPriceAed))} ${c.billingCycle === "YEARLY" ? "a year" : "a month"}` : "No price set"}</span></td>
                  <td className="tabular px-3 py-3 text-right text-secondary">{stats ? <>{stats.employees.toLocaleString("en-US")} {stats.employees === 1 ? "employee" : "employees"}<span className="block text-xs text-muted">{stats.users} {stats.users === 1 ? "user" : "users"}</span></> : <span className="text-muted">Not read yet</span>}</td>
                  <td className="px-3 py-3">
                    {stats ? (
                      <div className="w-40">
                        <div className="h-1.5 overflow-hidden rounded-full bg-surface-sunken"><div className={cn("h-full rounded-full", stats.ai.level === "out" ? "bg-[var(--error)]" : stats.ai.level === "warn" ? "bg-[var(--warning)]" : "bg-[var(--brand-primary)]")} style={{ width: `${Math.max(stats.ai.pct, stats.ai.pct > 0 ? 3 : 0)}%` }} /></div>
                        <span className="tabular mt-1 block text-xs text-muted">{Math.round(stats.ai.remaining).toLocaleString("en-US")} of {Math.round(stats.ai.total).toLocaleString("en-US")} left</span>
                      </div>
                    ) : <span className="text-muted">{c.aiMonthlyCredits.toLocaleString("en-US")} a month</span>}
                  </td>
                  <td className="px-3 py-3 text-secondary">{ago(stats?.lastActiveAt)}</td>
                  <td className={cn("tabular px-3 py-3 text-right", recv.overdue > 0 ? "font-medium text-[var(--error)]" : "text-secondary")}>{recv.owed > 0 ? aed(recv.owed) : "Nothing"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
