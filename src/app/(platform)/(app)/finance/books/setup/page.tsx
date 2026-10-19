import { BookOpen } from "lucide-react";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/PageHeader";
import { readPolicy } from "@/lib/books/accruals";
import { listBanks } from "@/lib/books/banks";
import type { CustomRule, RuleMethod } from "@/lib/books/customProvisions";
import { getBooksContext, iso } from "../books-data";
import { SetupCard } from "../setup-card";
import { ImportWizard } from "./import-wizard";
import { CustomProvisions, DefaultBanks, LockControl, OpeningBalancesEditor, ProvisionSettings, RefreshControl } from "./controls";

export const metadata = { title: "Accounting settings" };

function Card({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[var(--radius-card)] border border-default bg-surface p-5">
      <h2 className="text-sm font-semibold text-primary">{title}</h2>
      {hint && <p className="mb-4 mt-1 text-sm text-muted">{hint}</p>}
      {children}
    </section>
  );
}

export default async function SetupPage() {
  const ctx = await getBooksContext();
  const header = <PageHeader title="Settings" icon={BookOpen} breadcrumbs={[{ label: "Finance", href: "/finance/bills" }, { label: "Accounting", href: "/finance/books" }, { label: "Settings" }]} description="Bring balances over from Tally, Excel, Zoho Books or QuickBooks, and close finished periods." />;
  if (!ctx.branch || !ctx.initialized) return <div className="space-y-5">{header}<SetupCard isAdmin={ctx.isAdmin} /></div>;
  const branchId = ctx.branch.id;
  const open = iso(ctx.branch.booksOpeningDate!);
  const [accounts, opening, ruleRows] = await Promise.all([
    prisma.account.findMany({ where: { branchId, isActive: true }, orderBy: { code: "asc" }, select: { id: true, code: true, name: true, type: true, tag: true } }),
    prisma.journalEntry.findFirst({ where: { branchId, sourceKey: "opening" }, include: { lines: true } }),
    prisma.provisionRule.findMany({ where: { branchId }, orderBy: { createdAt: "asc" } }),
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
  const steps = [
    { n: 1, title: "Start date", note: `${open} ✓`, state: "done" },
    { n: 2, title: "Bring your balances", note: "Import from Tally, Excel, Zoho or QuickBooks", state: opening ? "done" : "now" },
    { n: 3, title: "Review & go live", note: "Check the tie-out, then lock the opening", state: opening ? "now" : "next" },
  ] as const;
  return (
    <div className="space-y-5">
      {header}
      {!opening && (
        <section className="rounded-[var(--radius-card)] border border-default bg-surface p-5" aria-label="Get started">
          <div className="flex items-center justify-between"><div><h2 className="text-sm font-semibold text-primary">Get started</h2><p className="mt-0.5 text-xs text-muted">Shown until your opening balances are in.</p></div><span className="rounded-full bg-info-soft px-2.5 py-0.5 text-[11px] font-semibold text-info">Step 2 of 3</span></div>
          <ol className="mt-4 grid gap-3 sm:grid-cols-3">
            {steps.map((s) => (
              <li key={s.n} className={`rounded-xl border p-3 text-sm ${s.state === "done" ? "border-[var(--success-border,var(--success))]" : s.state === "now" ? "border-brand" : "border-default"}`}>
                <p className="font-semibold text-primary">{s.n} · {s.title}</p><p className="text-xs text-muted">{s.note}</p>
              </li>
            ))}
          </ol>
        </section>
      )}
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
      <Card title="Default banks" hint="Invoices, bills and payroll runs can name the bank they used. When one doesn't, these decide which bank account the books use.">
        <DefaultBanks banks={await listBanks(branchId)} receipt={ctx.branch.defaultReceiptBankId ?? ""} payment={ctx.branch.defaultPaymentBankId ?? ""} canEdit={ctx.canWrite} />
      </Card>
      <Card title="Staff provisions" hint="Gratuity, leave and air tickets are paid later but earned every month. Switch them on and the books charge each finished month and build the liability on the balance sheet. See the amounts under Reports › Staff provisions.">
        <ProvisionSettings initial={{ gratuity: ctx.branch.accrueGratuity, leave: ctx.branch.accrueLeave, tickets: ctx.branch.accrueTickets }} policy={readPolicy(ctx.branch.provisionPolicy)} canEdit={ctx.canWrite} />
      </Card>
      <Card title="Your own provisions" hint="Anything else you owe later but earn now: an annual bonus, staff insurance, visa renewals, the yearly audit fee. Name it, say how it is worked out and how often it is paid.">
        <CustomProvisions rules={ruleRows.map((r) => ({ id: r.id, name: r.name, method: r.method as RuleMethod, amount: Number(r.amount), everyMonths: r.everyMonths, appliesTo: r.appliesTo as CustomRule["appliesTo"], active: r.active }))} canEdit={ctx.canWrite} />
      </Card>
      {ctx.canWrite && (
        <Card title="Automatic postings" hint="Invoices, supplier bills and payments, expenses, payroll and loans post by themselves. They refresh whenever the books are opened; use this to do it now.">
          <RefreshControl />
        </Card>
      )}
    </div>
  );
}
