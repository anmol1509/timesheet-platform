"use client";

import { useState, useTransition } from "react";
import { Select } from "@/components/ui/Select";
import { createQuotationAction } from "../actions";

type Client = { id: string; name: string };
type LineRow = {
  id: string;
  trade: string;
  quantity: string;
  rate: string;
  otRate: string;
  nationality: string;
  workingHours: string;
};

function blankLine(): LineRow {
  return { id: crypto.randomUUID(), trade: "", quantity: "1", rate: "", otRate: "", nationality: "", workingHours: "" };
}

export function QuotationForm({
  clients,
  tradeOptions,
  defaultClientId,
  enquiryId,
}: {
  clients: Client[];
  tradeOptions: { value: string }[];
  defaultClientId: string;
  enquiryId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [clientId, setClientId] = useState(defaultClientId);
  const [validUntil, setValidUntil] = useState("");
  const [terms, setTerms] = useState("");
  const [accommodationResponsibility, setAccommodationResponsibility] = useState("");
  const [transportationResponsibility, setTransportationResponsibility] = useState("");
  const [ppeResponsibility, setPpeResponsibility] = useState("");
  const [lines, setLines] = useState<LineRow[]>([blankLine()]);

  function updateLine(id: string, patch: Partial<LineRow>) {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }

  function handleSubmit() {
    if (!clientId) return;
    const formData = new FormData();
    formData.append("clientId", clientId);
    if (enquiryId) formData.append("enquiryId", enquiryId);
    formData.append("validUntil", validUntil);
    formData.append("terms", terms);
    formData.append("accommodationResponsibility", accommodationResponsibility);
    formData.append("transportationResponsibility", transportationResponsibility);
    formData.append("ppeResponsibility", ppeResponsibility);
    formData.append(
      "linesJson",
      JSON.stringify(
        lines
          .filter((l) => l.trade && Number(l.quantity) > 0 && l.rate)
          .map((l) => ({
            trade: l.trade,
            quantity: Number(l.quantity),
            rate: Number(l.rate),
            otRate: l.otRate ? Number(l.otRate) : null,
            nationality: l.nationality || null,
            workingHours: l.workingHours || null,
          }))
      )
    );
    startTransition(() => {
      createQuotationAction(formData);
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 rounded-3xl border border-slate-200 bg-white p-5 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-500">Client</span>
          <Select
            value={clientId}
            onChange={setClientId}
            placeholder="Select client"
            options={clients.map((c) => ({ value: c.id, label: c.name }))}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-500">Valid until</span>
          <input
            type="date"
            value={validUntil}
            onChange={(e) => setValidUntil(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-500">Accommodation responsibility</span>
          <input
            value={accommodationResponsibility}
            onChange={(e) => setAccommodationResponsibility(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-500">Transportation responsibility</span>
          <input
            value={transportationResponsibility}
            onChange={(e) => setTransportationResponsibility(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-500">PPE responsibility</span>
          <input
            value={ppeResponsibility}
            onChange={(e) => setPpeResponsibility(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
          />
        </label>
        <div className="sm:col-span-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500">Other terms</span>
            <textarea
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
            />
          </label>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Line Items</h2>
        <div className="space-y-2">
          {lines.map((l) => (
            <div key={l.id} className="grid grid-cols-1 gap-2 sm:grid-cols-6">
              <Select
                value={l.trade}
                onChange={(v) => updateLine(l.id, { trade: v })}
                placeholder="Trade"
                options={tradeOptions.map((o) => ({ value: o.value, label: o.value }))}
              />
              <input
                type="number"
                min={1}
                value={l.quantity}
                onChange={(e) => updateLine(l.id, { quantity: e.target.value })}
                placeholder="Quantity"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
              />
              <input
                type="number"
                step="0.01"
                value={l.rate}
                onChange={(e) => updateLine(l.id, { rate: e.target.value })}
                placeholder="Rate"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
              />
              <input
                type="number"
                step="0.01"
                value={l.otRate}
                onChange={(e) => updateLine(l.id, { otRate: e.target.value })}
                placeholder="OT rate"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
              />
              <input
                value={l.nationality}
                onChange={(e) => updateLine(l.id, { nationality: e.target.value })}
                placeholder="Nationality"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
              />
              <div className="flex gap-2">
                <input
                  value={l.workingHours}
                  onChange={(e) => updateLine(l.id, { workingHours: e.target.value })}
                  placeholder="Hours"
                  className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
                />
                <button
                  type="button"
                  onClick={() => setLines((prev) => prev.filter((r) => r.id !== l.id))}
                  disabled={lines.length === 1}
                  className="shrink-0 rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setLines((prev) => [...prev, blankLine()])}
          className="mt-3 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          + Add line
        </button>
      </div>

      <button
        type="button"
        onClick={handleSubmit}
        disabled={pending || !clientId}
        className="rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--brand-primary-hover)] disabled:opacity-50"
      >
        {pending ? "Creating…" : "Create Quotation"}
      </button>
    </div>
  );
}
