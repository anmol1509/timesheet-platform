"use client";

import { TemplatePicker } from "@/components/TimesheetTemplatePicker";
import { IssuerPicker, type IssuerPickerData } from "@/components/IssuerPicker";
import Link from "next/link";
import { useMemo, useState } from "react";
import { BadgeCheck, Download, FileArchive, Loader2 } from "lucide-react";
import { FilterPanel, type FilterField } from "@/components/data-table/FilterPanel";
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
  /** One of your own companies (as opposed to a supplier or sub-contractor). */
  own: boolean;
  projects: string[];
  trades: string[];
};

export function CompanyGrid({
  companies,
  month,
  issuer,
}: {
  companies: CompanyRow[];
  month: string;
  issuer: IssuerPickerData;
}) {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({ type: "", project: "", trade: "", letterhead: "", invoice: "" });
  const [zipping, setZipping] = useState(false);
  const [zipError, setZipError] = useState<string | null>(null);
  const [askGas, setAskGas] = useState(false);
  const [template, setTemplate] = useState<string>("standard");
  const [issuerId, setIssuerId] = useState<string>(issuer.defaultId ?? "");
  const [waived, setWaived] = useState<Record<string, boolean>>({});

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return companies.filter(
      (c) =>
        (!q || c.name.toLowerCase().includes(q) || (c.fullName || "").toLowerCase().includes(q)) &&
        (!filters.type || (filters.type === "own" ? c.own : !c.own)) &&
        (!filters.project || c.projects.includes(filters.project)) &&
        (!filters.trade || c.trades.includes(filters.trade)) &&
        (!filters.letterhead || (filters.letterhead === "set" ? !!c.fullName : !c.fullName)) &&
        (!filters.invoice || (filters.invoice === "approved" ? c.invoiceApproved : !c.invoiceApproved))
    );
  }, [companies, query, filters]);

  const fields: FilterField[] = useMemo(() => {
    const distinct = (get: (c: CompanyRow) => string[]) =>
      [...new Set(companies.flatMap(get))].sort((a, b) => a.localeCompare(b)).map((v) => ({ value: v, label: `${v} (${companies.filter((c) => get(c).includes(v)).length})` }));
    const count = (f: (c: CompanyRow) => boolean) => companies.filter(f).length;
    return [
      { key: "type", label: "Type", all: "All companies", options: [{ value: "own", label: `Our companies (${count((c) => c.own)})` }, { value: "supplier", label: `Suppliers and sub-contractors (${count((c) => !c.own)})` }] },
      { key: "project", label: "Project", all: "All projects", options: distinct((c) => c.projects) },
      { key: "trade", label: "Trade", all: "All trades", options: distinct((c) => c.trades) },
      { key: "letterhead", label: "Letterhead name", all: "Set or not set", options: [{ value: "set", label: `Set (${count((c) => !!c.fullName)})` }, { value: "missing", label: `Not set (${count((c) => !c.fullName)})` }] },
      { key: "invoice", label: "Invoice approval", all: "Approved or not", options: [{ value: "approved", label: `Approved (${count((c) => c.invoiceApproved)})` }, { value: "pending", label: `Not approved (${count((c) => !c.invoiceApproved)})` }] },
    ];
  }, [companies]);

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
        body: JSON.stringify({ supplierIds: [...selected], month, gasWaived, template, issuerId: issuerId || null }),
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
      if (left > 0) setZipError(`${left} company(ies) were left out: see NOT-GENERATED.txt in the zip.`);
    } catch {
      setZipError("Couldn't generate the timesheets. Try again.");
    } finally {
      setZipping(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search companies…"
            className="input w-full max-w-xs"
          />
          <FilterPanel fields={fields} values={filters} onChange={(k, v) => setFilters((f) => ({ ...f, [k]: v }))} />
        </div>
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
        <DialogContent icon={<FileArchive className="h-[18px] w-[18px]" />} title="Layout and gas" description="Choose the layout for these timesheets. Gas is charged on each one unless you waive it; tick the companies that do not pay gas.">
          <div className="mt-4 space-y-3">
            <TemplatePicker value={template} onChange={setTemplate} compact />
            <IssuerPicker data={issuer} value={issuerId} onChange={setIssuerId} compact />
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
            <div className="flex gap-3 text-xs">
                <button type="button" className="text-[var(--brand-primary)] hover:underline" onClick={() => setWaived(Object.fromEntries([...selected].map((id) => [id, true])))}>Waive for all</button>
                <button type="button" className="text-[var(--brand-primary)] hover:underline" onClick={() => setWaived({})}>Charge all</button>
            </div>
            <div data-actions>
                <button type="button" className="btn btn-secondary" onClick={() => setAskGas(false)}>Cancel</button>
                <button type="button" className="btn btn-primary" onClick={() => void downloadPdfs(waived)}>Generate {selected.size} PDF{selected.size === 1 ? "" : "s"}</button>
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
        <p className="text-sm text-muted">No companies match{query ? <> &ldquo;{query}&rdquo;</> : " these filters"}.</p>
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
            {/* Wrapped, because the checkbox is already `relative`: positioning it directly pulled it out of place. */}
            <div className="absolute top-4 right-4 flex h-5 w-5 items-center justify-center">
              <Checkbox checked={selected.has(c.id)} onCheckedChange={() => toggle(c.id)} ariaLabel={`Select ${c.name}`} />
            </div>
            <h2 className="pr-8 text-base font-semibold text-primary">{c.name}</h2>
            {c.own && (
              <span className="mt-1.5 inline-flex w-fit items-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-medium text-[var(--brand-primary)]" title="One of your own companies">
                <BadgeCheck className="h-3.5 w-3.5" aria-hidden /> Our company
              </span>
            )}
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
