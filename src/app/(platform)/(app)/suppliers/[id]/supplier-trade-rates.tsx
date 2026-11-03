"use client";

import { Plus } from "lucide-react";
import { useState, useTransition } from "react";
import { saveSupplierTradePayAction, removeSupplierTradePayAction } from "../trade-pay-actions";
import { DeleteButton } from "@/components/DeleteButton";
import { NumberInput } from "@/components/ui/NumberInput";
import { Alert } from "@/components/Alert";

type TradeRate = { id: string; trade: string; rate: number };

/** What this supplier is paid per hour for each trade: the cost side, filled into the bulk timesheet's Cost rate. */
export function SupplierTradeRates({ supplierId, rates, canEdit }: { supplierId: string; rates: TradeRate[]; canEdit: boolean }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftRate, setDraftRate] = useState("");
  const [newTrade, setNewTrade] = useState("");
  const [newRate, setNewRate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save(trade: string, rate: string, done: () => void) {
    const fd = new FormData();
    fd.set("supplierId", supplierId);
    fd.set("trade", trade);
    fd.set("rate", rate);
    setError(null);
    startTransition(async () => {
      const r = await saveSupplierTradePayAction(fd);
      if (r.error) setError(r.error); else done();
    });
  }

  return (
    <section>
      <h2 className="mb-1 text-sm font-semibold text-primary">Rates we pay this supplier, by trade ({rates.length})</h2>
      <p className="mb-3 text-sm text-muted">
        A fallback for the bulk timesheet: used for a worker who has no earlier timesheet row with this supplier and trade (a worker with one gets their last rate). It is the cost side: what the client is billed is set on the client or project.
      </p>
      {error && <Alert className="mb-3">{error}</Alert>}
      <div className="card overflow-hidden">
        {rates.length > 0 && (
          <table className="w-full text-sm">
            <thead className="border-b border-default bg-surface-subtle text-left text-xs font-medium tracking-wide text-muted uppercase">
              <tr><th className="px-4 py-3">Trade</th><th className="px-4 py-3 text-right">Rate (AED/hr)</th>{canEdit && <th className="px-4 py-3" />}</tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {rates.map((r) => editingId === r.id ? (
                <tr key={r.id}>
                  <td className="px-4 py-2 font-medium text-primary">{r.trade}</td>
                  <td className="px-4 py-2 text-right"><NumberInput value={draftRate} onChange={(v) => setDraftRate(String(v))} step={0.01} className="w-24" /></td>
                  <td className="px-4 py-2 text-right whitespace-nowrap">
                    <button type="button" disabled={pending} onClick={() => save(r.trade, draftRate, () => setEditingId(null))} className="mr-2 text-xs font-medium text-[var(--success)] hover:underline disabled:opacity-50">{pending ? "Saving…" : "Save"}</button>
                    <button type="button" onClick={() => setEditingId(null)} className="text-xs font-medium text-subtle hover:underline">Cancel</button>
                  </td>
                </tr>
              ) : (
                <tr key={r.id}>
                  <td className="px-4 py-3 font-medium text-primary">{r.trade}</td>
                  <td className="px-4 py-3 text-right text-secondary">{r.rate.toFixed(2)}</td>
                  {canEdit && (
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button type="button" onClick={() => { setEditingId(r.id); setDraftRate(String(r.rate)); }} className="mr-2 text-xs font-medium text-muted hover:underline">Edit</button>
                      <DeleteButton action={removeSupplierTradePayAction} hiddenFields={{ supplierId, rateId: r.id }} confirmMessage={`Remove the rate for "${r.trade}"?`} label="Remove" />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {rates.length === 0 && <p className="px-4 py-5 text-sm text-muted">No rates yet. These are optional: the bulk timesheet already fills each worker\u2019s Cost rate from their last timesheet.</p>}
        {canEdit && (
          <div className="flex flex-wrap items-end gap-3 border-t border-default p-4">
            <label className="block min-w-[160px] flex-1">
              <span className="mb-1 block text-xs font-medium text-muted">Trade (must match the timesheet trade)</span>
              <input value={newTrade} onChange={(e) => setNewTrade(e.target.value)} placeholder="e.g. Carpenter" className="input w-full" />
            </label>
            <label className="block w-32">
              <span className="mb-1 block text-xs font-medium text-muted">Rate (AED/hr)</span>
              <NumberInput value={newRate} onChange={(v) => setNewRate(String(v))} step={0.01} className="w-full" />
            </label>
            <button type="button" disabled={pending || !newTrade.trim() || !(Number(newRate) > 0)} onClick={() => save(newTrade.trim(), newRate, () => { setNewTrade(""); setNewRate(""); })} className="btn btn-primary">
              <Plus className="h-4 w-4" aria-hidden /> Add
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
