"use client";

import { useActionState, useState } from "react";
import { Plus, Wallet } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { Select } from "@/components/ui/Select";
import { EXPENSE_CATEGORIES } from "@/lib/financeConstants";
import { addPettyCashTopUpAction, saveBudgetAction, setExpenseLimitAction } from "../actions";

type State = { error: string | null; ok?: boolean };
const aed = (n: number) => n.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export type BudgetRow = { category: string; limit: number; spent: number; pct: number; state: "OK" | "NEAR" | "OVER" };
const BAR = { OK: "bg-[var(--brand-primary)]", NEAR: "bg-[var(--warning)]", OVER: "bg-[var(--error)]" } as const;

function Inline({ action, children, submit }: { action: (fd: FormData) => void; children: React.ReactNode; submit: string }) {
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      {children}
      <button type="submit" className="btn btn-secondary">{submit}</button>
    </form>
  );
}

/**
 * Budgets, approval limit and petty cash — the controls that shape how
 * expenses are approved, kept beside the list they govern.
 */
export function ExpenseTools({
  budgets,
  limit,
  petty,
  canManage,
  canTopUp,
}: {
  budgets: BudgetRow[];
  limit: number | null;
  petty: { balance: number; toppedUp: number; spent: number };
  canManage: boolean;
  canTopUp: boolean;
}) {
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [bState, bAction] = useActionState(async (p: State, fd: FormData) => saveBudgetAction(p, fd), { error: null } as State);
  const [lState, lAction] = useActionState(async (p: State, fd: FormData) => setExpenseLimitAction(p, fd), { error: null } as State);
  const [tState, tAction, tPending] = useActionState(
    async (p: State, fd: FormData) => {
      const r = await addPettyCashTopUpAction(p, fd);
      if (r.ok) setTopUpOpen(false);
      return r;
    },
    { error: null } as State
  );

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <section className="card p-5 lg:col-span-2">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-primary">Budgets this month</h2>
          {canManage && <button type="button" className="text-xs font-medium text-[var(--brand-primary)] hover:underline" onClick={() => setBudgetOpen(true)}>Set budgets</button>}
        </div>
        {budgets.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No budgets set. Give a category a monthly cap and its approved spend is tracked against it here.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {budgets.map((b) => (
              <li key={b.category}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-secondary">{b.category}</span>
                  <span className={`tabular ${b.state === "OVER" ? "font-medium text-[var(--error)]" : "text-primary"}`}>AED {aed(b.spent)} <span className="text-xs font-normal text-subtle">of {aed(b.limit)}</span></span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--surface-sunken)]">
                  <div className={`h-full rounded-full ${BAR[b.state]}`} style={{ width: `${Math.min(100, b.pct)}%` }} />
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-5 border-t border-default pt-4">
          <p className="mb-1.5 text-xs font-medium text-muted">Approval limit for non-admin approvers</p>
          {canManage ? (
            <Inline action={lAction} submit="Save">
              <input type="number" step="0.01" min="0" name="limit" defaultValue={limit ?? ""} placeholder="No limit" className="input w-40" aria-label="Approval limit (AED)" />
            </Inline>
          ) : (
            <p className="text-sm text-secondary">{limit === null ? "No limit" : `AED ${aed(limit)}`}</p>
          )}
          {lState.error && <p role="alert" className="mt-1 text-xs text-[var(--error)]">{lState.error}</p>}
          {lState.ok && <p className="mt-1 text-xs text-[var(--success)]">Saved</p>}
          <p className="mt-1.5 text-xs text-subtle">Expenses above this can only be approved by an admin.</p>
        </div>
      </section>

      <section className="card p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-primary"><Wallet className="h-4 w-4 text-subtle" aria-hidden />Petty cash</h2>
          {canTopUp && <button type="button" className="inline-flex items-center gap-1 text-xs font-medium text-[var(--brand-primary)] hover:underline" onClick={() => setTopUpOpen(true)}><Plus className="h-3 w-3" aria-hidden />Top up</button>}
        </div>
        <p className={`tabular mt-3 text-3xl font-semibold tracking-tight ${petty.balance < 0 ? "text-[var(--error)]" : "text-primary"}`}>AED {aed(petty.balance)}</p>
        <p className="mt-1 text-xs text-subtle">AED {aed(petty.toppedUp)} put in · AED {aed(petty.spent)} spent in approved cash expenses</p>
        {petty.balance < 0 && <p className="mt-2 text-xs text-[var(--error)]">More cash has been spent than put in. Record the missing top-up.</p>}
      </section>

      <Dialog open={budgetOpen} onOpenChange={setBudgetOpen}>
        <DialogContent title="Category budget" description="A monthly cap for one category. Clear the amount to remove it.">
          <form action={bAction} className="mt-4 space-y-3">
            <label className="block"><span className="mb-1 block text-xs font-medium text-muted">Category</span>
              <Select name="category" defaultValue="" placeholder="Choose a category…" options={EXPENSE_CATEGORIES.map((c) => ({ value: c, label: c }))} />
            </label>
            <label className="block"><span className="mb-1 block text-xs font-medium text-muted">Monthly limit (AED)</span><input type="number" step="0.01" min="0" name="monthlyLimit" className="input w-full" /></label>
            <div className="flex items-center gap-3">
              <button type="submit" className="btn btn-primary">Save budget</button>
              {bState.error && <p role="alert" className="text-sm text-[var(--error)]">{bState.error}</p>}
              {bState.ok && <span className="text-sm text-[var(--success)]">Saved</span>}
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={topUpOpen} onOpenChange={setTopUpOpen}>
        <DialogContent title="Top up petty cash" description="Cash put into the float.">
          <form action={tAction} className="mt-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <label className="block"><span className="mb-1 block text-xs font-medium text-muted">Amount (AED)</span><input type="number" step="0.01" min="0" name="amount" required className="input w-full" /></label>
              <label className="block"><span className="mb-1 block text-xs font-medium text-muted">Date</span><input type="date" name="date" required defaultValue={new Date().toISOString().slice(0, 10)} className="input w-full" /></label>
            </div>
            <label className="block"><span className="mb-1 block text-xs font-medium text-muted">Note</span><input name="note" className="input w-full" placeholder="e.g. Withdrawn from ADCB" /></label>
            <div className="flex items-center gap-3">
              <button type="submit" className="btn btn-primary" disabled={tPending}>{tPending ? "Saving…" : "Add to float"}</button>
              {tState.error && <p role="alert" className="text-sm text-[var(--error)]">{tState.error}</p>}
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
