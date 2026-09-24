"use client";

import { keepInput } from "@/lib/vendor/keepInput";
import { useActionState, useState, useTransition } from "react";
import { addAvailabilityAction, removeAvailabilityAction } from "./actions";

type State = { error: string | null; ok?: boolean };
export type AvailRow = { id: string; trade: string; date: string; count: number; note: string | null };

export function AvailabilityBoard({ trades, rows }: { trades: string[]; rows: AvailRow[] }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [state, action, adding] = useActionState(async (p: State, fd: FormData) => addAvailabilityAction(p, fd), { error: null } as State);
  const total = rows.reduce((s, r) => s + r.count, 0);
  const byDate = new Map<string, AvailRow[]>();
  for (const r of rows) byDate.set(r.date, [...(byDate.get(r.date) ?? []), r]);

  return (
    <>
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-primary">Availability</h1>
        <p className="mt-1 text-sm text-muted">Tell us how many workers you can supply, by trade and date. We use this when we plan upcoming requests.</p>
      </div>

      <form onSubmit={keepInput(action)} className="card space-y-3 p-5">
        <div className="grid gap-3 sm:grid-cols-4">
          <label className="block sm:col-span-2"><span className="mb-1 block text-xs font-medium text-muted">Trade</span>
            <select name="trade" required defaultValue="" className="input w-full"><option value="" disabled>Choose a trade…</option>{trades.map((t) => <option key={t} value={t}>{t}</option>)}</select></label>
          <label className="block"><span className="mb-1 block text-xs font-medium text-muted">Available from</span><input type="date" name="date" required defaultValue={new Date().toISOString().slice(0, 10)} className="input w-full" /></label>
          <label className="block"><span className="mb-1 block text-xs font-medium text-muted">Workers</span><input type="number" name="count" min="1" max="1000" required className="input w-full" /></label>
        </div>
        <label className="block"><span className="mb-1 block text-xs font-medium text-muted">Note (optional)</span><input name="note" className="input w-full" placeholder="e.g. Can start with 3 days notice" /></label>
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className="btn btn-primary" disabled={adding}>{adding ? "Saving…" : "Add availability"}</button>
          {state.error && <p role="alert" className="text-sm text-[var(--error)]">{state.error}</p>}
          {state.ok && <span className="text-sm text-[var(--success)]">Saved</span>}
        </div>
      </form>

      {error && <p role="alert" className="text-sm text-[var(--error)]">{error}</p>}
      {rows.length === 0 ? (
        <div className="card p-8 text-center text-sm text-muted">Nothing declared yet. Add the trades and dates you can cover.</div>
      ) : (
        <section className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-default px-5 py-3"><h2 className="text-sm font-semibold text-primary">Upcoming</h2><span className="text-xs text-subtle">{total} worker{total === 1 ? "" : "s"} across {rows.length} line{rows.length === 1 ? "" : "s"}</span></div>
          {[...byDate.entries()].map(([d, list]) => (
            <div key={d} className="border-b border-default last:border-0">
              <p className="bg-surface-subtle px-5 py-1.5 text-xs font-medium text-muted">{new Date(d + "T00:00:00Z").toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" })}</p>
              <ul className="divide-y divide-[var(--border)]">
                {list.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                    <span className="min-w-0"><span className="font-medium text-primary">{r.trade}</span>{r.note && <span className="ml-2 text-xs text-muted">{r.note}</span>}</span>
                    <span className="flex items-center gap-4"><span className="tabular font-semibold text-primary">{r.count}</span>
                      <button type="button" disabled={pending} className="text-xs font-medium text-[var(--error)] hover:underline" onClick={() => start(async () => { setError(null); const fd = new FormData(); fd.set("id", r.id); const res = await removeAvailabilityAction(fd); if (res.error) setError(res.error); })}>Remove</button></span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}
    </>
  );
}
