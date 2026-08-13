"use client";

import { useActionState, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { submitManualEntryAction } from "../actions";
import { Select } from "@/components/ui/Select";
import { Combobox } from "@/components/ui/Combobox";

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
}: {
  supplierNames: string[];
  clientNames: string[];
  projects: ProjectOption[];
  sites: SiteOption[];
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
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <div className="flex flex-wrap items-end justify-between gap-3 rounded-3xl border border-slate-200 bg-white p-4">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-500">
            Month
          </span>
          <input
            type="month"
            value={month}
            onChange={(e) => updateMonth(e.target.value)}
            required
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-500">
            Project (optional — enables Approved Rates on the invoice)
          </span>
          <Select
            value={projectId}
            onChange={(v) => {
              setProjectId(v);
              setSiteId("");
            }}
            placeholder="No project"
            options={projects.map((p) => ({ value: p.id, label: `${p.code} — ${p.name}` }))}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-500">
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
        <button
          type="button"
          onClick={addRow}
          className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          <Plus className="h-4 w-4" /> Add Row
        </button>
      </div>

      <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium tracking-wide text-slate-500 uppercase">
            <tr>
              <th className="sticky left-0 z-10 bg-slate-50 px-3 py-3">ID No</th>
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
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="sticky left-0 z-10 bg-white px-3 py-2">
                  <input
                    value={row.employeeIdNo}
                    onChange={(e) =>
                      updateRow(row.id, { employeeIdNo: e.target.value })
                    }
                    placeholder="ID No"
                    className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-[var(--brand-primary)]"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    value={row.employeeName}
                    onChange={(e) =>
                      updateRow(row.id, { employeeName: e.target.value })
                    }
                    placeholder="Name"
                    className="w-40 rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-[var(--brand-primary)]"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    value={row.trade}
                    onChange={(e) => updateRow(row.id, { trade: e.target.value })}
                    placeholder="Trade"
                    className="w-28 rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-[var(--brand-primary)]"
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
                    className="w-20 rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-[var(--brand-primary)]"
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
                      className="w-12 rounded-lg border border-slate-300 px-1 py-1.5 text-center text-xs outline-none focus:border-[var(--brand-primary)]"
                    />
                  </td>
                ))}
                <td className="px-2 py-2">
                  <button
                    type="button"
                    onClick={() => removeRow(row.id)}
                    disabled={rows.length === 1}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30"
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

      <p className="text-xs text-slate-400">
        Enter hours worked per day, &ldquo;A&rdquo; for absent, or leave blank
        / &ldquo;OFF&rdquo; for a day off. Employees, suppliers, and clients
        that don&rsquo;t exist yet are created automatically, same as an
        Excel upload.
      </p>

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--brand-primary-hover)] disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save Timesheet Entries"}
      </button>
    </form>
  );
}
