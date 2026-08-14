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
      <div className="card grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">Client</span>
          <Select
            value={clientId}
            onChange={setClientId}
            placeholder="Select client"
            options={clients.map((c) => ({ value: c.id, label: c.name }))}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">Valid until</span>
          <input
            type="date"
            value={validUntil}
            onChange={(e) => setValidUntil(e.target.value)}
            className="input w-full"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">Accommodation responsibility</span>
          <input
            value={accommodationResponsibility}
            onChange={(e) => setAccommodationResponsibility(e.target.value)}
            className="input w-full"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">Transportation responsibility</span>
          <input
            value={transportationResponsibility}
            onChange={(e) => setTransportationResponsibility(e.target.value)}
            className="input w-full"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">PPE responsibility</span>
          <input
            value={ppeResponsibility}
            onChange={(e) => setPpeResponsibility(e.target.value)}
            className="input w-full"
          />
        </label>
        <div className="sm:col-span-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">Other terms</span>
            <textarea
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
              rows={2}
              className="input w-full"
            />
          </label>
        </div>
      </div>

      <div className="card p-5">
        <h2 className="mb-3 text-sm font-semibold text-primary">Line Items</h2>
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
                className="input"
              />
              <input
                type="number"
                step="0.01"
                value={l.rate}
                onChange={(e) => updateLine(l.id, { rate: e.target.value })}
                placeholder="Rate"
                className="input"
              />
              <input
                type="number"
                step="0.01"
                value={l.otRate}
                onChange={(e) => updateLine(l.id, { otRate: e.target.value })}
                placeholder="OT rate"
                className="input"
              />
              <input
                value={l.nationality}
                onChange={(e) => updateLine(l.id, { nationality: e.target.value })}
                placeholder="Nationality"
                className="input"
              />
              <div className="flex gap-2">
                <input
                  value={l.workingHours}
                  onChange={(e) => updateLine(l.id, { workingHours: e.target.value })}
                  placeholder="Hours"
                  className="input min-w-0 flex-1"
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
          className="btn btn-secondary btn-sm mt-3"
        >
          + Add line
        </button>
      </div>

      <button
        type="button"
        onClick={handleSubmit}
        disabled={pending || !clientId}
        className="btn btn-primary"
      >
        {pending ? "Creating…" : "Create Quotation"}
      </button>
    </div>
  );
}
