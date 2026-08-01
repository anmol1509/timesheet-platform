"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type ClientRow = {
  id: string;
  name: string;
  employeeCount: number;
  totalHours: number;
  billRateSet: boolean;
  unratedTrades: string[];
  amount: number;
  margin: number;
};

export function InvoiceGrid({
  clients,
  month,
}: {
  clients: ClientRow[];
  month: string;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) => c.name.toLowerCase().includes(q));
  }, [clients, query]);

  return (
    <div className="space-y-4">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search clients…"
        className="w-full max-w-xs rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-900"
      />

      {filtered.length === 0 && (
        <p className="text-sm text-slate-500">No clients match &ldquo;{query}&rdquo;.</p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((c) => (
          <Link
            key={c.id}
            href={`/invoices/${c.id}/generate?month=${month}`}
            className="group flex flex-col rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow-md"
          >
            <h2 className="text-base font-semibold text-slate-900">{c.name}</h2>
            {!c.billRateSet && (
              <p className="mt-1 text-xs font-medium text-amber-600">
                No rate for: {c.unratedTrades.join(", ")}
              </p>
            )}
            <div className="mt-4 flex items-center gap-4 text-sm text-slate-600">
              <span>{c.employeeCount} employees</span>
              <span>{c.totalHours.toFixed(1)} hrs</span>
            </div>
            <div className="mt-1 text-sm font-medium text-slate-900">
              AED {c.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </div>
            <div
              className={`mt-1 text-xs font-medium ${
                c.margin >= 0 ? "text-emerald-600" : "text-red-600"
              }`}
            >
              Margin: AED {c.margin.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </div>
            <span className="mt-4 text-sm font-medium text-blue-600 group-hover:underline">
              Review &amp; generate →
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
