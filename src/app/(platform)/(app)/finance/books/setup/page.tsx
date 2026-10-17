import { BookOpen } from "lucide-react";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/PageHeader";
import { getBooksContext, iso } from "../books-data";
import { SetupCard } from "../setup-card";
import { ImportWizard } from "./import-wizard";
import { LockControl, OpeningBalancesEditor, RefreshControl } from "./controls";

export const metadata = { title: "Books set-up" };

function Card({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[var(--radius-card)] border border-border bg-surface p-5">
      <h2 className="text-sm font-semibold text-primary">{title}</h2>
      {hint && <p className="mb-4 mt-1 text-sm text-muted">{hint}</p>}
      {children}
    </section>
  );
}

export default async function SetupPage() {
  const ctx = await getBooksContext();
  const header = <PageHeader title="Set-up & import" icon={BookOpen} breadcrumbs={[{ label: "Finance", href: "/finance/books" }, { label: "Books", href: "/finance/books" }, { label: "Set-up" }]} description="Bring balances over from Tally, Excel, Zoho Books or QuickBooks, and close finished periods." />;
  if (!ctx.branch || !ctx.initialized) return <div className="space-y-5">{header}<SetupCard isAdmin={ctx.isAdmin} /></div>;
  const branchId = ctx.branch.id;
  const open = iso(ctx.branch.booksOpeningDate!);
  const [accounts, opening] = await Promise.all([
    prisma.account.findMany({ where: { branchId, isActive: true }, orderBy: { code: "asc" }, select: { id: true, code: true, name: true, type: true, tag: true } }),
    prisma.journalEntry.findFirst({ where: { branchId, sourceKey: "opening" }, include: { lines: true } }),
  ]);
  const byAcc = new Map<string, { debit: number; credit: number }>();
  for (const l of opening?.lines ?? []) {
    const c = byAcc.get(l.accountId) ?? { debit: 0, credit: 0 };
    byAcc.set(l.accountId, { debit: c.debit + Number(l.debit), credit: c.credit + Number(l.credit) });
  }
  // An account split across clients or suppliers shows its net, on whichever side it nets to.
  const net = (id: string) => { const v = byAcc.get(id); return v ? Math.round((v.debit - v.credit) * 100) / 100 : 0; };
  // Opening balance equity is the balancing figure, so it is not typed in.
  const editable = accounts.filter((a) => a.tag !== "OPENING_EQUITY").map((a) => ({ id: a.id, code: a.code, name: a.name, type: a.type, debit: net(a.id) > 0 ? net(a.id) : 0, credit: net(a.id) < 0 ? -net(a.id) : 0 }));
  return (
    <div className="space-y-5">
      {header}
      {ctx.canWrite && (
        <Card title="Import from another system" hint="Upload the trial balance you exported. Each ledger is matched to an account here, or a new one is created. Check the tie-out before importing.">
          <ImportWizard chart={accounts.map((a) => ({ id: a.id, code: a.code, name: a.name, type: a.type, tag: a.tag }))} openingDate={open} />
        </Card>
      )}
      <Card title="Opening balances" hint={`What each account held at the start, ${open}. Any difference goes to Opening balance equity.`}>
        <OpeningBalancesEditor key={editable.map((r) => `${r.id}:${r.debit}:${r.credit}`).join("|")} rows={editable} canEdit={ctx.canWrite} openingDate={open} />
      </Card>
      {ctx.isAdmin && (
        <Card title="Lock a period" hint="Once a month or year is reviewed, lock it. Nothing on or before the date can be added, changed or voided.">
          <LockControl lockedUntil={ctx.branch.booksLockedUntil ? iso(ctx.branch.booksLockedUntil) : null} minDate={open} />
        </Card>
      )}
      {ctx.canWrite && (
        <Card title="Automatic postings" hint="Invoices, supplier bills and payments, expenses, payroll and loans post by themselves. They refresh whenever the books are opened; use this to do it now.">
          <RefreshControl />
        </Card>
      )}
    </div>
  );
}
