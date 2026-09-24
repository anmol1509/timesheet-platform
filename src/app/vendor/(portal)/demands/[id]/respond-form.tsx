"use client";

import { keepInput } from "@/lib/vendor/keepInput";
import { useActionState, useState } from "react";
import { acceptOfferAction, declineOfferAction } from "../actions";

type State = { error: string | null; ok?: boolean };

/** Accept with a quote per trade, or decline with a reason. */
export function RespondForm({ offerId, trades }: { offerId: string; trades: { id: string; trade: string; quantity: number }[] }) {
  const [mode, setMode] = useState<"accept" | "decline">("accept");
  const [aState, aAction, aPending] = useActionState(async (p: State, fd: FormData) => acceptOfferAction(p, fd), { error: null } as State);
  const [dState, dAction, dPending] = useActionState(async (p: State, fd: FormData) => declineOfferAction(p, fd), { error: null } as State);

  return (
    <section className="card p-5">
      <div className="mb-4 inline-flex gap-0.5 rounded-control bg-[var(--surface-sunken)] p-0.5" role="tablist">
        {(["accept", "decline"] as const).map((m) => (
          <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => setMode(m)}
            className={`rounded-[6px] px-3 py-1 text-[13px] font-medium transition ${mode === m ? "bg-surface text-primary shadow-xs" : "text-muted hover:text-primary"}`}>
            {m === "accept" ? "Accept & quote" : "Decline"}
          </button>
        ))}
      </div>

      {mode === "accept" ? (
        <form onSubmit={keepInput(aAction)} className="space-y-4">
          <input type="hidden" name="offerId" value={offerId} />
          <p className="text-sm text-muted">For each trade you can cover, say how many workers you can supply and your rate. Leave a trade at 0 to skip it.</p>
          <ul className="space-y-2">
            {trades.map((t) => (
              <li key={t.id} className="grid grid-cols-[1fr_auto_auto] items-end gap-3">
                <div><p className="text-sm font-medium text-primary">{t.trade}</p><p className="text-xs text-muted">{t.quantity} requested</p></div>
                <label className="block"><span className="mb-1 block text-xs text-muted">Workers</span><input type="number" min="0" max={t.quantity} name={`qty_${t.id}`} defaultValue={0} className="input w-24 text-right" /></label>
                <label className="block"><span className="mb-1 block text-xs text-muted">Rate (AED)</span><input type="number" min="0" step="0.01" name={`rate_${t.id}`} className="input w-28 text-right" /></label>
              </li>
            ))}
          </ul>
          <label className="block"><span className="mb-1 block text-xs font-medium text-muted">Note (optional)</span><input name="note" className="input w-full" placeholder="e.g. Available from 1 October" /></label>
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" className="btn btn-primary" disabled={aPending}>{aPending ? "Sending…" : "Send my quote"}</button>
            {aState.error && <p role="alert" className="text-sm text-[var(--error)]">{aState.error}</p>}
          </div>
        </form>
      ) : (
        <form onSubmit={keepInput(dAction)} className="space-y-4">
          <input type="hidden" name="offerId" value={offerId} />
          <label className="block"><span className="mb-1 block text-xs font-medium text-muted">Why can&apos;t you supply this?</span><input name="note" required className="input w-full" placeholder="e.g. No carpenters available this month" /></label>
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" className="btn btn-secondary" disabled={dPending}>{dPending ? "Sending…" : "Decline request"}</button>
            {dState.error && <p role="alert" className="text-sm text-[var(--error)]">{dState.error}</p>}
          </div>
        </form>
      )}
    </section>
  );
}
