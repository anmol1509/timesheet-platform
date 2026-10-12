"use client";

import { useState, useTransition } from "react";
import { addArrearsAction } from "../../payroll/pay-items-actions";

export type RevisionRow = { id: string; effectiveFrom: string; reason: string | null; fixedBefore: number; fixedAfter: number; by: string; arrears: { months: number; amount: number } | null };
const aed = (n: number) => n.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Every change to what this worker is paid each month, newest first, with a one-click arrears item for rises that missed paid months. */
export function SalaryHistorySection({ rows, canAddArrears }: { rows: RevisionRow[]; canAddArrears: boolean }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<Record<string, string>>({});
  function add(id: string) {
    start(async () => {
      const fd = new FormData();
      fd.set("revisionId", id);
      const r = await addArrearsAction(fd);
      setMsg((m) => ({ ...m, [id]: r.error ?? "Added to the next payroll." }));
    });
  }
  return (
    <section className="card p-5">
      <h2 className="mb-3 text-sm font-semibold text-primary">Salary history</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">No pay changes recorded yet. Changes made to the pay structure from now on will appear here.</p>
      ) : (
        <ul className="divide-y divide-[var(--border)] text-sm">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <div>
                <p className="text-primary">From {r.effectiveFrom}: AED {aed(r.fixedBefore)} → <span className="font-medium">AED {aed(r.fixedAfter)}</span> a month</p>
                <p className="text-xs text-muted">{r.reason ? `${r.reason} · ` : ""}recorded by {r.by}</p>
              </div>
              {canAddArrears && r.arrears && (
                <div className="text-right">
                  <button type="button" disabled={pending} className="btn btn-secondary h-8 px-3 text-xs" title="Arrears: pay owed for earlier months. This adds the difference to next month's payroll." onClick={() => add(r.id)}>Pay arrears: AED {aed(r.arrears.amount)} ({r.arrears.months} month{r.arrears.months === 1 ? "" : "s"})</button>
                  {msg[r.id] && <p className="mt-1 text-xs text-muted">{msg[r.id]}</p>}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
