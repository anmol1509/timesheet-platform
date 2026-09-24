"use client";

import { useActionState, useState, useTransition } from "react";
import { Badge, type BadgeColor } from "@/components/Badge";
import { withdrawOfferAction, sendToSuppliersAction } from "../offer-actions";

type State = { error: string | null; ok?: boolean };
export type OfferRow = {
  id: string; supplier: string; status: string; note: string | null; sentAt: string; respondedAt: string | null;
  lines: { trade: string; requested: number; quantity: number; rate: number | null }[];
};
const STATUS: Record<string, { label: string; color: BadgeColor }> = { SENT: { label: "Awaiting reply", color: "amber" }, ACCEPTED: { label: "Accepted", color: "green" }, DECLINED: { label: "Declined", color: "slate" } };
const aed = (n: number) => n.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Send this request to suppliers and read their quotes. Nothing is allocated automatically. */
export function SupplierOffers({ demandId, offers, available, canEdit }: { demandId: string; offers: OfferRow[]; available: { id: string; name: string }[]; canEdit: boolean }) {
  const [pickOpen, setPickOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [state, action, sending] = useActionState(
    async (p: State, fd: FormData) => { const r = await sendToSuppliersAction(p, fd); if (r.ok) setPickOpen(false); return r; },
    { error: null } as State
  );

  return (
    <section className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-primary">Supplier offers</h2>
          <p className="mt-0.5 text-xs text-muted">Send this request to suppliers. They accept with a quote or decline in their portal.</p>
        </div>
        {canEdit && available.length > 0 && <button type="button" className="btn btn-secondary" onClick={() => setPickOpen((o) => !o)}>{pickOpen ? "Cancel" : "Send to suppliers"}</button>}
      </div>

      {pickOpen && (
        <form action={action} className="mt-4 space-y-3 rounded-control border border-default bg-surface-subtle p-3">
          <input type="hidden" name="demandId" value={demandId} />
          <ul className="grid max-h-48 gap-1.5 overflow-y-auto sm:grid-cols-2">
            {available.map((s) => <li key={s.id}><label className="flex items-center gap-2 text-sm text-secondary"><input type="checkbox" name="supplierId" value={s.id} className="h-4 w-4" />{s.name}</label></li>)}
          </ul>
          <div className="flex items-center gap-3"><button type="submit" className="btn btn-primary" disabled={sending}>{sending ? "Sending…" : "Send request"}</button>{state.error && <p role="alert" className="text-sm text-[var(--error)]">{state.error}</p>}</div>
        </form>
      )}
      {canEdit && available.length === 0 && offers.length === 0 && <p className="mt-3 text-xs text-subtle">No suppliers have portal access yet. Turn it on for a supplier on its record.</p>}
      {error && <p role="alert" className="mt-3 text-sm text-[var(--error)]">{error}</p>}

      {offers.length > 0 && (
        <ul className="mt-4 divide-y divide-[var(--border)]">
          {offers.map((o) => (
            <li key={o.id} className="py-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-primary">{o.supplier}</span>
                <span className="flex items-center gap-2">
                  <Badge color={STATUS[o.status]?.color ?? "slate"} dot>{STATUS[o.status]?.label ?? o.status}</Badge>
                  {o.status === "SENT" && canEdit && (
                    <button type="button" className="text-xs font-medium text-[var(--error)] hover:underline" disabled={pending}
                      onClick={() => start(async () => { setError(null); const fd = new FormData(); fd.set("id", o.id); const r = await withdrawOfferAction(fd); if (r.error) setError(r.error); })}>Withdraw</button>
                  )}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-subtle">Sent {o.sentAt}{o.respondedAt ? ` · answered ${o.respondedAt}` : ""}</p>
              {o.status === "ACCEPTED" && o.lines.length > 0 && (
                <ul className="mt-2 space-y-0.5 text-xs text-secondary">
                  {o.lines.map((l) => <li key={l.trade} className="flex justify-between gap-3"><span>{l.trade}: offers {l.quantity} of {l.requested}</span><span className="tabular">{l.rate !== null ? `AED ${aed(l.rate)}` : "no rate given"}</span></li>)}
                </ul>
              )}
              {o.note && <p className="mt-2 text-xs text-muted">{o.status === "DECLINED" ? "Reason: " : "Note: "}{o.note}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
