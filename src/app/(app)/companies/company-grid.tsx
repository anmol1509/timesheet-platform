"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type CompanyRow = {
  id: string;
  name: string;
  fullName: string | null;
  employeeCount: number;
  totalHours: number;
  totalAmount: number;
};

export function CompanyGrid({
  companies,
  month,
}: {
  companies: CompanyRow[];
  month: string;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return companies;
    return companies.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.fullName || "").toLowerCase().includes(q)
    );
  }, [companies, query]);

  return (
    <div className="space-y-4">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search companies…"
        className="w-full max-w-xs rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-900"
      />

      {filtered.length === 0 && (
        <p className="text-sm text-slate-500">No companies match &ldquo;{query}&rdquo;.</p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((c) => (
          <Link
            key={c.id}
            href={`/companies/${c.id}/generate?month=${month}`}
            className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow-md"
          >
            <h2 className="text-base font-semibold text-slate-900">{c.name}</h2>
            <p className="mt-1 text-xs text-slate-400">
              {c.fullName || "No letterhead name set"}
            </p>
            <div className="mt-4 flex items-center gap-4 text-sm text-slate-600">
              <span>{c.employeeCount} employees</span>
              <span>{c.totalHours.toFixed(1)} hrs</span>
            </div>
            <div className="mt-1 text-sm font-medium text-slate-900">
              AED {c.totalAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
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
