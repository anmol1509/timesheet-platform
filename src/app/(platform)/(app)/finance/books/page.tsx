import Link from "next/link";
import { BookOpen } from "lucide-react";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/PageHeader";
import { StatTile } from "@/components/StatTile";
import { EmptyState } from "@/components/EmptyState";
import { normalBalance, netProfit } from "@/lib/books/ledger";
import { accountsWithTotals, aed, fmtDate, getBooksContext, iso } from "./books-data";
import { SetupCard } from "./setup-card";
import { VoucherDialog } from "./voucher-dialog";
import { VoidButton } from "./void-button";

export const metadata = { title: "Books" };
const TYPES = [
  { k: "", l: "All" }, { k: "JOURNAL", l: "Vouchers" }, { k: "SALES", l: "Sales" }, { k: "RECEIPT", l: "Receipts" },
  { k: "BILL", l: "Bills" }, { k: "PAYMENT", l: "Payments" }, { k: "EXPENSE", l: "Expenses" }, { k: "PAYROLL", l: "Payroll" },
];
const TYPE_LABEL: Record<string, string> = { JOURNAL: "Voucher", OPENING: "Opening", SALES: "Sales", RECEIPT: "Receipt", BILL: "Bill", PAYMENT: "Payment", EXPENSE: "Expense", PAYROLL: "Payroll", TRANSFER: "Transfer" };

export default async function BooksPage({ searchParams }: { searchParams: Promise<{ type?: string; q?: string }> }) {
  const ctx = await getBooksContext();
  const { type = "", q = "" } = await searchParams;
  const header = <PageHeader title="Books" icon={BookOpen} breadcrumbs={[{ label: "Finance", href: "/finance/bills" }, { label: "Books" }]} description="Every invoice, bill, payment, expense and payroll run, posted to the ledger as it happens." />;
  if (!ctx.branch || !ctx.initialized) return <div className="space-y-5">{header}<SetupCard isAdmin={ctx.isAdmin} /></div>;
  const branchId = ctx.branch.id;
  const yearStart = new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1));
  const [accounts, ytd, entries] = await Promise.all([
    accountsWithTotals(branchId),
    accountsWithTotals(branchId, undefined, yearStart),
    prisma.journalEntry.findMany({
      where: { branchId, ...(type ? { type } : {}), ...(q ? { OR: [{ narration: { contains: q, mode: "insensitive" } }, { number: { contains: q, mode: "insensitive" } }] } : {}) },
      orderBy: [{ date: "desc" }, { number: "desc" }],
      take: 200,
      include: { lines: { include: { account: { select: { code: true, name: true } } } } },
    }),
  ]);
  const bal = (tag: string) => accounts.filter((a) => a.tag === tag).reduce((s, a) => s + normalBalance(a), 0);
  const cash = bal("CASH") + bal("BANK");
  const profit = netProfit(ytd.map((a) => ({ id: a.id, code: a.code, name: a.name, type: a.type, debit: a.debit, credit: a.credit })));
  const options = accounts.filter((a) => a.isActive).map((a) => ({ id: a.id, label: `${a.code} · ${a.name}` }));
  const minDate = iso(ctx.branch.booksOpeningDate!);
  const lockedUntil = ctx.branch.booksLockedUntil;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Books"
        icon={BookOpen}
        breadcrumbs={[{ label: "Finance", href: "/finance/bills" }, { label: "Books" }]}
        description={`Posting from ${fmtDate(ctx.branch.booksOpeningDate!)}${lockedUntil ? ` · locked up to ${fmtDate(lockedUntil)}` : ""}`}
        actions={ctx.canWrite ? <VoucherDialog accounts={options} minDate={minDate} /> : undefined}
      />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Cash & bank" value={aed(cash).replace(/\.00$/, "")} />
        <StatTile label="Owed by clients" value={aed(bal("RECEIVABLE")).replace(/\.00$/, "")} />
        <StatTile label="Owed to suppliers" value={aed(bal("PAYABLE")).replace(/\.00$/, "")} />
        <StatTile label="Profit this year" value={aed(profit).replace(/\.00$/, "")} tone={profit < 0 ? "warning" : "default"} />
      </div>

      <form className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Entry type">
          {TYPES.map((t) => (
            <Link key={t.k} href={`/finance/books${t.k || q ? `?${new URLSearchParams({ ...(t.k ? { type: t.k } : {}), ...(q ? { q } : {}) })}` : ""}`} className={`rounded-full border px-3 py-1 text-xs font-medium ${type === t.k ? "border-accent bg-accent-soft text-accent" : "border-border text-secondary hover:bg-surface-hover"}`}>{t.l}</Link>
          ))}
        </div>
        {type && <input type="hidden" name="type" value={type} />}
        <input name="q" defaultValue={q} placeholder="Search narration or number" aria-label="Search entries" className="input ml-auto h-8 w-60 text-sm" />
      </form>

      {entries.length === 0 ? (
        <EmptyState title="Nothing posted yet" description="Entries appear here as invoices, bills, payments and expenses are recorded, or when you add a voucher." />
      ) : (
        <div className="overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="bg-[var(--surface-sunken)] text-left text-xs text-muted">
              <tr><th className="px-4 py-2 font-medium">Date</th><th className="px-4 py-2 font-medium">No.</th><th className="px-4 py-2 font-medium">Type</th><th className="px-4 py-2 font-medium">Narration</th><th className="px-4 py-2 text-right font-medium">Amount</th><th className="w-14" /></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {entries.map((e) => {
                const amount = e.lines.reduce((s, l) => s + Number(l.debit), 0);
                const void_ = e.status === "VOID";
                return (
                  <tr key={e.id} className={void_ ? "text-muted line-through" : ""}>
                    <td className="whitespace-nowrap px-4 py-2.5 align-top">{fmtDate(e.date)}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 align-top font-mono text-xs">{e.number}</td>
                    <td className="px-4 py-2.5 align-top text-secondary">{TYPE_LABEL[e.type] ?? e.type}</td>
                    <td className="px-4 py-2.5">
                      <details>
                        <summary className="cursor-pointer list-none text-primary">{e.narration}{void_ && e.voidReason ? ` — voided: ${e.voidReason}` : ""}</summary>
                        <table className="mt-2 w-full text-xs no-underline">
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
                    <td className="tabular whitespace-nowrap px-4 py-2.5 text-right align-top">{aed(amount)}</td>
                    <td className="px-2 py-2.5 text-right align-top">{!e.sourceKey && !void_ && ctx.canWrite ? <VoidButton id={e.id} number={e.number} /> : null}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {entries.length === 200 && <p className="border-t border-border px-4 py-2 text-xs text-muted">Showing the latest 200. Narrow with the filters above.</p>}
        </div>
      )}
    </div>
  );
}
