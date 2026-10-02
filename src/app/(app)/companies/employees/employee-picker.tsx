"use client";

import { useMemo, useState } from "react";
import { FileArchive, Loader2 } from "lucide-react";
import { TemplatePicker } from "@/components/TimesheetTemplatePicker";
import type { TimesheetTemplateKey } from "@/lib/timesheetTemplates";
import { Checkbox } from "@/components/ui/Checkbox";

type Row = { employeeIdNo: string; name: string; trade: string | null; hours: number; companyId: string; company: string; approved: boolean };

export function EmployeeSheetPicker({ month, rows }: { month: string; rows: Row[] }) {
  const [query, setQuery] = useState("");
  const [company, setCompany] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [template, setTemplate] = useState<TimesheetTemplateKey>("standard");
  const [layout, setLayout] = useState<"company" | "person" | "all">("company");
  const [waiveGas, setWaiveGas] = useState(false);
  const [kind, setKind] = useState<"hours" | "invoice">("hours");
  const [show, setShow] = useState({ supplier: true, project: false, client: false });
  const [groupBySupplier, setGroupBySupplier] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const companies = useMemo(() => [...new Map(rows.map((r) => [r.companyId, r.company])).entries()].sort((a, b) => a[1].localeCompare(b[1])), [rows]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => (!company || r.companyId === company) && (!q || r.name.toLowerCase().includes(q) || r.employeeIdNo.toLowerCase().includes(q) || (r.trade ?? "").toLowerCase().includes(q)));
  }, [rows, query, company]);
  const groups = useMemo(() => {
    const m = new Map<string, { id: string; name: string; rows: Row[] }>();
    for (const r of visible) {
      const g = m.get(r.companyId) ?? { id: r.companyId, name: r.company, rows: [] };
      g.rows.push(r);
      m.set(r.companyId, g);
    }
    return [...m.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [visible]);
  const allOn = visible.length > 0 && visible.every((r) => picked.has(r.employeeIdNo));

  function toggle(id: string) {
    setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }
  function toggleAll() {
    setPicked((p) => { const n = new Set(p); for (const r of visible) { if (allOn) n.delete(r.employeeIdNo); else n.add(r.employeeIdNo); } return n; });
  }

  function toggleGroup(rowsInGroup: Row[]) {
    const on = rowsInGroup.every((r) => picked.has(r.employeeIdNo));
    setPicked((p) => { const n = new Set(p); for (const r of rowsInGroup) { if (on) n.delete(r.employeeIdNo); else n.add(r.employeeIdNo); } return n; });
  }

  async function generateHours(format: "pdf" | "xlsx") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/generate/hours", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeIds: [...picked], month, show, groupBySupplier, format }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error ?? "Couldn't generate the sheet.");
        return;
      }
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = `working-hours-${month}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Couldn't generate the sheet. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const chosen = rows.filter((r) => picked.has(r.employeeIdNo));
      const supplierIds = [...new Set(chosen.map((r) => r.companyId))];
      const gasWaived = Object.fromEntries(supplierIds.map((id) => [id, waiveGas]));
      const res = await fetch("/api/generate/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ supplierIds, month, gasWaived, template, employeeIds: chosen.map((r) => r.employeeIdNo), perEmployee: layout === "person", combined: layout === "all" }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error ?? "Couldn't generate the timesheets.");
        return;
      }
      const isPdf = (res.headers.get("Content-Type") ?? "").includes("pdf");
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = isPdf ? `timesheet-selected-employees-${month}.pdf` : `timesheets-${month}-selected.zip`;
      a.click();
      URL.revokeObjectURL(url);
      if (Number(res.headers.get("X-Skipped") ?? 0) > 0) setError("Some companies were left out — see NOT-GENERATED.txt in the zip.");
    } catch {
      setError("Couldn't generate the timesheets. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, ID or trade…" className="input w-full max-w-xs" />
        <select value={company} onChange={(e) => setCompany(e.target.value)} className="input w-auto" aria-label="Company">
          <option value="">All companies</option>
          {companies.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
        <Checkbox checked={allOn} onCheckedChange={toggleAll} label={<span className="text-xs font-medium text-muted">Select all employees shown ({visible.length})</span>} />
      </div>

      <div className="card overflow-hidden">
        <div className="max-h-[420px] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface text-left text-xs font-medium uppercase tracking-wide text-muted">
              <tr><th className="w-10 px-4 py-2" /><th className="px-3 py-2">Employee</th><th className="px-3 py-2">Company</th><th className="px-3 py-2">Trade</th><th className="px-3 py-2 text-right">Hours</th></tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {groups.map((g) => {
                const groupOn = g.rows.every((r) => picked.has(r.employeeIdNo));
                const count = g.rows.filter((r) => picked.has(r.employeeIdNo)).length;
                return [
                  <tr key={`g-${g.id}`} className="bg-[var(--surface-muted,rgba(0,0,0,0.03))]">
                    <td className="px-4 py-2"><Checkbox checked={groupOn} onCheckedChange={() => toggleGroup(g.rows)} ariaLabel={`Select all of ${g.name}`} /></td>
                    <td colSpan={4} className="px-3 py-2 text-sm font-semibold text-primary">{g.name} <span className="ml-2 text-xs font-normal text-muted">{count} of {g.rows.length} selected{!g.rows[0].approved && " · not invoice-approved"}</span></td>
                  </tr>,
                  ...g.rows.map((r) => (
                    <tr key={`${r.companyId}-${r.employeeIdNo}`} className="cursor-pointer hover:bg-[var(--surface-hover,transparent)]" onClick={() => toggle(r.employeeIdNo)}>
                      <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}><Checkbox checked={picked.has(r.employeeIdNo)} onCheckedChange={() => toggle(r.employeeIdNo)} ariaLabel={`Select ${r.name}`} /></td>
                      <td className="px-3 py-2"><span className="font-medium text-primary">{r.name}</span> <span className="text-xs text-muted">{r.employeeIdNo}</span></td>
                      <td className="px-3 py-2 text-secondary">{r.company}</td>
                      <td className="px-3 py-2 text-secondary">{r.trade ?? "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-secondary">{r.hours}</td>
                    </tr>
                  )),
                ];
              })}
              {visible.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-sm text-muted">No one matches.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card space-y-4 p-4">
        <div role="radiogroup" aria-label="Sheet type" className="grid gap-3 sm:grid-cols-2">
          {([
            ["hours", "Working-hours sheet", "One sheet with the selected people's hours, day by day. Choose whether to show supplier, project and client."],
            ["invoice", "Invoice-format timesheet", "The formal timesheet layout used for billing, one per company or per person."],
          ] as const).map(([k, title, text]) => (
            <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)} className={`rounded-card border p-3 text-left transition ${kind === k ? "border-[var(--brand-primary)] bg-[var(--brand-soft,rgba(43,49,135,0.06))]" : "border-default"}`}>
              <span className="block text-sm font-semibold text-primary">{title}</span>
              <span className="mt-0.5 block text-xs text-muted">{text}</span>
            </button>
          ))}
        </div>

        {kind === "hours" ? (
          <>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <span className="text-xs font-medium uppercase tracking-wide text-muted">Also show</span>
              <Checkbox checked={show.supplier} onCheckedChange={(v) => setShow((x) => ({ ...x, supplier: v }))} label={<span className="text-sm">Supplier</span>} />
              <Checkbox checked={show.project} onCheckedChange={(v) => setShow((x) => ({ ...x, project: v }))} label={<span className="text-sm">Project</span>} />
              <Checkbox checked={show.client} onCheckedChange={(v) => setShow((x) => ({ ...x, client: v }))} label={<span className="text-sm">Client</span>} />
              <Checkbox checked={groupBySupplier} onCheckedChange={setGroupBySupplier} label={<span className="text-sm">Group by supplier, with subtotals</span>} />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" className="btn btn-primary flex gap-1.5" disabled={picked.size === 0 || busy} onClick={() => generateHours("pdf")}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileArchive className="h-4 w-4" />}
                {busy ? "Generating…" : `PDF for ${picked.size} selected`}
              </button>
              <button type="button" className="btn btn-secondary" disabled={picked.size === 0 || busy} onClick={() => generateHours("xlsx")}>Excel</button>
              {error && <p role="alert" className="whitespace-pre-line text-sm text-[var(--error)]">{error}</p>}
            </div>
          </>
        ) : (
          <>
        <TemplatePicker value={template} onChange={setTemplate} compact />
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <label className="flex items-center gap-2"><input type="radio" checked={layout === "company"} onChange={() => setLayout("company")} /> One sheet per company (selected people only)</label>
          <label className="flex items-center gap-2"><input type="radio" checked={layout === "all"} onChange={() => setLayout("all")} /> One sheet for all selected employees</label>
          <label className="flex items-center gap-2"><input type="radio" checked={layout === "person"} onChange={() => setLayout("person")} /> A separate sheet for each person</label>
          <Checkbox checked={waiveGas} onCheckedChange={() => setWaiveGas((v) => !v)} label={<span className="text-sm">Waive gas charge</span>} />
        </div>
        <div className="flex items-center gap-3">
          <button type="button" className="btn btn-primary flex gap-1.5" disabled={picked.size === 0 || busy} onClick={generate}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileArchive className="h-4 w-4" />}
            {busy ? "Generating…" : `Generate for ${picked.size} selected`}
          </button>
          {error && <p role="alert" className="whitespace-pre-line text-sm text-[var(--error)]">{error}</p>}
        </div>
          </>
        )}
      </div>
    </div>
  );
}
