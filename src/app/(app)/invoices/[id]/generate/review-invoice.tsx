"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type Entry = {
  id: string;
  employeeIdNo: string;
  employeeName: string;
  trade: string;
  totalHours: number;
  costRate: number;
  supplierName: string;
  billRate: number;
  rateSet: boolean;
};

const VAT_RATE = 0.05;

export function ReviewInvoice({
  client,
  month,
  monthLabel,
  entries,
}: {
  client: { id: string; name: string; trn: string | null; billingAddress: string | null };
  month: string;
  monthLabel: string;
  entries: Entry[];
}) {
  const [rates, setRates] = useState<Record<string, number>>(() =>
    Object.fromEntries(entries.map((e) => [e.id, e.billRate]))
  );
  const [generating, setGenerating] = useState<"xlsx" | "pdf" | "issue" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [issued, setIssued] = useState<{ invoiceNumber: string } | null>(null);

  function resetRate(id: string) {
    setRates((r) => ({ ...r, [id]: entries.find((e) => e.id === id)!.billRate }));
  }

  const rows = useMemo(
    () =>
      entries.map((e) => {
        const rate = rates[e.id] ?? 0;
        const amount = e.totalHours * rate;
        const cost = e.totalHours * e.costRate;
        return { ...e, rate, amount, cost, margin: amount - cost };
      }),
    [entries, rates]
  );

  const subtotal = rows.reduce((s, r) => s + r.amount, 0);
  const totalCost = rows.reduce((s, r) => s + r.cost, 0);
  const vatAmount = subtotal * VAT_RATE;
  const totalAmount = subtotal + vatAmount;
  const margin = subtotal - totalCost;
  const unratedTrades = [...new Set(rows.filter((r) => !r.rateSet).map((r) => r.trade))];

  async function handleGenerate(format: "xlsx" | "pdf", save: boolean) {
    setGenerating(save ? "issue" : format);
    setError(null);
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: client.id,
          month,
          format,
          save,
          rates,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to generate invoice.");
      }
      const invoiceNumber = res.headers.get("X-Invoice-Number");
      if (save && invoiceNumber) setIssued({ invoiceNumber });
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="?([^"]+)"?/);
      const filename = match ? match[1] : `${client.name}-${month}.${format}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate invoice.");
    } finally {
      setGenerating(null);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <Link href="/invoices" className="text-sm text-slate-500 hover:underline">
          ← Invoices
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">{client.name}</h1>
            <p className="mt-1 text-sm text-slate-500">
              {monthLabel} · {entries.length} employees
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleGenerate("xlsx", false)}
              disabled={generating !== null}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
            >
              {generating === "xlsx" ? "Generating…" : "Download draft (XLSX)"}
            </button>
            <button
              onClick={() => handleGenerate("pdf", false)}
              disabled={generating !== null}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
            >
              {generating === "pdf" ? "Generating…" : "Download draft (PDF)"}
            </button>
            <button
              onClick={() => handleGenerate("pdf", true)}
              disabled={generating !== null || issued !== null}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
            >
              {generating === "issue"
                ? "Issuing…"
                : issued
                  ? `Issued as ${issued.invoiceNumber}`
                  : "Issue invoice"}
            </button>
          </div>
        </div>
        {error && (
          <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
        {issued && (
          <div className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            Saved as {issued.invoiceNumber}. Rates are now locked for this invoice — view it
            in{" "}
            <Link href="/invoices/history" className="underline">
              invoice history
            </Link>
            .
          </div>
        )}
        {unratedTrades.length > 0 && !issued && (
          <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
            No billing rate configured for: {unratedTrades.join(", ")}. Those lines default to
            AED 0 — set a rate below, or add it to{" "}
            <Link href={`/clients/${client.id}`} className="underline">
              {client.name}&rsquo;s trade rate card
            </Link>{" "}
            first.
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Line items</h2>
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">ID No</th>
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Trade</th>
                <th className="px-4 py-3">Supplier</th>
                <th className="px-4 py-3 text-right">Hours</th>
                <th className="px-4 py-3 text-right">Bill rate</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-right">Cost</th>
                <th className="px-4 py-3 text-right">Margin</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => {
                const edited = rates[r.id] !== r.billRate;
                return (
                  <tr key={r.id} className={!r.rateSet ? "bg-amber-50/60" : undefined}>
                    <td className="px-4 py-2.5 text-slate-500">{r.employeeIdNo}</td>
                    <td className="px-4 py-2.5 font-medium text-slate-900">
                      {r.employeeName}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">
                      {r.trade}
                      {!r.rateSet && (
                        <span
                          title="No billing rate configured for this trade"
                          className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-amber-500 align-middle"
                        />
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-slate-500">{r.supplierName}</td>
                    <td className="px-4 py-2.5 text-right text-slate-600">
                      {r.totalHours}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={rates[r.id]}
                        disabled={issued !== null}
                        onChange={(ev) =>
                          setRates((prev) => ({
                            ...prev,
                            [r.id]: parseFloat(ev.target.value) || 0,
                          }))
                        }
                        className={`w-24 rounded-lg border px-2 py-1 text-right text-sm outline-none focus:border-slate-900 disabled:opacity-60 ${
                          edited ? "border-amber-300 bg-amber-50" : "border-slate-300"
                        }`}
                      />
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium text-slate-900">
                      {r.amount.toFixed(2)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-slate-500">
                      {r.cost.toFixed(2)}
                    </td>
                    <td
                      className={`px-4 py-2.5 text-right font-medium ${
                        r.margin >= 0 ? "text-emerald-600" : "text-red-600"
                      }`}
                    >
                      {r.margin.toFixed(2)}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {edited && !issued && (
                        <button
                          type="button"
                          onClick={() => resetRate(r.id)}
                          className="text-xs font-medium text-blue-600 hover:underline"
                        >
                          Reset
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Margin</h2>
          <SummaryRow label="Billable amount" value={subtotal} />
          <SummaryRow label="Supplier cost" value={totalCost} />
          <div className="border-t border-slate-200 pt-3">
            <SummaryRow label="Margin" value={margin} bold />
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Invoice total</h2>
          <SummaryRow label="Subtotal" value={subtotal} />
          <SummaryRow label="VAT (5%)" value={vatAmount} />
          <div className="border-t border-slate-200 pt-3">
            <SummaryRow label="Total due (AED)" value={totalAmount} bold />
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  bold,
}: {
  label: string;
  value: number;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-1 text-sm">
      <span className={bold ? "font-semibold text-slate-900" : "text-slate-500"}>
        {label}
      </span>
      <span className={bold ? "text-lg font-semibold text-slate-900" : "text-slate-700"}>
        {value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </span>
    </div>
  );
}
