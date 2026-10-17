import Link from "next/link";
import { BookOpen } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { ACCOUNT_TYPES, TYPE_LABEL } from "@/lib/books/chart";
import { normalBalance } from "@/lib/books/ledger";
import { accountsWithTotals, aed, getBooksContext } from "../books-data";
import { AccountDialog } from "./account-dialog";
import { SetupCard } from "../setup-card";

export const metadata = { title: "Chart of accounts" };

export default async function AccountsPage({ searchParams }: { searchParams: Promise<{ hidden?: string }> }) {
  const ctx = await getBooksContext();
  const { hidden } = await searchParams;
  const header = (actions?: React.ReactNode) => <PageHeader title="Chart of accounts" icon={BookOpen} breadcrumbs={[{ label: "Finance", href: "/finance/bills" }, { label: "Books", href: "/finance/books" }, { label: "Accounts" }]} description="Every account the books post to. Select one to see its ledger." actions={actions} />;
  if (!ctx.branch || !ctx.initialized) return <div className="space-y-5">{header()}<SetupCard isAdmin={ctx.isAdmin} /></div>;
  const all = await accountsWithTotals(ctx.branch.id);
  const showHidden = hidden === "1";
  const rows = all.filter((a) => showHidden || a.isActive);
  return (
    <div className="space-y-5">
      {header(ctx.canWrite ? <AccountDialog /> : undefined)}
      {ACCOUNT_TYPES.map((t) => {
        const list = rows.filter((a) => a.type === t);
        if (list.length === 0) return null;
        const total = list.reduce((s, a) => s + normalBalance(a), 0);
        return (
          <section key={t} className="overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface">
            <div className="flex items-center justify-between bg-[var(--surface-sunken)] px-4 py-2 text-sm font-semibold text-primary"><span>{TYPE_LABEL[t]}</span><span className="tabular">{aed(total)}</span></div>
            <ul className="divide-y divide-border">
              {list.map((a) => (
                <li key={a.id} className={`flex items-center gap-3 px-4 py-2 text-sm ${a.isActive ? "" : "opacity-50"}`}>
                  <span className="w-14 shrink-0 font-mono text-xs text-muted">{a.code}</span>
                  <Link href={`/finance/books/ledger/${a.id}`} className="min-w-0 flex-1 truncate text-primary hover:underline">{a.name}{a.isSystem ? <span className="ml-2 text-xs text-muted">automatic</span> : null}</Link>
                  <span className="tabular w-28 text-right">{aed(normalBalance(a))}</span>
                  <span className="w-8">{ctx.canWrite ? <AccountDialog account={a} /> : null}</span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      <p className="text-xs text-muted"><Link href={`/finance/books/accounts${showHidden ? "" : "?hidden=1"}`} className="hover:underline">{showHidden ? "Hide unused accounts" : "Show hidden accounts"}</Link></p>
    </div>
  );
}
