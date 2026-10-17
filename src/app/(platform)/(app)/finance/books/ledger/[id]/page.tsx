import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpen } from "lucide-react";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/PageHeader";
import { isDebitNormal } from "@/lib/books/chart";
import { runningBalance } from "@/lib/books/ledger";
import { aed, fmtDate, getBooksContext } from "../../books-data";

export const metadata = { title: "Account ledger" };

export default async function LedgerPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getBooksContext();
  const { id } = await params;
  if (!ctx.branch) notFound();
  const account = await prisma.account.findUnique({ where: { id } });
  if (!account || account.branchId !== ctx.branch.id) notFound();
  const lines = await prisma.journalLine.findMany({
    where: { accountId: id, entry: { status: "POSTED" } },
    orderBy: [{ entry: { date: "asc" } }, { entry: { number: "asc" } }],
    include: { entry: { select: { date: true, number: true, narration: true } } },
  });
  const sign = isDebitNormal(account.type) ? 1 : -1;
  const rows = runningBalance(lines.map((l) => ({ date: l.entry.date, number: l.entry.number, narration: l.description || l.entry.narration, debit: Number(l.debit), credit: Number(l.credit) })), 0);
  const closing = rows.length ? rows[rows.length - 1].balance * sign : 0;
  return (
    <div className="space-y-5">
      <PageHeader title={`${account.code} · ${account.name}`} icon={BookOpen} breadcrumbs={[{ label: "Finance", href: "/finance/bills" }, { label: "Accounting", href: "/finance/books" }, { label: "Chart of accounts", href: "/finance/books/reports?view=accounts" }, { label: account.name }]} description={`Balance ${aed(closing)}`} />
      {rows.length === 0 ? <p className="text-sm text-muted">Nothing has been posted to this account yet.</p> : (
        <div className="overflow-x-auto rounded-[var(--radius-card)] border border-default bg-surface">
          <table className="w-full min-w-[38rem] text-sm">
            <thead className="bg-[var(--surface-sunken)] text-left text-xs text-muted"><tr><th className="px-4 py-2 font-medium">Date</th><th className="px-4 py-2 font-medium">No.</th><th className="px-4 py-2 font-medium">Narration</th><th className="px-4 py-2 text-right font-medium">Debit</th><th className="px-4 py-2 text-right font-medium">Credit</th><th className="px-4 py-2 text-right font-medium">Balance</th></tr></thead>
            <tbody className="divide-y divide-default">
              {rows.map((r, i) => (
                <tr key={i}>
                  <td className="whitespace-nowrap px-4 py-2">{fmtDate(r.date)}</td>
                  <td className="whitespace-nowrap px-4 py-2 font-mono text-xs">{r.number}</td>
                  <td className="px-4 py-2 text-secondary">{r.narration}</td>
                  <td className="tabular px-4 py-2 text-right">{r.debit ? aed(r.debit) : ""}</td>
                  <td className="tabular px-4 py-2 text-right">{r.credit ? aed(r.credit) : ""}</td>
                  <td className="tabular px-4 py-2 text-right font-medium">{aed(r.balance * sign)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Link href="/finance/books/reports?view=accounts" className="text-sm text-muted hover:underline">← Chart of accounts</Link>
    </div>
  );
}
