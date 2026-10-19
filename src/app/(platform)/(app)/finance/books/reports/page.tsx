import Link from "next/link";
import { BookOpen } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { TYPE_LABEL } from "@/lib/books/chart";
import { netProfit, normalBalance, trialBalance } from "@/lib/books/ledger";
import { accountsWithTotals, aed, fmtDate, getBooksContext, iso } from "../books-data";
import { readPolicy } from "@/lib/books/accruals";
import { SetupCard } from "../setup-card";
import { AccountsView } from "./accounts-view";
import { ExportBar } from "./export-bar";
import { AgeingView, CashFlowView, ProjectProfitView, ProvisionsView, VatReturnView } from "./extra-views";

export const metadata = { title: "Accounting reports" };
const VIEWS = [
  { k: "pnl", l: "Profit & loss" }, { k: "balance", l: "Balance sheet" }, { k: "cash", l: "Cash flow" }, { k: "ar", l: "Who owes you" }, { k: "ap", l: "Who you owe" }, { k: "project", l: "Profit by project" }, { k: "provisions", l: "Staff provisions" }, { k: "vat", l: "VAT return" }, { k: "trial", l: "Trial balance" }, { k: "accounts", l: "Chart of accounts" },
] as const;
type View = (typeof VIEWS)[number]["k"];

function Block({ title, rows, total, totalLabel }: { title: string; rows: { key: string; label: string; value: number }[]; total: number; totalLabel: string }) {
  return (
    <section className="overflow-x-auto rounded-[var(--radius-card)] border border-default bg-surface">
      <h3 className="bg-[var(--surface-sunken)] px-4 py-2 text-sm font-semibold text-primary">{title}</h3>
      <table className="w-full text-sm"><tbody className="divide-y divide-default">
        {rows.map((r) => <tr key={r.key}><td className="px-4 py-1.5 text-secondary">{r.label}</td><td className="tabular px-4 py-1.5 text-right">{aed(r.value)}</td></tr>)}
        <tr className="font-semibold"><td className="px-4 py-2">{totalLabel}</td><td className="tabular px-4 py-2 text-right">{aed(total)}</td></tr>
      </tbody></table>
    </section>
  );
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ view?: string; asof?: string; from?: string; hidden?: string; ex?: string; rs?: string; re?: string; ia?: string; iv?: string }> }) {
  const ctx = await getBooksContext();
  const header = <PageHeader title="Reports" icon={BookOpen} breadcrumbs={[{ label: "Finance", href: "/finance/bills" }, { label: "Accounting", href: "/finance/books" }, { label: "Reports" }]} description="Profit & loss, balance sheet, cash flow, who owes whom, profit by project, VAT and the trial balance, straight from your transactions." />;
  if (!ctx.branch || !ctx.initialized) return <div className="space-y-5">{header}<SetupCard isAdmin={ctx.isAdmin} /></div>;
  const sp = await searchParams;
  const view: View = VIEWS.some((v) => v.k === sp.view) ? (sp.view as View) : "pnl";
  const switcher = (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Report">
      {VIEWS.map((v) => <Link key={v.k} href={`/finance/books/reports?view=${v.k}`} className={`rounded-full border px-3 py-1 text-xs font-medium ${view === v.k ? "border-brand bg-brand-soft text-brand" : "border-default text-secondary hover:bg-surface-hover"}`}>{v.l}</Link>)}
    </div>
  );
  if (view === "accounts") return <div className="space-y-5">{header}{switcher}<AccountsView branchId={ctx.branch.id} canWrite={ctx.canWrite} showHidden={sp.hidden === "1"} /></div>;

  const valid = (s?: string) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T00:00:00.000Z`) : null);
  const asOf = valid(sp.asof) ?? new Date(new Date().toISOString().slice(0, 10) + "T00:00:00.000Z");
  const open = ctx.branch.booksOpeningDate!;
  const from = valid(sp.from) ?? new Date(Date.UTC(asOf.getUTCFullYear(), 0, 1));
  const [cumulative, period] = await Promise.all([accountsWithTotals(ctx.branch.id, asOf), accountsWithTotals(ctx.branch.id, asOf, from, true)]);
  const plain = (a: (typeof cumulative)[number]) => ({ id: a.id, code: a.code, name: a.name, type: a.type, debit: a.debit, credit: a.credit });
  const ranged = view === "pnl" || view === "vat" || view === "cash" || view === "project";
  const form = (
    <form className="flex flex-wrap items-end gap-3 text-sm">
      <input type="hidden" name="view" value={view} />
      {ranged && <label className="text-muted">From<input type="date" name="from" defaultValue={iso(from)} min={iso(open)} className="input mt-1 block h-9" /></label>}
      <label className="text-muted">{ranged ? "To" : "As of"}<input type="date" name="asof" defaultValue={iso(asOf)} className="input mt-1 block h-9" /></label>
      <button className="h-9 rounded-lg border border-default px-3 font-medium text-primary hover:bg-surface-hover">Update</button>
    </form>
  );

  let body: React.ReactNode;
  if (view === "ar" || view === "ap") {
    body = <AgeingView branchId={ctx.branch.id} asOf={asOf} side={view === "ar" ? "RECEIVABLE" : "PAYABLE"} />;
  } else if (view === "provisions") {
    body = <ProvisionsView branchId={ctx.branch.id} asOf={asOf} on={{ gratuity: ctx.branch.accrueGratuity, leave: ctx.branch.accrueLeave, tickets: ctx.branch.accrueTickets }} policy={readPolicy(ctx.branch.provisionPolicy)} />;
  } else if (view === "cash") {
    body = <CashFlowView branchId={ctx.branch.id} from={from} asOf={asOf} />;
  } else if (view === "project") {
    body = <ProjectProfitView branchId={ctx.branch.id} from={from} asOf={asOf} />;
  } else if (view === "pnl") {
    const income = period.filter((a) => a.type === "INCOME" && (a.debit || a.credit));
    const expense = period.filter((a) => a.type === "EXPENSE" && (a.debit || a.credit));
    const profit = netProfit(period.map(plain));
    body = (
      <div className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-2">
          <Block title={`Income, ${fmtDate(from)} – ${fmtDate(asOf)}`} rows={income.map((a) => ({ key: a.id, label: a.name, value: normalBalance(a) }))} total={income.reduce((s, a) => s + normalBalance(a), 0)} totalLabel="Total income" />
          <Block title="Costs" rows={expense.map((a) => ({ key: a.id, label: a.name, value: normalBalance(a) }))} total={expense.reduce((s, a) => s + normalBalance(a), 0)} totalLabel="Total costs" />
        </div>
        <div className={`flex justify-between rounded-[var(--radius-card)] border border-default bg-surface px-4 py-3 text-sm font-semibold ${profit < 0 ? "text-error" : "text-success"}`}><span>{profit < 0 ? "Loss" : "Profit"}</span><span className="tabular">{aed(profit)}</span></div>
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
    const n = (v?: string) => { const x = Number((v ?? "").replace(/,/g, "")); return Number.isFinite(x) && x > 0 ? x : undefined; };
    body = <VatReturnView branchId={ctx.branch.id} from={from} asOf={asOf} manual={{ exempt: n(sp.ex), reverseSales: n(sp.rs), reverseExpenses: n(sp.re), importsAmount: n(sp.ia), importsVat: n(sp.iv) }} />;
  } else {
    const tb = trialBalance(cumulative);
    body = (
      <section className="overflow-x-auto rounded-[var(--radius-card)] border border-default bg-surface">
        <h3 className="flex items-center justify-between bg-[var(--surface-sunken)] px-4 py-2 text-sm font-semibold text-primary"><span>Trial balance as of {fmtDate(asOf)}</span><span className={tb.balanced ? "text-success" : "text-error"}>{tb.balanced ? "Balanced" : "Out of balance"}</span></h3>
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted"><tr><th className="px-4 py-2 font-medium">Account</th><th className="px-4 py-2 text-right font-medium">Debit</th><th className="px-4 py-2 text-right font-medium">Credit</th></tr></thead>
          <tbody className="divide-y divide-default">
            {tb.rows.map((r) => <tr key={r.id}><td className="px-4 py-1.5"><span className="mr-2 font-mono text-xs text-muted">{r.code}</span>{r.name}</td><td className="tabular px-4 py-1.5 text-right">{r.debitBalance ? aed(r.debitBalance) : ""}</td><td className="tabular px-4 py-1.5 text-right">{r.creditBalance ? aed(r.creditBalance) : ""}</td></tr>)}
            <tr className="font-semibold"><td className="px-4 py-2">Total</td><td className="tabular px-4 py-2 text-right">{aed(tb.debit)}</td><td className="tabular px-4 py-2 text-right">{aed(tb.credit)}</td></tr>
          </tbody>
        </table>
      </section>
    );
  }
  const keep = new URLSearchParams({ view, from: iso(from), asof: iso(asOf) });
  for (const k of ["ex", "rs", "re", "ia", "iv"] as const) if (sp[k]) keep.set(k, sp[k] as string);
  const title = VIEWS.find((v) => v.k === view)?.l ?? "";
  return (
    <div className="space-y-5">
      {header}
      <div data-print-hide>{switcher}</div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div data-print-hide>{form}</div>
        <ExportBar query={keep.toString()} canExport={view !== "provisions"} />
      </div>
      <div className="hidden print:block">
        <p className="text-lg font-semibold text-primary">{ctx.branch.name}</p>
        <p className="text-sm text-secondary">{title}{ranged ? `, ${fmtDate(from)} – ${fmtDate(asOf)}` : ` as of ${fmtDate(asOf)}`}</p>
      </div>
      {body}
    </div>
  );
}
