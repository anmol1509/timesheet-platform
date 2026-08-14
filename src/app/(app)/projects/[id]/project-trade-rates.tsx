"use client";

import { useState, useTransition } from "react";
import { addProjectTradeRateAction, removeProjectTradeRateAction } from "../actions";
import { DeleteButton } from "@/components/DeleteButton";

type TradeRate = { id: string; trade: string; rate: number };

export function ProjectTradeRates({
  projectId,
  clientId,
  clientName,
  rates,
}: {
  projectId: string;
  clientId: string;
  clientName: string;
  rates: TradeRate[];
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftRate, setDraftRate] = useState("");
  const [newTrade, setNewTrade] = useState("");
  const [newRate, setNewRate] = useState("");
  const [pending, startTransition] = useTransition();

  function startEdit(r: TradeRate) {
    setEditingId(r.id);
    setDraftRate(String(r.rate));
  }

  function saveEdit(trade: string) {
    const formData = new FormData();
    formData.set("projectId", projectId);
    formData.set("clientId", clientId);
    formData.set("trade", trade);
    formData.set("rate", draftRate);
    startTransition(async () => {
      await addProjectTradeRateAction(formData);
      setEditingId(null);
    });
  }

  function addNew() {
    if (!newTrade.trim() || !newRate) return;
    const formData = new FormData();
    formData.set("projectId", projectId);
    formData.set("clientId", clientId);
    formData.set("trade", newTrade.trim());
    formData.set("rate", newRate);
    startTransition(async () => {
      await addProjectTradeRateAction(formData);
      setNewTrade("");
      setNewRate("");
    });
  }

  return (
    <div>
      <p className="mb-3 text-xs text-muted">
        Overrides {clientName}&rsquo;s client-wide trade rates for this project
        only. A trade with no rate here falls back to {clientName}&rsquo;s
        client-level rate card, then to their flat Hourly/Basic rate.
      </p>
      <div className="card overflow-hidden">
        {rates.length > 0 && (
          <table className="w-full text-sm">
            <thead className="border-b border-default bg-surface-subtle text-left text-xs font-medium tracking-wide text-muted uppercase">
              <tr>
                <th className="px-4 py-3">Trade</th>
                <th className="px-4 py-3 text-right">Rate (AED/hr)</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {rates.map((r) =>
                editingId === r.id ? (
                  <tr key={r.id}>
                    <td className="px-4 py-2 font-medium text-primary">{r.trade}</td>
                    <td className="px-4 py-2 text-right">
                      <input
                        type="number"
                        step="0.01"
                        value={draftRate}
                        autoFocus
                        onChange={(e) => setDraftRate(e.target.value)}
                        className="input w-24 px-2 py-1 text-right"
                      />
                    </td>
                    <td className="px-4 py-2 text-right whitespace-nowrap">
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => saveEdit(r.trade)}
                        className="mr-2 text-xs font-medium text-emerald-600 hover:underline disabled:opacity-50"
                      >
                        {pending ? "Saving…" : "Save"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="text-xs font-medium text-subtle hover:underline"
                      >
                        Cancel
                      </button>
                    </td>
                  </tr>
                ) : (
                  <tr key={r.id}>
                    <td className="px-4 py-3 font-medium text-primary">{r.trade}</td>
                    <td className="px-4 py-3 text-right text-secondary">
                      {r.rate.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => startEdit(r)}
                        className="mr-2 text-xs font-medium text-muted hover:underline"
                      >
                        Edit
                      </button>
                      <DeleteButton
                        action={removeProjectTradeRateAction}
                        hiddenFields={{ projectId, rateId: r.id }}
                        confirmMessage={`Remove the billing rate for "${r.trade}"?`}
                        label="Remove"
                      />
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        )}
        <div className="flex flex-wrap items-end gap-3 border-t border-default p-4 first:border-t-0">
          <label className="block min-w-[160px] flex-1">
            <span className="mb-1 block text-xs font-medium text-muted">
              Trade (must match timesheet trade)
            </span>
            <input
              value={newTrade}
              onChange={(e) => setNewTrade(e.target.value)}
              placeholder="e.g. Carpenter"
              className="input w-full"
            />
          </label>
          <label className="block w-32">
            <span className="mb-1 block text-xs font-medium text-muted">
              Rate (AED/hr)
            </span>
            <input
              type="number"
              step="0.01"
              value={newRate}
              onChange={(e) => setNewRate(e.target.value)}
              className="input w-full"
            />
          </label>
          <button
            type="button"
            disabled={pending}
            onClick={addNew}
            className="btn btn-primary"
          >
            + Add
          </button>
        </div>
      </div>
    </div>
  );
}
