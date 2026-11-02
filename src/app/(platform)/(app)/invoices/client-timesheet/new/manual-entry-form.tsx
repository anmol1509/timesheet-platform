"use client";

import { useActionState, useMemo, useState } from "react";
import { CalendarDays, Plus, Trash2, UsersRound, Wand2 } from "lucide-react";
import { Dialog, DialogClose, DialogContent, DialogFooter } from "@/components/ui/Dialog";
import { submitManualEntryAction } from "../actions";
import { Select } from "@/components/ui/Select";
import { Combobox } from "@/components/ui/Combobox";
import { MonthInput } from "@/components/ui/MonthInput";

import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/Alert";
type RowState = {
  id: string;
  employeeIdNo: string;
  employeeName: string;
  trade: string;
  rate: string;
  supplierName: string;
  clientName: string;
  days: string[];
};

function currentMonthValue() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function daysInMonth(month: string) {
  const [y, m] = month.split("-").map(Number);
  if (!y || !m) return 30;
  return new Date(y, m, 0).getDate();
}

function blankRow(dayCount: number): RowState {
  return {
    id: crypto.randomUUID(),
    employeeIdNo: "",
    employeeName: "",
    trade: "",
    rate: "",
    supplierName: "",
    clientName: "",
    days: Array(dayCount).fill(""),
  };
}

type ProjectOption = { id: string; code: string; name: string };
type SiteOption = { id: string; name: string; projectId: string };

export function ManualEntryForm({
  supplierNames,
  clientNames,
  projects,
  sites,
  roster,
}: {
  supplierNames: string[];
  clientNames: string[];
  projects: ProjectOption[];
  sites: SiteOption[];
  roster: { employeeIdNo: string; name: string; trade: string; supplierName: string }[];
}) {
  const [state, formAction, pending] = useActionState(submitManualEntryAction, {
    error: null,
  });
  const [month, setMonth] = useState(currentMonthValue());
  const [projectId, setProjectId] = useState("");
  const [siteId, setSiteId] = useState("");
  const siteOptions = sites
    .filter((s) => s.projectId === projectId)
    .map((s) => ({ value: s.id, label: s.name }));
  const dayCount = useMemo(() => daysInMonth(month), [month]);
  const [rows, setRows] = useState<RowState[]>(() => [blankRow(dayCount)]);

  function updateMonth(next: string) {
    setMonth(next);
    const nextDayCount = daysInMonth(next);
    setRows((prev) =>
      prev.map((r) => ({
        ...r,
        days: Array.from({ length: nextDayCount }, (_, i) => r.days[i] || ""),
      }))
    );
  }

  function updateRow(id: string, patch: Partial<RowState>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function updateDay(id: string, dayIndex: number, value: string) {
    setRows((prev) =>
      prev.map((r) =>
        r.id === id
          ? { ...r, days: r.days.map((d, i) => (i === dayIndex ? value : d)) }
          : r
      )
    );
  }

  function addRow() {
    setRows((prev) => [...prev, blankRow(dayCount)]);
  }

  function removeRow(id: string) {
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : prev));
  }

  // ---- Bulk month entry: people from the roster, and a pattern for the days ----
  const [picking, setPicking] = useState(false);
  const [pickSearch, setPickSearch] = useState("");
  const [pickSupplier, setPickSupplier] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [hoursPerDay, setHoursPerDay] = useState("10");
  const [dayOff, setDayOff] = useState("5"); // JS weekday: 5 = Friday, 0 = Sunday, "" = none
  const [onlyEmpty, setOnlyEmpty] = useState(true);
  const rosterSuppliers = useMemo(() => [...new Set(roster.map((r) => r.supplierName).filter(Boolean))].sort(), [roster]);
  const shown = useMemo(() => {
    const q = pickSearch.trim().toLowerCase();
    return roster.filter((r) => (!pickSupplier || r.supplierName === pickSupplier) && (!q || r.name.toLowerCase().includes(q) || r.employeeIdNo.toLowerCase().includes(q) || r.trade.toLowerCase().includes(q)));
  }, [roster, pickSearch, pickSupplier]);
  const taken = useMemo(() => new Set(rows.map((r) => r.employeeIdNo.trim().toLowerCase()).filter(Boolean)), [rows]);
  const offered = shown.filter((r) => !taken.has(r.employeeIdNo.toLowerCase()));

  function addPicked() {
    const chosen = roster.filter((r) => picked.has(r.employeeIdNo) && !taken.has(r.employeeIdNo.toLowerCase()));
    setRows((prev) => {
      const kept = prev.filter((r) => r.employeeIdNo.trim() || r.employeeName.trim() || r.days.some((d) => d.trim()));
      return [...kept, ...chosen.map((e) => ({ ...blankRow(dayCount), employeeIdNo: e.employeeIdNo, employeeName: e.name, trade: e.trade, supplierName: e.supplierName }))];
    });
    setPicked(new Set());
    setPicking(false);
  }

  function fillDays() {
    const [y, m] = month.split("-").map(Number);
    const hours = hoursPerDay.trim() || "10";
    const pattern = Array.from({ length: dayCount }, (_, i) => (dayOff !== "" && new Date(y, m - 1, i + 1).getDay() === Number(dayOff) ? "OFF" : hours));
    setRows((prev) => prev.map((r) => (onlyEmpty && r.days.some((d) => d.trim()) ? r : { ...r, days: pattern })));
  }

  const rowsJson = JSON.stringify(
    rows.map(({ id: _id, ...rest }) => rest)
  );

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="month" value={month} />
      <input type="hidden" name="rowsJson" value={rowsJson} readOnly />
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="siteId" value={siteId} />

      {state.error && (
        <Alert>
          {state.error}
        </Alert>
      )}

      <div className="card flex flex-wrap items-end justify-between gap-3 p-4">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">
            Month
          </span>
          <MonthInput value={month} onChange={(v) => updateMonth(v)} required />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">
            Project (optional: enables Approved Rates on the invoice)
          </span>
          <Select
            value={projectId}
            onChange={(v) => {
              setProjectId(v);
              setSiteId("");
            }}
            placeholder="No project"
            options={projects.map((p) => ({ value: p.id, label: `${p.code}: ${p.name}` }))}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">
            Site (optional)
          </span>
          <Select
            value={siteId}
            onChange={setSiteId}
            placeholder={projectId ? "No site" : "Select a project first"}
            disabled={!projectId}
            options={siteOptions}
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setPicking(true)} className="btn btn-primary flex gap-1.5 px-3">
            <UsersRound className="h-4 w-4" /> Add from roster
          </button>
          <button type="button" onClick={addRow} className="btn btn-secondary flex gap-1.5 px-3">
            <Plus className="h-4 w-4" /> Add Row
          </button>
        </div>
      </div>

      <div className="card flex flex-wrap items-end gap-3 p-4">
        <p className="flex w-full items-center gap-2 text-xs font-semibold tracking-wide text-muted uppercase"><Wand2 className="h-3.5 w-3.5" aria-hidden /> Fill the month</p>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">Hours on a working day</span>
          <input value={hoursPerDay} onChange={(e) => setHoursPerDay(e.target.value)} inputMode="decimal" className="input w-24" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">Weekly day off</span>
          <Select value={dayOff} onChange={setDayOff} searchable={false} options={[{ value: "5", label: "Friday" }, { value: "0", label: "Sunday" }, { value: "", label: "None" }]} />
        </label>
        <label className="flex items-center gap-2 pb-2 text-sm text-secondary">
          <input type="checkbox" checked={onlyEmpty} onChange={(e) => setOnlyEmpty(e.target.checked)} /> Only rows with no hours yet
        </label>
        <button type="button" onClick={fillDays} className="btn btn-secondary flex gap-1.5 px-3"><CalendarDays className="h-4 w-4" /> Fill the days</button>
        <p className="w-full text-xs text-subtle">Then change any day by hand: a different number of hours, A for absent, or OFF.</p>
      </div>

      <Dialog open={picking} onOpenChange={setPicking}>
        <DialogContent icon={<UsersRound className="h-[18px] w-[18px]" />} title="Add people from the roster" description="Tick the workers to add. Their ID, name, trade and supplier are filled in for you." className="max-w-2xl">
          <div className="mt-5 flex flex-wrap gap-2">
            <input value={pickSearch} onChange={(e) => setPickSearch(e.target.value)} placeholder="Search name, ID or trade" className="input min-w-[12rem] flex-1" />
            <div className="w-56"><Select value={pickSupplier} onChange={setPickSupplier} placeholder="All suppliers" options={[{ value: "", label: "All suppliers" }, ...rosterSuppliers.map((s) => ({ value: s, label: s }))]} /></div>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs">
            <span className="text-muted">{offered.length} shown{shown.length !== offered.length ? `, ${shown.length - offered.length} already in the table` : ""} · {picked.size} ticked</span>
            <button type="button" className="font-medium text-[var(--brand-primary)] hover:underline" onClick={() => setPicked((p) => (offered.every((o) => p.has(o.employeeIdNo)) ? new Set([...p].filter((id) => !offered.some((o) => o.employeeIdNo === id))) : new Set([...p, ...offered.map((o) => o.employeeIdNo)])))}>
              {offered.length > 0 && offered.every((o) => picked.has(o.employeeIdNo)) ? "Untick these" : "Tick all shown"}
            </button>
          </div>
          <ul className="mt-2 max-h-72 divide-y divide-[var(--border)] overflow-y-auto rounded-card border border-default">
            {offered.slice(0, 300).map((r) => (
              <li key={r.employeeIdNo}>
                <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-surface-hover">
                  <input type="checkbox" checked={picked.has(r.employeeIdNo)} onChange={() => setPicked((p) => { const n = new Set(p); if (n.has(r.employeeIdNo)) n.delete(r.employeeIdNo); else n.add(r.employeeIdNo); return n; })} />
                  <span className="min-w-0 flex-1 truncate text-sm text-primary">{r.name} <span className="tabular ml-1 text-xs text-subtle">{r.employeeIdNo}</span></span>
                  <span className="hidden text-xs text-muted sm:block">{r.trade || "No trade"}</span>
                  <span className="hidden w-36 truncate text-right text-xs text-subtle md:block">{r.supplierName}</span>
                </label>
              </li>
            ))}
            {offered.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted">Nobody matches.</li>}
            {offered.length > 300 && <li className="px-3 py-2 text-xs text-muted">Showing the first 300. Narrow it with the search or a supplier.</li>}
          </ul>
          <DialogFooter>
            <DialogClose asChild><Button size="btn" type="button" variant="secondary">Cancel</Button></DialogClose>
            <Button size="btn" type="button" onClick={addPicked} disabled={picked.size === 0}>Add {picked.size || ""} {picked.size === 1 ? "person" : "people"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-default bg-surface-subtle text-left text-xs font-medium tracking-wide text-muted uppercase">
            <tr>
              <th className="sticky left-0 z-10 bg-surface-subtle px-3 py-3">ID No</th>
              <th className="px-3 py-3">Employee Name</th>
              <th className="px-3 py-3">Trade</th>
              <th className="px-3 py-3">Rate</th>
              <th className="px-3 py-3">Supplier</th>
              <th className="px-3 py-3">Client</th>
              {Array.from({ length: dayCount }, (_, i) => (
                <th key={i} className="px-2 py-3 text-center">
                  {i + 1}
                </th>
              ))}
              <th className="px-2 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="sticky left-0 z-10 bg-white px-3 py-2">
                  <input
                    value={row.employeeIdNo}
                    onChange={(e) =>
                      updateRow(row.id, { employeeIdNo: e.target.value })
                    }
                    placeholder="ID No"
                    className="input w-24 px-2 py-1.5"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    value={row.employeeName}
                    onChange={(e) =>
                      updateRow(row.id, { employeeName: e.target.value })
                    }
                    placeholder="Name"
                    className="input w-40 px-2 py-1.5"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    value={row.trade}
                    onChange={(e) => updateRow(row.id, { trade: e.target.value })}
                    placeholder="Trade"
                    className="input w-28 px-2 py-1.5"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    value={row.rate}
                    onChange={(e) => updateRow(row.id, { rate: e.target.value })}
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="Rate"
                    className="input w-20 px-2 py-1.5"
                  />
                </td>
                <td className="px-3 py-2">
                  <Combobox
                    value={row.supplierName}
                    onChange={(v) => updateRow(row.id, { supplierName: v })}
                    options={supplierNames.map((n) => ({ value: n, label: n }))}
                    placeholder="Supplier"
                    className="w-32 px-2 py-1.5"
                  />
                </td>
                <td className="px-3 py-2">
                  <Combobox
                    value={row.clientName}
                    onChange={(v) => updateRow(row.id, { clientName: v })}
                    options={clientNames.map((n) => ({ value: n, label: n }))}
                    placeholder="Client"
                    className="w-32 px-2 py-1.5"
                  />
                </td>
                {row.days.map((value, dayIndex) => (
                  <td key={dayIndex} className="px-1 py-2">
                    <input
                      value={value}
                      onChange={(e) => updateDay(row.id, dayIndex, e.target.value)}
                      placeholder="—"
                      title="Hours worked, or A for absent, or OFF"
                      className="input w-12 px-1 py-1.5 text-center text-xs"
                    />
                  </td>
                ))}
                <td className="px-2 py-2">
                  <button
                    type="button"
                    onClick={() => removeRow(row.id)}
                    disabled={rows.length === 1}
                    className="rounded-lg p-1.5 text-subtle hover:bg-[var(--error-soft)] hover:text-[var(--error)] disabled:cursor-not-allowed disabled:opacity-30"
                    title="Remove row"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-subtle">
        Enter hours worked per day, &ldquo;A&rdquo; for absent, or leave blank
        / &ldquo;OFF&rdquo; for a day off. Employees, suppliers, and clients
        that don&rsquo;t exist yet are created automatically, same as an
        Excel upload.
      </p>

      <Button size="btn" type="submit" disabled={pending} loading={pending}>
        Save Timesheet Entries
      </Button>
    </form>
  );
}
