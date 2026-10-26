"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/Dialog";
import { Badge } from "@/components/Badge";
import { applyRunAdvancesAction, loadRunAdvancesAction, type RunAdvance } from "../pay-items-actions";

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
  const [advances, setAdvances] = useState<RunAdvance[] | null>(null);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();

  function load(open: boolean) {
    if (!open) return;
    setError(null); setDone(false);
    start(async () => {
      const r = await loadRunAdvancesAction(runId, employeeId);
      if (r.error || !r.advances) { setError(r.error ?? "Could not load the advances."); return; }
      setAdvances(r.advances); setMonth(r.month ?? ""); setCanApply(!!r.canApply);
      setAmounts(Object.fromEntries(r.advances.map((a) => [a.id, a.planned ? String(a.planned) : ""])));
    });
  }

  function apply() {
    if (!advances) return;
    setError(null); setDone(false);
    start(async () => {
      const res = await applyRunAdvancesAction(runId, employeeId, advances.map((a) => ({ loanId: a.id, amount: Number(amounts[a.id] || 0) })));
      if (res.error) { setError(res.error); return; }
      setDone(true);
      const r = await loadRunAdvancesAction(runId, employeeId);
      if (r.advances) { setAdvances(r.advances); setAmounts(Object.fromEntries(r.advances.map((a) => [a.id, a.planned ? String(a.planned) : ""]))); }
      router.refresh();
    });
  }

  return (
    <Dialog onOpenChange={load}>
      <DialogTrigger asChild>
        <button type="button" className={unscheduled ? "font-medium text-[var(--warning)] hover:underline" : "text-[var(--brand-primary)] hover:underline"} title={`${count} open advance${count === 1 ? "" : "s"}, AED ${aed(owed)} owed${unscheduled ? " — no month chosen for at least one" : ""}`}>
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
                {canApply && (
                  <label className="mt-2 flex items-center gap-2">
                    <span className="text-xs text-muted">Deduct this month (AED)</span>
                    <input className="input h-8 w-32 text-right text-xs tabular-nums" type="number" step="0.01" min="0" max={a.balance} value={amounts[a.id] ?? ""} onChange={(e) => { setDone(false); setAmounts((p) => ({ ...p, [a.id]: e.target.value })); }} aria-label={`Amount to deduct for ${a.ref}`} />
                    <button type="button" className="text-xs text-[var(--brand-primary)] hover:underline" onClick={() => { setDone(false); setAmounts((p) => ({ ...p, [a.id]: String(a.balance) })); }}>All of it</button>
                  </label>
                )}
              </div>
            ))}
            {canApply ? (
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" className="btn btn-primary" disabled={pending} onClick={apply}>{pending ? "Applying…" : "Apply"}</button>
                {done && <span className="text-xs text-[var(--success)]">Applied. This worker&apos;s pay has been worked out again.</span>}
                <span className="w-full text-xs text-muted">The amount is set for this month. An advance that had no month yet keeps taking this amount in later months until it is cleared, unless you change its months under Loans &amp; advances.</span>
              </div>
            ) : <p className="text-xs text-muted">This run is no longer a draft, so nothing can be changed here.</p>}
            {error && <p role="alert" className="text-sm text-[var(--error)]">{error}</p>}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
