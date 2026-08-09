"use client";

import { useState, useTransition } from "react";
import { Select } from "@/components/ui/Select";
import { createDemandRequestAction } from "../actions";

type Client = { id: string; name: string };
type Project = { id: string; name: string; code: string; clientId: string; salesExecutive: string | null };
type TradeRow = { id: string; trade: string; quantity: string; shift: string; rate: string };

function blankTradeRow(): TradeRow {
  return { id: crypto.randomUUID(), trade: "", quantity: "1", shift: "", rate: "" };
}

export function DemandRequestForm({
  clients,
  projects,
  tradeOptions,
}: {
  clients: Client[];
  projects: Project[];
  tradeOptions: { value: string }[];
}) {
  const [pending, startTransition] = useTransition();
  const [clientId, setClientId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [salesExecutive, setSalesExecutive] = useState("");
  const [priority, setPriority] = useState("");
  const [accommodationStatus, setAccommodationStatus] = useState("");
  const [transportationStatus, setTransportationStatus] = useState("");
  const [remarks, setRemarks] = useState("");
  const [trades, setTrades] = useState<TradeRow[]>([blankTradeRow()]);

  const availableProjects = projects.filter((p) => p.clientId === clientId);

  function selectProject(id: string) {
    setProjectId(id);
    const project = projects.find((p) => p.id === id);
    if (project?.salesExecutive) setSalesExecutive(project.salesExecutive);
  }

  function updateTrade(id: string, patch: Partial<TradeRow>) {
    setTrades((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }

  function handleSubmit() {
    if (!clientId || !projectId) return;
    const formData = new FormData();
    formData.append("clientId", clientId);
    formData.append("projectId", projectId);
    formData.append("salesExecutive", salesExecutive);
    formData.append("priority", priority);
    formData.append("accommodationStatus", accommodationStatus);
    formData.append("transportationStatus", transportationStatus);
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
            rate: t.rate ? Number(t.rate) : null,
          }))
      )
    );
    startTransition(() => {
      createDemandRequestAction(formData);
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 rounded-3xl border border-slate-200 bg-white p-5 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-500">Client</span>
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
          <span className="mb-1 block text-xs font-medium text-slate-500">Project</span>
          <Select
            value={projectId}
            onChange={selectProject}
            placeholder={clientId ? "Select project" : "Select a client first"}
            disabled={!clientId}
            options={availableProjects.map((p) => ({ value: p.id, label: `${p.code} — ${p.name}` }))}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-500">Sales Executive</span>
          <input
            value={salesExecutive}
            onChange={(e) => setSalesExecutive(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-500">Priority</span>
          <Select
            value={priority}
            onChange={setPriority}
            placeholder="Not set"
            searchable={false}
            options={[
              { value: "Low", label: "Low" },
              { value: "Medium", label: "Medium" },
              { value: "High", label: "High" },
            ]}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-500">Accommodation Status</span>
          <input
            value={accommodationStatus}
            onChange={(e) => setAccommodationStatus(e.target.value)}
            placeholder="e.g. Own"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-500">Transportation Status</span>
          <input
            value={transportationStatus}
            onChange={(e) => setTransportationStatus(e.target.value)}
            placeholder="e.g. Own"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
          />
        </label>
        <div className="sm:col-span-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500">Remarks</span>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
            />
          </label>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Trades</h2>
        <div className="space-y-2">
          {trades.map((t) => (
            <div key={t.id} className="grid grid-cols-1 gap-2 sm:grid-cols-5">
              <Select
                value={t.trade}
                onChange={(v) => updateTrade(t.id, { trade: v })}
                placeholder="Trade"
                options={tradeOptions.map((o) => ({ value: o.value, label: o.value }))}
              />
              <input
                type="number"
                min={1}
                value={t.quantity}
                onChange={(e) => updateTrade(t.id, { quantity: e.target.value })}
                placeholder="Quantity"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
              />
              <Select
                value={t.shift}
                onChange={(v) => updateTrade(t.id, { shift: v })}
                placeholder="Shift"
                searchable={false}
                options={[
                  { value: "Day", label: "Day" },
                  { value: "Night", label: "Night" },
                ]}
              />
              <input
                type="number"
                value={t.rate}
                onChange={(e) => updateTrade(t.id, { rate: e.target.value })}
                placeholder="Rate"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
              />
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
          className="mt-3 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          + Add trade
        </button>
      </div>

      <button
        type="button"
        onClick={handleSubmit}
        disabled={pending || !clientId || !projectId}
        className="rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--brand-primary-hover)] disabled:opacity-50"
      >
        {pending ? "Creating…" : "Create Request"}
      </button>
    </div>
  );
}
