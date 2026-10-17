import Link from "next/link";
import { BookOpen } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { TYPE_LABEL } from "@/lib/books/chart";
import { netProfit, normalBalance, trialBalance } from "@/lib/books/ledger";
import { accountsWithTotals, aed, fmtDate, getBooksContext, iso } from "../books-data";
import { SetupCard } from "../setup-card";
import { AccountsView } from "./accounts-view";

export const metadata = { title: "Accounting reports" };
const VIEWS = [
  { k: "pnl", l: "Profit & loss" }, { k: "balance", l: "Balance sheet" }, { k: "vat", l: "VAT" }, { k: "trial", l: "Trial balance" }, { k: "accounts", l: "Chart of accounts" },
] as const;
type View = (typeof VIEWS)[number]["k"];

function Block({ title, rows, total, totalLabel }: { title: string; rows: { key: string; label: string; value: number }[]; total: number; totalLabel: string }) {
  return (
    <section className="overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface">
      <h3 className="bg-[var(--surface-sunken)] px-4 py-2 text-sm font-semibold text-primary">{title}</h3>
      <table className="w-full text-sm"><tbody className="divide-y divide-border">
        {rows.map((r) => <tr key={r.key}><td className="px-4 py-1.5 text-secondary">{r.label}</td><td className="tabular px-4 py-1.5 text-right">{aed(r.value)}</td></tr>)}
        <tr className="font-semibold"><td className="px-4 py-2">{totalLabel}</td><td className="tabular px-4 py-2 text-right">{aed(total)}</td></tr>
      </tbody></table>
    </section>
  );
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ view?: string; asof?: string; from?: string; hidden?: string }> }) {
  const ctx = await getBooksContext();
  const header = <PageHeader title="Reports" icon={BookOpen} breadcrumbs={[{ label: "Finance", href: "/finance/bills" }, { label: "Accounting", href: "/finance/books" }, { label: "Reports" }]} description="Profit & loss, balance sheet, VAT and the trial balance, straight from your transactions." />;
  if (!ctx.branch || !ctx.initialized) return <div className="space-y-5">{header}<SetupCard isAdmin={ctx.isAdmin} /></div>;
  const sp = await searchParams;
  const view: View = VIEWS.some((v) => v.k === sp.view) ? (sp.view as View) : "pnl";
  const switcher = (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Report">
      {VIEWS.map((v) => <Link key={v.k} href={`/finance/books/reports?view=${v.k}`} className={`rounded-full border px-3 py-1 text-xs font-medium ${view === v.k ? "border-accent bg-accent-soft text-accent" : "border-border text-secondary hover:bg-surface-hover"}`}>{v.l}</Link>)}
    </div>
  );
  if (view === "accounts") return <div className="space-y-5">{header}{switcher}<AccountsView branchId={ctx.branch.id} canWrite={ctx.canWrite} showHidden={sp.hidden === "1"} /></div>;

  const valid = (s?: string) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T00:00:00.000Z`) : null);
  const asOf = valid(sp.asof) ?? new Date(new Date().toISOString().slice(0, 10) + "T00:00:00.000Z");
  const open = ctx.branch.booksOpeningDate!;
  const from = valid(sp.from) ?? new Date(Date.UTC(asOf.getUTCFullYear(), 0, 1));
  const [cumulative, period] = await Promise.all([accountsWithTotals(ctx.branch.id, asOf), accountsWithTotals(ctx.branch.id, asOf, from)]);
  const plain = (a: (typeof cumulative)[number]) => ({ id: a.id, code: a.code, name: a.name, type: a.type, debit: a.debit, credit: a.credit });
  const ranged = view === "pnl" || view === "vat";
  const form = (
    <form className="flex flex-wrap items-end gap-3 text-sm">
      <input type="hidden" name="view" value={view} />
      {ranged && <label className="text-muted">From<input type="date" name="from" defaultValue={iso(from)} min={iso(open)} className="input mt-1 block h-9" /></label>}
      <label className="text-muted">{ranged ? "To" : "As of"}<input type="date" name="asof" defaultValue={iso(asOf)} className="input mt-1 block h-9" /></label>
      <button className="h-9 rounded-lg border border-border px-3 font-medium text-primary hover:bg-surface-hover">Update</button>
    </form>
  );

  let body: React.ReactNode;
  if (view === "pnl") {
    const income = period.filter((a) => a.type === "INCOME" && (a.debit || a.credit));
    const expense = period.filter((a) => a.type === "EXPENSE" && (a.debit || a.credit));
    const profit = netProfit(period.map(plain));
    body = (
      <div className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-2">
          <Block title={`Income, ${fmtDate(from)} – ${fmtDate(asOf)}`} rows={income.map((a) => ({ key: a.id, label: a.name, value: normalBalance(a) }))} total={income.reduce((s, a) => s + normalBalance(a), 0)} totalLabel="Total income" />
          <Block title="Costs" rows={expense.map((a) => ({ key: a.id, label: a.name, value: normalBalance(a) }))} total={expense.reduce((s, a) => s + normalBalance(a), 0)} totalLabel="Total costs" />
        </div>
        <div className={`flex justify-between rounded-[var(--radius-card)] border border-border bg-surface px-4 py-3 text-sm font-semibold ${profit < 0 ? "text-error" : "text-success"}`}><span>{profit < 0 ? "Loss" : "Profit"}</span><span className="tabular">{aed(profit)}</span></div>
      </div>
    );
  } else if (view === "balance") {
    const profitToDate = netProfit(cumulative.map(plain));
    const section = (t: string) => cumulative.filter((a) => a.type === t && (a.debit || a.credit));
    const sum = (t: string) => section(t).reduce((s, a) => s + normalBalance(a), 0);
    const assets = sum("ASSET"), liabilities = sum("LIABILITY"), equity = sum("EQUITY") + profitToDate;
    body = (
      <div className="grid gap-4 lg:grid-cols-2">
        <Block title={`${TYPE_LABEL.ASSET} as of ${fmtDate(asOf)}`} rows={section("ASSET").map((a) => ({ key: a.id, label: a.name, value: normalBalance(a) }))} total={assets} totalLabel="Total assets" />
        <div className="space-y-4">
          <Block title={TYPE_LABEL.LIABILITY} rows={section("LIABILITY").map((a) => ({ key: a.id, label: a.name, value: normalBalance(a) }))} total={liabilities} totalLabel="Total liabilities" />
          <Block title={TYPE_LABEL.EQUITY} rows={[...section("EQUITY").map((a) => ({ key: a.id, label: a.name, value: normalBalance(a) })), { key: "pl", label: "Profit to date", value: profitToDate }]} total={equity} totalLabel="Total equity" />
          <p className={`text-xs ${Math.abs(assets - liabilities - equity) < 0.005 ? "text-muted" : "text-error"}`}>Assets {aed(assets)} = liabilities + equity {aed(liabilities + equity)}</p>
        </div>
      </div>
    );
  } else if (view === "vat") {
    const vatOut = period.filter((a) => a.tag === "VAT_OUTPUT").reduce((n, a) => n + normalBalance(a), 0);
    const vatIn = period.filter((a) => a.tag === "VAT_INPUT").reduce((n, a) => n + normalBalance(a), 0);
    body = <div className="max-w-xl"><Block title={`VAT ${fmtDate(from)} – ${fmtDate(asOf)}`} rows={[{ key: "o", label: "VAT collected on sales (output)", value: vatOut }, { key: "i", label: "VAT paid on purchases and expenses (input)", value: vatIn }]} total={vatOut - vatIn} totalLabel={vatOut - vatIn >= 0 ? "VAT payable to FTA" : "VAT refundable"} /></div>;
  } else {
    const tb = trialBalance(cumulative);
    body = (
      <section className="overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface">
        <h3 className="flex items-center justify-between bg-[var(--surface-sunken)] px-4 py-2 text-sm font-semibold text-primary"><span>Trial balance as of {fmtDate(asOf)}</span><span className={tb.balanced ? "text-success" : "text-error"}>{tb.balanced ? "Balanced" : "Out of balance"}</span></h3>
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted"><tr><th className="px-4 py-2 font-medium">Account</th><th className="px-4 py-2 text-right font-medium">Debit</th><th className="px-4 py-2 text-right font-medium">Credit</th></tr></thead>
          <tbody className="divide-y divide-border">
            {tb.rows.map((r) => <tr key={r.id}><td className="px-4 py-1.5"><span className="mr-2 font-mono text-xs text-muted">{r.code}</span>{r.name}</td><td className="tabular px-4 py-1.5 text-right">{r.debitBalance ? aed(r.debitBalance) : ""}</td><td className="tabular px-4 py-1.5 text-right">{r.creditBalance ? aed(r.creditBalance) : ""}</td></tr>)}
            <tr className="font-semibold"><td className="px-4 py-2">Total</td><td className="tabular px-4 py-2 text-right">{aed(tb.debit)}</td><td className="tabular px-4 py-2 text-right">{aed(tb.credit)}</td></tr>
          </tbody>
        </table>
      </section>
    );
  }
  return <div className="space-y-5">{header}{switcher}{form}{body}</div>;
}
