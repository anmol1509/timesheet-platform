import { Repeat } from "lucide-react";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/PageHeader";
import { FREQUENCY_LABEL, occurrences, type Frequency } from "@/lib/books/recurring";
import { aed, fmtDate, getBooksContext, iso } from "../books-data";
import { SetupCard } from "../setup-card";
import { RecurringActions, RecurringDialog } from "./recurring-forms";

export const metadata = { title: "Recurring entries" };

export default async function RecurringPage() {
  const ctx = await getBooksContext();
  const header = (right?: React.ReactNode) => <PageHeader title="Recurring entries" icon={Repeat} breadcrumbs={[{ label: "Finance", href: "/finance/bills" }, { label: "Accounting", href: "/finance/books" }, { label: "Recurring" }]} description="Entries that repeat, like rent or an instalment. They post themselves on each due date." actions={right} />;
  if (!ctx.branch || !ctx.initialized) return <div className="space-y-5">{header()}<SetupCard isAdmin={ctx.isAdmin} /></div>;
  const [rows, accounts] = await Promise.all([
    prisma.recurringEntry.findMany({ where: { branchId: ctx.branch.id }, orderBy: { createdAt: "asc" } }),
    prisma.account.findMany({ where: { branchId: ctx.branch.id }, orderBy: { code: "asc" }, select: { id: true, code: true, name: true, isActive: true } }),
  ]);
  const opts = accounts.filter((a) => a.isActive).map((a) => ({ id: a.id, label: `${a.code} · ${a.name}` }));
  const name = new Map(accounts.map((a) => [a.id, `${a.code} · ${a.name}`]));
  const now = new Date();
  const horizon = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 14, 1));
  const next = (r: (typeof rows)[number]) => {
    const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    return occurrences({ frequency: r.frequency as Frequency, startDate: r.startDate, endDate: r.endDate }, horizon).find((d) => d.getTime() > today) ?? null;
  };
  return (
    <div className="space-y-5">
      {header(ctx.canWrite ? <RecurringDialog accounts={opts} /> : undefined)}
      <section className="overflow-x-auto rounded-[var(--radius-card)] border border-default bg-surface">
        {rows.length === 0 ? <p className="px-4 py-8 text-center text-sm text-muted">Nothing recurring yet. Add rent, insurance or a loan instalment and it posts itself.</p> : (
          <table className="w-full text-sm">
            <thead className="bg-[var(--surface-sunken)] text-left text-xs text-muted"><tr><th className="px-4 py-2 font-medium">What</th><th className="px-3 py-2 font-medium">How often</th><th className="px-3 py-2 font-medium">Debit → Credit</th><th className="px-3 py-2 text-right font-medium">Amount</th><th className="px-3 py-2 font-medium">Next</th><th className="px-4 py-2" /></tr></thead>
            <tbody className="divide-y divide-default">
              {rows.map((r) => {
                const n = r.active ? next(r) : null;
                return (
                  <tr key={r.id} className={r.active ? "" : "text-muted"}>
                    <td className="px-4 py-2 font-medium text-primary">{r.name}{!r.active && <span className="ml-2 rounded-full bg-[var(--surface-sunken)] px-2 py-0.5 text-[11px] font-normal">Paused</span>}</td>
                    <td className="px-3 py-2">{FREQUENCY_LABEL[r.frequency as Frequency]}</td>
                    <td className="px-3 py-2 text-xs">{name.get(r.debitAccountId)} → {name.get(r.creditAccountId)}</td>
                    <td className="tabular px-3 py-2 text-right">{aed(Number(r.amount))}</td>
                    <td className="px-3 py-2">{n ? fmtDate(n) : "–"}</td>
                    <td className="px-4 py-1.5">{ctx.canWrite && <RecurringActions accounts={opts} row={{ id: r.id, name: r.name, frequency: r.frequency, startDate: iso(r.startDate), endDate: r.endDate ? iso(r.endDate) : "", debitAccountId: r.debitAccountId, creditAccountId: r.creditAccountId, amount: Number(r.amount), active: r.active }} />}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
