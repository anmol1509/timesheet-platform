"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { toCsv, downloadCsv } from "@/lib/csv";
import { useRowSelection } from "@/lib/useRowSelection";
import { Checkbox } from "@/components/ui/Checkbox";

type CompanyRow = {
  id: string;
  name: string;
  fullName: string | null;
  employeeCount: number;
  totalHours: number;
  totalAmount: number;
  invoiceApproved: boolean;
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

  const { selected, toggle, toggleAll, allSelected, clear } = useRowSelection(
    filtered.map((c) => c.id)
  );

  function exportCsv() {
    const rows = selected.size > 0 ? filtered.filter((c) => selected.has(c.id)) : filtered;
    const csv = toCsv(rows, [
      { header: "Company", value: (c) => c.name },
      { header: "Full Name", value: (c) => c.fullName },
      { header: "Employees", value: (c) => c.employeeCount },
      { header: "Total Hours", value: (c) => c.totalHours },
      { header: "Total Amount (AED)", value: (c) => c.totalAmount.toFixed(2) },
    ]);
    downloadCsv(`companies-${month}.csv`, csv);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search companies…"
          className="input w-full max-w-xs"
        />
        <div className="flex shrink-0 items-center gap-2">
          <Checkbox
            checked={allSelected}
            onCheckedChange={() => toggleAll()}
            label={<span className="text-xs font-medium text-muted">Select all</span>}
          />
          <button
            type="button"
            onClick={exportCsv}
            className="btn btn-secondary flex gap-1.5 px-3"
          >
            <Download className="h-4 w-4" />
            {selected.size > 0 ? `Export selected (${selected.size})` : "Export CSV"}
          </button>
        </div>
      </div>

      {filtered.length === 0 && (
        <p className="text-sm text-muted">No companies match &ldquo;{query}&rdquo;.</p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((c) => (
          <div
            key={c.id}
            className={`relative flex flex-col rounded-card border bg-surface p-5 transition hover:shadow-md ${
              selected.has(c.id)
                ? "border-brand ring-1 ring-[var(--brand-primary)]"
                : "border-default hover:border-strong"
            }`}
          >
            <Checkbox
              checked={selected.has(c.id)}
              onCheckedChange={() => toggle(c.id)}
              className="absolute top-4 right-4"
            />
            <h2 className="pr-8 text-base font-semibold text-primary">{c.name}</h2>
            <p className="mt-1 text-xs text-subtle">
              {c.fullName || "No letterhead name set"}
            </p>
            <div className="mt-4 flex items-center gap-4 text-sm text-secondary">
              <span>{c.employeeCount} employees</span>
              <span>{c.totalHours.toFixed(1)} hrs</span>
            </div>
            <div className="mt-1 text-sm font-medium text-primary">
              AED {c.totalAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </div>
            {/* Flagged on the card so an unapprovable company is obvious
                before its sheet is opened and reviewed. */}
            {!c.invoiceApproved && (
              <p className="mt-3 text-xs font-medium text-[var(--warning)]">
                Not invoice-approved
              </p>
            )}
            <Link
              href={`/companies/${c.id}/generate?month=${month}`}
              className="mt-4 text-sm font-medium text-blue-600 hover:underline"
            >
              Review &amp; generate →
            </Link>
          </div>
        ))}
      </div>
      {selected.size > 0 && (
        <button
          type="button"
          onClick={clear}
          className="text-xs font-medium text-muted hover:underline"
        >
          Clear selection ({selected.size})
        </button>
      )}
    </div>
  );
}
