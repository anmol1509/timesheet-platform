import Link from "next/link";
import { Landmark } from "lucide-react";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/PageHeader";
import { suggestMatches } from "@/lib/books/reconcile";
import { r2 } from "@/lib/books/postings";
import { getBooksContext, iso } from "../books-data";
import { SetupCard } from "../setup-card";
import { ReconcileBoard, type LedgerRow, type StatementRow } from "./reconcile-board";

export const metadata = { title: "Bank reconciliation" };

export default async function BankPage({ searchParams }: { searchParams: Promise<{ account?: string }> }) {
  const ctx = await getBooksContext();
  const header = (right?: React.ReactNode) => <PageHeader title="Bank" icon={Landmark} breadcrumbs={[{ label: "Finance", href: "/finance/bills" }, { label: "Accounting", href: "/finance/books" }, { label: "Bank" }]} description="Upload the bank's statement and tick it off against the books." actions={right} />;
  if (!ctx.branch || !ctx.initialized) return <div className="space-y-5">{header()}<SetupCard isAdmin={ctx.isAdmin} /></div>;
  const branchId = ctx.branch.id;
  const sp = await searchParams;
  const accounts = await prisma.account.findMany({ where: { branchId, isActive: true }, orderBy: { code: "asc" }, select: { id: true, code: true, name: true, type: true, tag: true } });
  const money = accounts.filter((a) => a.type === "ASSET" && (a.tag === "BANK" || a.tag === "CASH" || /bank|cash/i.test(a.name)));
  const current = money.find((a) => a.id === sp.account) ?? money.find((a) => a.tag === "BANK") ?? money[0];
  if (!current) return <div className="space-y-5">{header()}<p className="text-sm text-muted">There is no bank account in your chart yet. Add one under Accounts.</p></div>;

  const stmt = await prisma.bankStatementLine.findMany({ where: { accountId: current.id }, orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: 2000 });
  const matchedIds = stmt.filter((s) => s.entryId).map((s) => s.entryId!);
  const from = stmt.length ? new Date(Math.min(...stmt.map((s) => s.date.getTime())) - 14 * 86_400_000) : null;
  const to = stmt.length ? new Date(Math.max(...stmt.map((s) => s.date.getTime())) + 14 * 86_400_000) : null;
  const lines = await prisma.journalLine.findMany({
    where: { accountId: current.id, entry: { status: "POSTED", ...(from && to ? { date: { gte: from, lte: to } } : {}) } },
    include: { entry: { select: { id: true, date: true, number: true, narration: true } } },
  });
  const byEntry = new Map<string, LedgerRow>();
  for (const l of lines) {
    const cur = byEntry.get(l.entryId) ?? { entryId: l.entryId, date: iso(l.entry.date), number: l.entry.number, narration: l.entry.narration, amount: 0 };
    cur.amount = r2(cur.amount + Number(l.debit) - Number(l.credit));
    byEntry.set(l.entryId, cur);
  }
  const ledger = [...byEntry.values()].filter((l) => l.amount !== 0);
  const matched = new Set(matchedIds);
  const entryInfo = new Map(ledger.map((l) => [l.entryId, l]));
  const missing = matchedIds.filter((id) => !entryInfo.has(id));
  if (missing.length) {
    const extra = await prisma.journalEntry.findMany({ where: { id: { in: missing } }, select: { id: true, date: true, number: true, narration: true } });
    for (const e of extra) entryInfo.set(e.id, { entryId: e.id, date: iso(e.date), number: e.number, narration: e.narration, amount: 0 });
  }
  const toRow = (s: (typeof stmt)[number]): StatementRow => ({ id: s.id, date: iso(s.date), description: s.description, reference: s.reference, amount: Number(s.amount), entry: s.entryId ? entryInfo.get(s.entryId) ?? null : null });
  const rows = stmt.map(toRow);
  const unmatchedStmt = rows.filter((r) => !r.entry);
  const unmatchedLedger = ledger.filter((l) => !matched.has(l.entryId));
  const suggestions = suggestMatches(unmatchedStmt, unmatchedLedger);

  const total = await prisma.journalLine.aggregate({ where: { accountId: current.id, entry: { status: "POSTED" } }, _sum: { debit: true, credit: true } });
  const ledgerBalance = r2(Number(total._sum.debit ?? 0) - Number(total._sum.credit ?? 0));
  const latest = stmt.slice().sort((a, b) => b.date.getTime() - a.date.getTime() || b.createdAt.getTime() - a.createdAt.getTime()).find((s) => s.balance !== null);
  return (
    <div className="space-y-5">
      {header(
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Bank account">
          {money.map((a) => <Link key={a.id} href={`/finance/books/bank?account=${a.id}`} className={`rounded-full border px-3 py-1 text-xs font-medium ${a.id === current.id ? "border-brand bg-brand-soft text-brand" : "border-default text-secondary hover:bg-surface-hover"}`}>{a.name}</Link>)}
        </div>,
      )}
      <ReconcileBoard
        accountId={current.id}
        accountName={current.name}
        canWrite={ctx.canWrite}
        ledgerBalance={ledgerBalance}
        statementBalance={latest ? Number(latest.balance) : null}
        statementBalanceDate={latest ? iso(latest.date) : null}
        statement={rows}
        unmatchedLedger={unmatchedLedger.sort((a, b) => (a.date < b.date ? 1 : -1))}
        suggestions={suggestions}
        counterAccounts={accounts.filter((a) => a.id !== current.id).map((a) => ({ id: a.id, label: `${a.code} · ${a.name}` }))}
      />
    </div>
  );
}
