"use client";

import { useState, useTransition } from "react";
import { Select } from "@/components/ui/Select";
import { submitDailyTimesheetAction } from "../actions";
import { DatePicker } from "@/components/ui/DatePicker";

import { Button } from "@/components/ui/Button";
type Supplier = { id: string; name: string };
type SiteOption = { id: string; name: string; projectId: string };
type EmployeeOption = {
  id: string;
  name: string;
  employeeIdNo: string;
  trade: string | null;
  supplierId: string;
  projectId: string;
  projectName: string;
  suggestedRate: number;
};

function todayValue() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function DailyTimesheetForm({
  suppliers,
  sites,
  employees,
}: {
  suppliers: Supplier[];
  sites: SiteOption[];
  employees: EmployeeOption[];
}) {
  const [pending, startTransition] = useTransition();
  const [supplierId, setSupplierId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [siteId, setSiteId] = useState("");
  const [date, setDate] = useState(todayValue());
  const [rates, setRates] = useState<Record<string, string>>({});
  const [values, setValues] = useState<Record<string, string>>({});
  const [result, setResult] = useState<string | null>(null);
  const [everyone, setEveryone] = useState("");

  const projectOptions = [
    ...new Map(
      employees.filter((e) => e.supplierId === supplierId).map((e) => [e.projectId, e.projectName])
    ),
  ].map(([value, label]) => ({ value, label }));

  const rows = employees.filter((e) => e.supplierId === supplierId && e.projectId === projectId);

  const siteOptions = sites
    .filter((s) => s.projectId === projectId)
    .map((s) => ({ value: s.id, label: s.name }));

  function selectSupplier(id: string) {
    setSupplierId(id);
    setProjectId("");
    setSiteId("");
  }

  function selectProject(id: string) {
    setProjectId(id);
    setSiteId("");
  }

  function handleSubmit() {
    const rowsJson = JSON.stringify(
      rows
        .filter((e) => (values[e.id] || "").trim())
        .map((e) => ({ employeeId: e.id, rate: rates[e.id] ?? (e.suggestedRate > 0 ? String(e.suggestedRate) : ""), value: values[e.id] }))
    );
    const formData = new FormData();
    formData.append("date", date);
    formData.append("supplierId", supplierId);
    formData.append("projectId", projectId);
    formData.append("siteId", siteId);
    formData.append("rowsJson", rowsJson);
    startTransition(async () => {
      const res = await submitDailyTimesheetAction(formData);
      if (res.error) {
        setResult(res.error);
      } else {
        const noRate = rowsJson && (JSON.parse(rowsJson) as { rate: string }[]).filter((r) => !(Number(r.rate) > 0)).length;
        setResult(
          `Saved ${res.saved} of ${res.requested} entered rows.` +
            (res.saved < res.requested ? " Skipped rows are workers with no trade set, or a month that is already locked." : "") +
            (noRate ? ` ${noRate} ${noRate === 1 ? "row has" : "rows have"} no cost rate, so it saved at 0. Set the rate on the worker's profile or type it here and save again.` : "")
        );
        setValues({});
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="card grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">Supplier</span>
          <Select
            value={supplierId}
            onChange={selectSupplier}
            placeholder="Select supplier"
            options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">Project</span>
          <Select
            value={projectId}
            onChange={selectProject}
            placeholder={supplierId ? "Select project" : "Select a supplier first"}
            disabled={!supplierId}
            options={projectOptions}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">Site (optional)</span>
          <Select
            value={siteId}
            onChange={setSiteId}
            placeholder={projectId ? "No site" : "Select a project first"}
            disabled={!projectId}
            options={siteOptions}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">Date</span>
          <DatePicker value={date} onChange={(v) => setDate(v)} className="w-full" />
        </label>
      </div>

      <div className="card p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-primary">Employees</h2>
          {rows.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-muted">
              <span>Same hours for everyone</span>
              <input value={everyone} onChange={(ev) => setEveryone(ev.target.value)} placeholder="8" className="input w-20 px-2 py-1.5" aria-label="Hours for everyone" />
              <Button size="btn" type="button" variant="secondary" onClick={() => setValues(Object.fromEntries(rows.map((e) => [e.id, everyone])))} disabled={!everyone.trim()}>Fill all</Button>
            </div>
          )}
        </div>
        {!supplierId || !projectId ? (
          <p className="text-sm text-muted">Select a supplier and a project first.</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted">No employees for this supplier on this project.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-default text-left text-xs font-medium tracking-wide text-muted uppercase">
                <tr>
                  <th className="px-2 py-2">Employee</th>
                  <th className="px-2 py-2">Trade</th>
                  <th className="px-2 py-2">Rate</th>
                  <th className="px-2 py-2">Hours</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {rows.map((e) => (
                  <tr key={e.id}>
                    <td className="px-2 py-2 text-primary">
                      {e.name} <span className="text-subtle">{e.employeeIdNo}</span>
                    </td>
                    <td className="px-2 py-2 text-secondary">{e.trade || "—"}</td>
                    <td className="px-2 py-2">
                      <input
                        value={rates[e.id] ?? (e.suggestedRate > 0 ? String(e.suggestedRate) : "")}
                        onChange={(ev) => setRates((prev) => ({ ...prev, [e.id]: ev.target.value }))}
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="Rate"
                        className="input w-24 px-2 py-1.5"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        value={values[e.id] || ""}
                        onChange={(ev) => setValues((prev) => ({ ...prev, [e.id]: ev.target.value }))}
                        placeholder="8, A, OFF"
                        className="input w-28 px-2 py-1.5"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {result && <p className="text-sm text-secondary">{result}</p>}

      <Button size="btn" type="button" onClick={handleSubmit} disabled={pending || !supplierId || !projectId || rows.length === 0} loading={pending}>
        Save Daily Timesheet
      </Button>
    </div>
  );
}
