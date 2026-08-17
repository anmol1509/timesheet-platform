"use client";

import { useState, useTransition } from "react";
import { Select } from "@/components/ui/Select";
import { cn } from "@/lib/cn";
import { createDemandRequestAction } from "../actions";

type Client = { id: string; name: string };
type Project = { id: string; name: string; code: string; clientId: string };
type TradeRow = {
  id: string;
  trade: string;
  quantity: string;
  shift: string;
};

function blankTradeRow(): TradeRow {
  // Day is the common case, so the toggle starts there rather than unset.
  return { id: crypto.randomUUID(), trade: "", quantity: "1", shift: "Day" };
}

export function DemandRequestForm({
  clients,
  projects,
  tradeOptions,
}: {
  clients: Client[];
  projects: Project[];
  tradeOptions: string[];
}) {
  const [pending, startTransition] = useTransition();
  const [clientId, setClientId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [remarks, setRemarks] = useState("");
  const [trades, setTrades] = useState<TradeRow[]>([blankTradeRow()]);

  const availableProjects = projects.filter((p) => p.clientId === clientId);

  function updateTrade(id: string, patch: Partial<TradeRow>) {
    setTrades((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }

  function handleSubmit() {
    if (!clientId || !projectId) return;
    const formData = new FormData();
    formData.append("clientId", clientId);
    formData.append("projectId", projectId);
    formData.append("remarks", remarks);
    formData.append(
      "tradesJson",
      JSON.stringify(
        trades
          .filter((t) => t.trade && Number(t.quantity) > 0)
          .map((t) => ({
            trade: t.trade,
            quantity: Number(t.quantity),
            shift: t.shift || null,
          }))
      )
    );
    startTransition(() => {
      createDemandRequestAction(formData);
    });
  }

  return (
    <div className="space-y-6">
      <div className="card grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">Client</span>
          <Select
            value={clientId}
            onChange={(v) => {
              setClientId(v);
              setProjectId("");
            }}
            placeholder="Select client"
            options={clients.map((c) => ({ value: c.id, label: c.name }))}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">Project</span>
          <Select
            value={projectId}
            onChange={setProjectId}
            placeholder={clientId ? "Select project" : "Select a client first"}
            disabled={!clientId}
            options={availableProjects.map((p) => ({ value: p.id, label: `${p.code} — ${p.name}` }))}
          />
        </label>
        <div className="sm:col-span-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">Remarks</span>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={2}
              className="input w-full"
            />
          </label>
        </div>
      </div>

      <div className="card p-5">
        <h2 className="mb-3 text-sm font-semibold text-primary">Trades</h2>
        <div className="space-y-2">
          {trades.map((t) => (
            <div key={t.id} className="grid grid-cols-1 gap-2 sm:grid-cols-4">
              <Select
                value={t.trade}
                onChange={(v) => updateTrade(t.id, { trade: v })}
                placeholder="Trade"
                options={tradeOptions.map((name) => ({ value: name, label: name }))}
              />
              <input
                type="number"
                min={1}
                value={t.quantity}
                onChange={(e) => updateTrade(t.id, { quantity: e.target.value })}
                placeholder="Quantity"
                className="input"
              />
              {/* Two states, so a toggle beats a dropdown — one click, and
                  which shift is set is readable without opening anything. */}
              <div
                role="group"
                aria-label="Shift"
                className="flex overflow-hidden rounded-control border border-default"
              >
                {(["Day", "Night"] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={t.shift === option}
                    onClick={() => updateTrade(t.id, { shift: option })}
                    className={cn(
                      "flex-1 px-3 py-2 text-xs font-medium transition",
                      t.shift === option
                        ? "bg-brand-soft text-[var(--brand-primary)]"
                        : "bg-surface text-secondary hover:bg-surface-hover"
                    )}
                  >
                    {option}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setTrades((prev) => prev.filter((r) => r.id !== t.id))}
                disabled={trades.length === 1}
                className="rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setTrades((prev) => [...prev, blankTradeRow()])}
          className="btn btn-secondary btn-sm mt-3"
        >
          + Add trade
        </button>
      </div>

      <button
        type="button"
        onClick={handleSubmit}
        disabled={pending || !clientId || !projectId}
        className="btn btn-primary"
      >
        {pending ? "Raising…" : "Raise Demand"}
      </button>
    </div>
  );
}
