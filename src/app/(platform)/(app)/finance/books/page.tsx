import Link from "next/link";
import { BookOpen } from "lucide-react";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/PageHeader";
import { StatTile } from "@/components/StatTile";
import { EmptyState } from "@/components/EmptyState";
import { branchWhere } from "@/lib/branch";
import { entryFlow } from "@/lib/books/flow";
import { normalBalance, netProfit } from "@/lib/books/ledger";
import { accountsWithTotals, aed, fmtDate, getBooksContext, iso } from "./books-data";
import { SetupCard } from "./setup-card";
import { VoucherDialog } from "./voucher-dialog";
import { VoidButton } from "./void-button";
import { ReceivePayment } from "./receive-payment";
import { LockNow } from "./lock-now";

export const metadata = { title: "Accounting" };
const TYPES = [
  { k: "", l: "All" }, { k: "SALES", l: "Sales" }, { k: "RECEIPT", l: "Receipts" }, { k: "BILL", l: "Bills" }, { k: "PAYMENT", l: "Payments" },
  { k: "EXPENSE", l: "Expenses" }, { k: "PAYROLL", l: "Payroll" }, { k: "CREDIT_NOTE", l: "Credit notes" }, { k: "JOURNAL", l: "Vouchers" },
];
const TYPE_LABEL: Record<string, string> = { JOURNAL: "Voucher", OPENING: "Opening", SALES: "Sales", RECEIPT: "Receipt", BILL: "Bill", PAYMENT: "Payment", EXPENSE: "Expense", PAYROLL: "Payroll", TRANSFER: "Transfer", CREDIT_NOTE: "Credit note", DEBIT_NOTE: "Debit note" };
const TYPE_TONE: Record<string, string> = { SALES: "bg-blue-50 text-blue-700", RECEIPT: "bg-emerald-50 text-emerald-700", PAYMENT: "bg-amber-50 text-amber-800", BILL: "bg-amber-50 text-amber-800", EXPENSE: "bg-amber-50 text-amber-800", PAYROLL: "bg-amber-50 text-amber-800", CREDIT_NOTE: "bg-rose-50 text-rose-700", DEBIT_NOTE: "bg-rose-50 text-rose-700", JOURNAL: "bg-violet-50 text-violet-700" };
const isMoney = (a: { type: string; tag: string | null; name: string }) => a.type === "ASSET" && (a.tag === "CASH" || a.tag === "BANK" || /bank|cash/i.test(a.name));

export default async function TransactionsPage({ searchParams }: { searchParams: Promise<{ type?: string; q?: string }> }) {
  const ctx = await getBooksContext();
  const { type = "", q = "" } = await searchParams;
  const header = <PageHeader title="Accounting" icon={BookOpen} breadcrumbs={[{ label: "Finance", href: "/finance/bills" }, { label: "Accounting" }]} description="Everything that moves money, posted automatically. Open Settings to import from Tally." />;
  if (!ctx.branch || !ctx.initialized) return <div className="space-y-5">{header}<SetupCard isAdmin={ctx.isAdmin} /></div>;
  const branchId = ctx.branch.id;
  const today = new Date();
  const yearStart = new Date(Date.UTC(today.getUTCFullYear(), 0, 1));
  const [accounts, ytd, entries, unmatched, clients] = await Promise.all([
    accountsWithTotals(branchId),
    accountsWithTotals(branchId, undefined, yearStart),
    prisma.journalEntry.findMany({
      where: { branchId, ...(type ? { type } : {}), ...(q ? { OR: [{ narration: { contains: q, mode: "insensitive" } }, { number: { contains: q, mode: "insensitive" } }] } : {}) },
      orderBy: [{ date: "desc" }, { number: "desc" }],
      take: 200,
      include: { lines: { include: { account: { select: { code: true, name: true, type: true, tag: true } } } } },
    }),
    prisma.bankStatementLine.count({ where: { branchId, entryId: null } }),
    ctx.canWrite ? prisma.client.findMany({ where: branchWhere(branchId), select: { id: true, name: true }, orderBy: { name: "asc" } }) : Promise.resolve([]),
  ]);
  const bal = (tag: string) => accounts.filter((a) => a.tag === tag).reduce((s, a) => s + normalBalance(a), 0);
  const moneyAccts = accounts.filter((a) => a.isActive && isMoney(a));
  const cash = moneyAccts.reduce((s, a) => s + normalBalance(a), 0);
  const profit = netProfit(ytd.map((a) => ({ id: a.id, code: a.code, name: a.name, type: a.type, debit: a.debit, credit: a.credit })));
  const options = accounts.filter((a) => a.isActive).map((a) => ({ id: a.id, label: `${a.code} · ${a.name}` }));
  const minDate = iso(ctx.branch.booksOpeningDate!);
  const lockedUntil = ctx.branch.booksLockedUntil;

  // The latest month-end that finished at least 30 days ago and isn't locked yet: ready to close.
  const cutoff = new Date(today.getTime() - 30 * 86_400_000);
  const monthEnd = new Date(Date.UTC(cutoff.getUTCFullYear(), cutoff.getUTCMonth() + 1, 0));
  const lockCandidate = monthEnd.getTime() > cutoff.getTime() ? new Date(Date.UTC(cutoff.getUTCFullYear(), cutoff.getUTCMonth(), 0)) : monthEnd;
  const canLock = ctx.isAdmin && lockCandidate.getTime() > ctx.branch.booksOpeningDate!.getTime() && (!lockedUntil || lockCandidate.getTime() > lockedUntil.getTime());
  const rows = entries.map((e) => ({ e, flow: entryFlow(e.type, e.lines.map((l) => ({ money: isMoney(l.account), debit: Number(l.debit), credit: Number(l.credit) }))) }));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Accounting"
        icon={BookOpen}
        breadcrumbs={[{ label: "Finance", href: "/finance/bills" }, { label: "Accounting" }]}
        description={`Everything that moves money, posted automatically from ${fmtDate(ctx.branch.booksOpeningDate!)}${lockedUntil ? ` · locked up to ${fmtDate(lockedUntil)}` : ""}.`}
        actions={ctx.canWrite ? (
          <div className="flex gap-2">
            <ReceivePayment clients={clients} moneyAccounts={moneyAccts.map((a) => ({ id: a.id, label: `${a.code} · ${a.name}` }))} minDate={minDate} />
            <VoucherDialog accounts={options} minDate={minDate} label="New entry" />
          </div>
        ) : undefined}
      />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile href="/finance/books/bank" label="Cash & bank" value={aed(cash).replace(/\.00$/, "")} hint={`${moneyAccts.length} ${moneyAccts.length === 1 ? "account" : "accounts"}`} />
        <StatTile href="/finance/books/parties?type=CLIENT" label="Customers owe you" value={aed(bal("RECEIVABLE")).replace(/\.00$/, "")} hint="See who" />
        <StatTile href="/finance/books/parties?type=SUPPLIER" label="You owe suppliers" value={aed(bal("PAYABLE")).replace(/\.00$/, "")} hint="See who" />
        <StatTile href="/finance/books/reports" label="Profit this year" value={aed(profit).replace(/\.00$/, "")} tone={profit < 0 ? "warning" : "default"} hint={`Jan – ${today.toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" })}`} />
      </div>

      {(unmatched > 0 || canLock) && (
        <div className="divide-y divide-border overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface text-sm">
          {unmatched > 0 && (
            <div className="flex items-center gap-3 px-4 py-3"><span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" aria-hidden /><span className="flex-1"><b className="font-semibold text-primary">{unmatched} bank {unmatched === 1 ? "line is" : "lines are"} waiting to be matched</b></span><Link href="/finance/books/bank" className="rounded-lg border border-border px-3 py-1 text-xs font-medium text-primary hover:bg-surface-hover">Review</Link></div>
          )}
          {canLock && (
            <div className="flex items-center gap-3 px-4 py-3"><span className="h-2 w-2 shrink-0 rounded-full bg-indigo-500" aria-hidden /><span className="flex-1"><b className="font-semibold text-primary">{lockCandidate.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" })} is ready to lock</b><span className="text-muted"> · it ended over 30 days ago</span></span><LockNow date={iso(lockCandidate)} /></div>
          )}
        </div>
      )}

      <form className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Type">
          {TYPES.map((t) => (
            <Link key={t.k} href={`/finance/books${t.k || q ? `?${new URLSearchParams({ ...(t.k ? { type: t.k } : {}), ...(q ? { q } : {}) })}` : ""}`} className={`rounded-full border px-3 py-1 text-xs font-medium ${type === t.k ? "border-accent bg-accent-soft text-accent" : "border-border text-secondary hover:bg-surface-hover"}`}>{t.l}</Link>
          ))}
        </div>
        {type && <input type="hidden" name="type" value={type} />}
        <input name="q" defaultValue={q} placeholder="Search" aria-label="Search" className="input ml-auto h-8 w-60 text-sm" />
      </form>

      {rows.length === 0 ? (
        <EmptyState title="Nothing here yet" description="Transactions appear as invoices, bills, payments and expenses are recorded, or when you add an entry." />
      ) : (
        <div className="overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="bg-[var(--surface-sunken)] text-left text-xs text-muted">
              <tr><th className="px-4 py-2 font-medium">Date</th><th className="px-4 py-2 font-medium">What happened</th><th className="px-4 py-2 font-medium">Type</th><th className="px-4 py-2 text-right font-medium">Money in</th><th className="px-4 py-2 text-right font-medium">Money out</th><th className="w-12" /></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map(({ e, flow }) => {
                const void_ = e.status === "VOID";
                const money = (d: "in" | "out") => (flow.direction === d ? <span className={`tabular ${d === "in" ? "text-success" : "text-error"} ${flow.cash ? "" : "opacity-55"}`}>{aed(flow.amount)}</span> : null);
                return (
                  <tr key={e.id} className={void_ ? "text-muted line-through" : ""}>
                    <td className="whitespace-nowrap px-4 py-2.5 align-top text-muted">{fmtDate(e.date)}</td>
                    <td className="px-4 py-2.5">
                      <details>
                        <summary className="cursor-pointer list-none font-medium text-primary">{e.narration}{void_ && e.voidReason ? ` — voided: ${e.voidReason}` : ""}</summary>
                        <p className="mt-0.5 text-xs text-muted">{e.number}{flow.direction === null ? ` · ${aed(flow.amount)}` : ""}</p>
                        <table className="mt-2 w-full text-xs no-underline">
                          <thead><tr className="text-muted"><th className="py-0.5 pr-3 text-left font-normal">Account</th><th className="w-24 py-0.5 text-right font-normal">Debit</th><th className="w-24 py-0.5 text-right font-normal">Credit</th></tr></thead>
                          <tbody>
                            {e.lines.map((l) => (
                              <tr key={l.id} className="text-secondary">
                                <td className="py-0.5 pr-3"><Link href={`/finance/books/ledger/${l.accountId}`} className="hover:underline">{l.account.code} · {l.account.name}</Link></td>
                                <td className="tabular w-24 py-0.5 text-right">{Number(l.debit) ? aed(Number(l.debit)) : ""}</td>
                                <td className="tabular w-24 py-0.5 text-right">{Number(l.credit) ? aed(Number(l.credit)) : ""}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </details>
                    </td>
                    <td className="px-4 py-2.5 align-top"><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${TYPE_TONE[e.type] ?? "bg-slate-100 text-slate-600"}`}>{TYPE_LABEL[e.type] ?? e.type}</span></td>
                    <td className="px-4 py-2.5 text-right align-top">{money("in")}</td>
                    <td className="px-4 py-2.5 text-right align-top">{money("out")}</td>
                    <td className="px-2 py-2.5 text-right align-top">{!e.sourceKey && !void_ && ctx.canWrite ? <VoidButton id={e.id} number={e.number} /> : null}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="border-t border-border px-4 py-2 text-xs text-muted">Faded amounts haven&apos;t moved any cash yet (an invoice or bill not yet paid). Select a line to see the debit and credit behind it.{entries.length === 200 ? " Showing the latest 200." : ""}</p>
        </div>
      )}
    </div>
  );
}
