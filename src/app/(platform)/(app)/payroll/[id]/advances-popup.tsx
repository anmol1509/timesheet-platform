"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/Dialog";
import { Badge } from "@/components/Badge";
import { applyRunAdvancesAction, loadRunAdvancesAction, type RunAdvance } from "../pay-items-actions";

import { Button } from "@/components/ui/Button";
const aed = (n: number) => n.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * "Advances" on a run line, shown only for a worker who still owes one: every open advance with its balance and what this
 * month is set to take, an amount to deduct for each, and Apply. Applying sets that month's amount in the advance's plan
 * (which is also how a month gets chosen for one approved without one) and works the worker's line out again.
 */
export function AdvancesButton({ runId, employeeId, name, count, owed, unscheduled }: { runId: string; employeeId: string; name: string; count: number; owed: number; unscheduled: boolean }) {
  const router = useRouter();
  const [month, setMonth] = useState("");
  const [canApply, setCanApply] = useState(false);
  const [typed, setTyped] = useState(0);
  const [advances, setAdvances] = useState<RunAdvance[] | null>(null);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function load(open: boolean) {
    if (!open) return;
    setError(null); setDone(null);
    start(async () => {
      const r = await loadRunAdvancesAction(runId, employeeId);
      if (r.error || !r.advances) { setError(r.error ?? "Could not load the advances."); return; }
      setAdvances(r.advances); setMonth(r.month ?? ""); setCanApply(!!r.canApply); setTyped(r.typedAdvance ?? 0);
      setAmounts(Object.fromEntries(r.advances.map((a) => [a.id, a.planned ? String(a.planned) : ""])));
    });
  }

  // Each advance has its own Apply: it sets this month's amount for that advance alone and works the pay out again.
  function apply(a: RunAdvance) {
    setError(null); setDone(null);
    const amount = Number(amounts[a.id] || 0);
    if (amount === a.planned) { setError(`${a.ref}: change the amount first.`); return; }
    // An advance typed by hand on this worker's line is replaced by the plans once one is applied here.
    if (typed > 0 && !window.confirm(`${name} has an advance of AED ${aed(typed)} typed by hand on this run. Applying here replaces it with what the advances' plans take. Continue?`)) return;
    setBusyId(a.id);
    start(async () => {
      const res = await applyRunAdvancesAction(runId, employeeId, [{ loanId: a.id, amount }]);
      setBusyId(null);
      if (res.error) { setError(res.error); return; }
      setDone(a.id);
      const r = await loadRunAdvancesAction(runId, employeeId);
      if (r.advances) setAdvances(r.advances);
      setTyped(r.typedAdvance ?? 0);
      // The other rows keep what was typed in them; this one shows what is now planned.
      setAmounts((p) => ({ ...p, [a.id]: amount > 0 ? String(amount) : "" }));
      router.refresh();
    });
  }

  return (
    <Dialog onOpenChange={load}>
      <DialogTrigger asChild>
        <button type="button" className={unscheduled ? "font-medium text-[var(--warning)] hover:underline" : "text-[var(--brand-primary)] hover:underline"} title={`${count} open advance${count === 1 ? "" : "s"}, AED ${aed(owed)} owed${unscheduled ? ": no month chosen for at least one" : ""}`}>
          Advances ({count})
        </button>
      </DialogTrigger>
      <DialogContent title={`${name}: advances and loans`} description={month ? `What to deduct in the ${month} payroll` : undefined}>
        {!advances ? (
          <p className="mt-4 text-sm text-muted">{error ?? "Loading…"}</p>
        ) : advances.length === 0 ? (
          <p className="mt-4 text-sm text-muted">Nothing is owed any more.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {advances.map((a) => (
              <div key={a.id} className="rounded-md border border-default p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-primary">{a.ref} <span className="text-xs font-normal text-muted">{a.type === "LOAN" ? "Loan" : "Advance"} given {a.givenDate}</span></p>
                  {a.planPending && <Badge color="amber">No month chosen</Badge>}
                </div>
                <p className="mt-1 text-xs text-muted">AED {aed(a.principal)} given · AED {aed(a.repaid)} recovered · <span className="font-medium text-primary">AED {aed(a.balance)} still owed</span></p>
                <p className="text-xs text-muted">Plan: {a.plan}</p>
                {!a.planPending && a.planned === 0 && <p className="text-xs text-muted">Nothing is planned for {month}. Type an amount to deduct it now anyway.</p>}
                {canApply && (
                  <label className="mt-2 flex items-center gap-2">
                    <span className="text-xs text-muted">Deduct this month (AED)</span>
                    <input className="input h-8 w-32 text-right text-xs tabular-nums" type="number" step="0.01" min="0" max={a.balance} value={amounts[a.id] ?? ""} onChange={(e) => { setDone(null); setAmounts((p) => ({ ...p, [a.id]: e.target.value })); }} aria-label={`Amount to deduct for ${a.ref}`} />
                    <button type="button" className="text-xs text-[var(--brand-primary)] hover:underline" onClick={() => { setDone(null); setAmounts((p) => ({ ...p, [a.id]: String(a.balance) })); }}>All of it</button>
                    <Button size="btn" className="ml-auto h-8 px-3 text-xs" type="button" disabled={pending} onClick={() => apply(a)} loading={busyId === a.id}>Apply</Button>
                  </label>
                )}
                {done === a.id && <p className="mt-1 text-xs text-[var(--success)]">Applied. This worker&apos;s pay has been worked out again.</p>}
              </div>
            ))}
            {canApply ? (
              <p className="text-xs text-muted">Whatever you type replaces what the advance&apos;s plan had for this month, even if a month was already chosen; its other months stay as planned. An advance that had no month yet keeps taking this amount in later months until it is cleared, unless you change its months under Loans &amp; advances.</p>
            ) : <p className="text-xs text-muted">This run is no longer a draft, so nothing can be changed here.</p>}
            {error && <p role="alert" className="text-sm text-[var(--error)]">{error}</p>}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
