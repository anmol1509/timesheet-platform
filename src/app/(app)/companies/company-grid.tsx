"use client";

import { TemplatePicker } from "@/components/TimesheetTemplatePicker";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Download, FileArchive, Loader2 } from "lucide-react";
import { toCsv, downloadCsv } from "@/lib/csv";
import { useRowSelection } from "@/lib/useRowSelection";
import { Checkbox } from "@/components/ui/Checkbox";
import { Dialog, DialogContent } from "@/components/ui/Dialog";

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
  const [zipping, setZipping] = useState(false);
  const [zipError, setZipError] = useState<string | null>(null);
  const [askGas, setAskGas] = useState(false);
  const [template, setTemplate] = useState<string>("standard");
  const [waived, setWaived] = useState<Record<string, boolean>>({});

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

  async function downloadPdfs(gasWaived: Record<string, boolean>) {
    setAskGas(false);
    setZipping(true);
    setZipError(null);
    try {
      const res = await fetch("/api/generate/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ supplierIds: [...selected], month, gasWaived, template }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setZipError(body?.error ?? "Couldn't generate the timesheets.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `timesheets-${month}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      const left = Number(res.headers.get("X-Skipped") ?? 0);
      if (left > 0) setZipError(`${left} company(ies) were left out — see NOT-GENERATED.txt in the zip.`);
    } catch {
      setZipError("Couldn't generate the timesheets. Try again.");
    } finally {
      setZipping(false);
    }
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
          <button
            type="button"
            onClick={() => { setWaived({}); setAskGas(true); }}
            disabled={selected.size === 0 || zipping}
            title={selected.size === 0 ? "Select companies first" : "One PDF per company, zipped"}
            className="btn btn-primary flex gap-1.5 px-3 disabled:opacity-50"
          >
            {zipping ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileArchive className="h-4 w-4" />}
            {zipping ? "Generating…" : selected.size > 0 ? `Download PDFs (${selected.size})` : "Download PDFs"}
          </button>
        </div>
      </div>

      <Dialog open={askGas} onOpenChange={setAskGas}>
        <DialogContent title="Layout and gas" description="Choose the layout for these timesheets. Gas is charged on each one unless you waive it; tick the companies that do not pay gas.">
          <div className="mt-4 space-y-3">
            <TemplatePicker value={template} onChange={setTemplate} compact />
            <ul className="max-h-72 divide-y divide-[var(--border)] overflow-y-auto rounded-control border border-default">
              {companies.filter((c) => selected.has(c.id)).map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <span className="min-w-0 truncate text-sm text-primary">{c.name}</span>
                  <label className="flex shrink-0 items-center gap-2 text-sm text-secondary">
                    <input type="checkbox" checked={waived[c.id] === true} onChange={(e) => setWaived((w) => ({ ...w, [c.id]: e.target.checked }))} />
                    Waive gas
                  </label>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex gap-3 text-xs">
                <button type="button" className="text-[var(--brand-primary)] hover:underline" onClick={() => setWaived(Object.fromEntries([...selected].map((id) => [id, true])))}>Waive for all</button>
                <button type="button" className="text-[var(--brand-primary)] hover:underline" onClick={() => setWaived({})}>Charge all</button>
              </div>
              <div className="flex gap-2">
                <button type="button" className="btn btn-secondary" onClick={() => setAskGas(false)}>Cancel</button>
                <button type="button" className="btn btn-primary" onClick={() => void downloadPdfs(waived)}>Generate {selected.size} PDF{selected.size === 1 ? "" : "s"}</button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {zipError && (
        <p role="alert" className="whitespace-pre-line rounded-control bg-[var(--warning-soft)] px-3 py-2 text-sm text-[var(--warning)]">
          {zipError}
        </p>
      )}

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
              className="mt-4 text-sm font-medium text-[var(--brand-primary)] hover:underline"
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
