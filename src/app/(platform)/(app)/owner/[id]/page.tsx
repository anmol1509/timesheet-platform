import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, ExternalLink, Printer } from "lucide-react";
import { HeroHeader } from "@/components/HeroHeader";
import { Badge } from "@/components/Badge";
import { prisma } from "@/lib/db";
import { requireOwner } from "@/lib/ownerServer";
import { CUSTOMER_STATUS_LABEL, creditsValueAed, monthlyEquivalent, outstanding, receivable } from "@/lib/owner";
import type { CustomerStats } from "@/lib/ownerStats";
import { cn } from "@/lib/cn";
import { CreditsForms, EditForm, InvoiceForm, NoteForm, PaymentForm, StatusForm, SyncForm, VoidForm } from "./panels";

export const metadata = { title: "Customer" };

const aed = (n: number) => `AED ${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const num = (n: number) => Math.round(n).toLocaleString("en-US");
const day = (d: Date | string | null | undefined) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "Not set");
const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");
const STATUS_COLOR = { TRIAL: "blue", ACTIVE: "green", SUSPENDED: "amber", CHURNED: "slate" } as const;
const INVOICE_COLOR = { SENT: "amber", PAID: "green", VOID: "slate", DRAFT: "slate" } as const;

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  await requireOwner();
  const { id } = await params;
  const c = await prisma.customer.findUnique({
    where: { id },
    include: { invoices: { orderBy: { issueDate: "desc" }, include: { payments: { select: { amount: true } } } }, payments: { orderBy: { receivedOn: "desc" }, take: 20, include: { invoice: { select: { number: true } } } }, events: { orderBy: { createdAt: "desc" }, take: 40 } },
  });
  if (!c) notFound();
  const stats = (c.lastStats ?? null) as CustomerStats | null;
  const rate = Number(c.aiRateAed);
  const invoices = c.invoices.map((i) => ({ ...i, total: Number(i.total), paid: i.payments.reduce((s, p) => s + Number(p.amount), 0) }));
  const recv = receivable(invoices.map((i) => ({ status: i.status, total: i.total, dueDate: i.dueDate, paid: i.paid })));
  const today = new Date().toISOString().slice(0, 10);
  const total = stats?.ai.total ?? c.aiMonthlyCredits;
  const used = stats?.ai.used ?? 0;

  return (
    <div className="space-y-6">
      <Link href="/owner" className="inline-flex items-center gap-1 text-sm text-muted hover:text-primary"><ArrowLeft className="h-4 w-4" aria-hidden />Customers</Link>
      <HeroHeader
        icon={Building2}
        title={c.name}
        subtitle={`${c.code} · ${c.hosting === "DEDICATED" ? "Own database and deployment" : "On this platform"} · customer since ${day(c.startedOn)}`}
        pills={[
          { label: "Status", value: CUSTOMER_STATUS_LABEL[c.status] ?? c.status, warn: c.status === "SUSPENDED" },
          { label: "Plan", value: `${c.plan}${Number(c.planPriceAed) > 0 ? ` · ${aed(monthlyEquivalent(Number(c.planPriceAed), c.billingCycle))} a month` : ""}` },
          { label: "AI credits left", value: num(Math.max(0, total - used)), warn: stats?.ai.level !== undefined && stats.ai.level !== "ok" },
          { label: "Owed", value: aed(recv.owed), warn: recv.overdue > 0 },
        ]}
        actions={c.appUrl ? <a href={c.appUrl} target="_blank" rel="noreferrer" className="btn inline-flex items-center gap-1.5 bg-white text-[#43359f] hover:bg-white/90"><ExternalLink className="h-4 w-4" aria-hidden />Open their app</a> : undefined}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="card overflow-hidden">
            <h2 className="border-b border-default px-4 py-3 text-sm font-semibold text-primary">Billing</h2>
            {invoices.length === 0 ? <p className="px-4 py-6 text-sm text-muted">No invoices yet.</p> : (
              <div className="overflow-x-auto"><table className="w-full min-w-[40rem] text-sm">
                <thead className="bg-surface-subtle text-left text-xs font-medium tracking-wide text-muted uppercase"><tr><th className="px-4 py-2.5">Invoice</th><th className="px-3 py-2.5">For</th><th className="px-3 py-2.5 text-right">Total</th><th className="px-3 py-2.5 text-right">Left</th><th className="px-3 py-2.5">Due</th><th className="px-3 py-2.5">Status</th><th className="px-3 py-2.5" /></tr></thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {invoices.map((i) => {
                    const left = outstanding(i.total, i.paid);
                    return (
                      <tr key={i.id} className="align-top">
                        <td className="px-4 py-3 font-medium text-primary">{i.number}<span className="block text-xs font-normal text-muted">{day(i.issueDate)}</span></td>
                        <td className="max-w-[16rem] px-3 py-3 text-secondary">{i.description}</td>
                        <td className="tabular px-3 py-3 text-right text-secondary">{aed(i.total)}</td>
                        <td className={cn("tabular px-3 py-3 text-right", i.status === "SENT" && left > 0 && i.dueDate.getTime() < Date.now() ? "font-medium text-[var(--error)]" : "text-secondary")}>{i.status === "SENT" ? aed(left) : "-"}</td>
                        <td className="px-3 py-3 text-secondary">{day(i.dueDate)}</td>
                        <td className="px-3 py-3"><Badge color={INVOICE_COLOR[i.status as keyof typeof INVOICE_COLOR] ?? "slate"}>{i.status === "SENT" ? (left < i.total ? "Part paid" : "Unpaid") : i.status === "PAID" ? "Paid" : i.status === "VOID" ? "Void" : "Draft"}</Badge></td>
                        <td className="px-3 py-3 text-right"><Link href={`/owner/${c.id}/invoice/${i.id}`} className="inline-flex items-center gap-1 text-xs text-[var(--brand-primary)] hover:underline" target="_blank"><Printer className="h-3.5 w-3.5" aria-hidden />Print</Link></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table></div>
            )}
            <div className="grid gap-6 border-t border-default p-4 lg:grid-cols-2">
              <div><h3 className="mb-3 text-sm font-semibold text-primary">Raise an invoice</h3><InvoiceForm id={c.id} today={today} /></div>
              <div><h3 className="mb-3 text-sm font-semibold text-primary">Record money received</h3>
                <PaymentForm id={c.id} />
                {invoices.some((i) => i.status === "SENT" && outstanding(i.total, i.paid) > 0) && (
                  <details className="mt-4 text-sm"><summary className="cursor-pointer text-secondary">Pay off a specific invoice</summary>
                    <div className="mt-3 space-y-4">{invoices.filter((i) => i.status === "SENT" && outstanding(i.total, i.paid) > 0).map((i) => (
                      <div key={i.id} className="rounded-lg border border-default p-3"><p className="mb-2 text-xs font-medium text-primary">{i.number}, {aed(outstanding(i.total, i.paid))} left</p><PaymentForm id={c.id} invoiceId={i.id} left={outstanding(i.total, i.paid)} /><div className="mt-2"><VoidForm invoiceId={i.id} /></div></div>
                    ))}</div>
                  </details>
                )}
              </div>
            </div>
            {c.payments.length > 0 && (
              <div className="border-t border-default px-4 py-3"><h3 className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">Received</h3>
                <ul className="divide-y divide-[var(--border)] text-sm">{c.payments.map((p) => <li key={p.id} className="flex items-center justify-between gap-3 py-2"><span className="text-primary">{aed(Number(p.amount))}<span className="ml-2 text-xs text-muted">{p.invoice?.number ?? "On account"} · {p.method.toLowerCase()}{p.reference ? ` · ${p.reference}` : ""}</span></span><span className="text-xs text-muted">{day(p.receivedOn)}</span></li>)}</ul>
              </div>
            )}
          </section>

          <section className="card overflow-hidden">
            <h2 className="border-b border-default px-4 py-3 text-sm font-semibold text-primary">Activity</h2>
            <div className="border-b border-default p-4"><NoteForm id={c.id} /></div>
            <ul className="divide-y divide-[var(--border)] text-sm">
              {c.events.length === 0 && <li className="px-4 py-6 text-muted">Nothing yet.</li>}
              {c.events.map((e) => <li key={e.id} className="flex items-start justify-between gap-3 px-4 py-2.5"><span className="text-primary">{e.text}<span className="ml-2 text-xs text-muted">{e.byName ?? ""}</span></span><span className="shrink-0 text-xs text-muted">{day(e.createdAt)}</span></li>)}
            </ul>
          </section>

          <details className="card p-4"><summary className="cursor-pointer text-sm font-semibold text-primary">Details and contact</summary>
            <div className="mt-4"><EditForm c={{ id: c.id, name: c.name, contactName: c.contactName, contactEmail: c.contactEmail, contactPhone: c.contactPhone, address: c.address, trn: c.trn, plan: c.plan, planPriceAed: String(Number(c.planPriceAed)), billingCycle: c.billingCycle, renewsOn: iso(c.renewsOn), aiRateAed: String(Number(c.aiRateAed)), notes: c.notes, hosting: c.hosting, appUrl: c.appUrl, supabaseRef: c.supabaseRef, vercelProject: c.vercelProject }} /></div>
          </details>
        </div>

        <div className="space-y-6">
          <section className="card space-y-3 p-4">
            <div className="flex items-center justify-between"><h2 className="text-sm font-semibold text-primary">Usage</h2>{stats && <Badge color={stats.suspended ? "amber" : "green"}>{stats.suspended ? "Locked" : "Open"}</Badge>}</div>
            {stats ? (
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                {([["Employees", num(stats.employees)], ["Active employees", num(stats.activeEmployees)], ["Users", num(stats.users)], ["Payroll runs", num(stats.payrollRuns)], ["Last payroll", stats.lastPayrollMonth ?? "None yet"], ["Last active", stats.lastActiveAt ? day(stats.lastActiveAt) : "Never"], ["App version", stats.version ?? "Unknown"], ["Read", c.lastSyncAt ? day(c.lastSyncAt) : "Never"]] as const).map(([k, v]) => <div key={k}><dt className="text-xs text-muted">{k}</dt><dd className="tabular font-medium text-primary">{v}</dd></div>)}
              </dl>
            ) : <p className="text-sm text-muted">Not read yet.</p>}
            <SyncForm id={c.id} />
          </section>

          <section className="card space-y-4 p-4">
            <h2 className="text-sm font-semibold text-primary">AI credits</h2>
            <div>
              <div className="h-2.5 overflow-hidden rounded-full bg-surface-sunken"><div className={cn("h-full rounded-full", stats?.ai.level === "out" ? "bg-[var(--error)]" : stats?.ai.level === "warn" ? "bg-[var(--warning)]" : "bg-[var(--brand-primary)]")} style={{ width: `${Math.max(stats?.ai.pct ?? 0, (stats?.ai.pct ?? 0) > 0 ? 3 : 0)}%` }} /></div>
              <p className="tabular mt-1.5 text-sm text-secondary">{num(Math.max(0, total - used))} of {num(total)} credits left this month</p>
            </div>
            <div className="rounded-lg border border-default bg-surface-sunken p-3 text-xs text-secondary">
              <p className="mb-1 font-medium text-primary">What it is worth to you (they never see this)</p>
              <p>Monthly allowance {num(c.aiMonthlyCredits)} credits = {aed(creditsValueAed(c.aiMonthlyCredits, rate))}</p>
              <p>Used this month {num(used)} credits = {aed(creditsValueAed(used, rate))}</p>
              <p>At {rate} AED a credit</p>
            </div>
            <CreditsForms id={c.id} allowance={c.aiMonthlyCredits} />
          </section>

          <section className="card space-y-3 p-4">
            <h2 className="text-sm font-semibold text-primary">Account</h2>
            <p className="text-sm text-secondary">{c.contactName ? `${c.contactName}, ` : ""}{c.contactEmail}{c.contactPhone ? ` · ${c.contactPhone}` : ""}</p>
            <StatusForm id={c.id} status={c.status} />
            <p className="text-xs text-muted">Suspended locks out their own people and puts the app on hold. It does not delete anything.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
