import Link from "next/link";
import { ACCOUNT_TYPES, TYPE_LABEL } from "@/lib/books/chart";
import { normalBalance } from "@/lib/books/ledger";
import { accountsWithTotals, aed } from "../books-data";
import { AccountDialog } from "../accounts/account-dialog";

/** Every account the books post to, with its balance. Select one to see its ledger. */
export async function AccountsView({ branchId, canWrite, showHidden }: { branchId: string; canWrite: boolean; showHidden: boolean }) {
  const all = await accountsWithTotals(branchId);
  const rows = all.filter((a) => showHidden || a.isActive);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">Every account the accounting posts to. Select one to see its ledger.</p>
        {canWrite && <AccountDialog />}
      </div>
      {ACCOUNT_TYPES.map((t) => {
        const list = rows.filter((a) => a.type === t);
        if (list.length === 0) return null;
        const total = list.reduce((s, a) => s + normalBalance(a), 0);
        return (
          <section key={t} className="overflow-hidden rounded-[var(--radius-card)] border border-default bg-surface">
            <div className="flex items-center justify-between bg-[var(--surface-sunken)] px-4 py-2 text-sm font-semibold text-primary"><span>{TYPE_LABEL[t]}</span><span className="tabular">{aed(total)}</span></div>
            <ul className="divide-y divide-default">
              {list.map((a) => (
                <li key={a.id} className={`flex items-center gap-3 px-4 py-2 text-sm ${a.isActive ? "" : "opacity-50"}`}>
                  <span className="w-14 shrink-0 font-mono text-xs text-muted">{a.code}</span>
                  <Link href={`/finance/books/ledger/${a.id}`} className="min-w-0 flex-1 truncate text-primary hover:underline">{a.name}{a.isSystem ? <span className="ml-2 text-xs text-muted">automatic</span> : null}</Link>
                  <span className="tabular w-28 text-right">{aed(normalBalance(a))}</span>
                  <span className="w-8">{canWrite ? <AccountDialog account={a} /> : null}</span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      <p className="text-xs text-muted"><Link href={`/finance/books/reports?view=accounts${showHidden ? "" : "&hidden=1"}`} className="hover:underline">{showHidden ? "Hide unused accounts" : "Show hidden accounts"}</Link></p>
    </div>
  );
}
