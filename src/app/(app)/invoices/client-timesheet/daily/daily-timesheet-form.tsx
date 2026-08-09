"use client";

import { useState, useTransition } from "react";
import { Select } from "@/components/ui/Select";
import { submitDailyTimesheetAction } from "../actions";

type Supplier = { id: string; name: string };
type EmployeeOption = {
  id: string;
  name: string;
  employeeIdNo: string;
  trade: string | null;
  supplierId: string;
  projectId: string;
  projectName: string;
};

function todayValue() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function DailyTimesheetForm({
  suppliers,
  employees,
}: {
  suppliers: Supplier[];
  employees: EmployeeOption[];
}) {
  const [pending, startTransition] = useTransition();
  const [supplierId, setSupplierId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [date, setDate] = useState(todayValue());
  const [rates, setRates] = useState<Record<string, string>>({});
  const [values, setValues] = useState<Record<string, string>>({});
  const [result, setResult] = useState<string | null>(null);

  const projectOptions = [
    ...new Map(
      employees.filter((e) => e.supplierId === supplierId).map((e) => [e.projectId, e.projectName])
    ),
  ].map(([value, label]) => ({ value, label }));

  const rows = employees.filter((e) => e.supplierId === supplierId && e.projectId === projectId);

  function selectSupplier(id: string) {
    setSupplierId(id);
    setProjectId("");
  }

  function handleSubmit() {
    const rowsJson = JSON.stringify(
      rows
        .filter((e) => (values[e.id] || "").trim())
        .map((e) => ({ employeeId: e.id, rate: rates[e.id] || "", value: values[e.id] }))
    );
    const formData = new FormData();
    formData.append("date", date);
    formData.append("supplierId", supplierId);
    formData.append("projectId", projectId);
    formData.append("rowsJson", rowsJson);
    startTransition(async () => {
      const res = await submitDailyTimesheetAction(formData);
      if (res.error) {
        setResult(res.error);
      } else {
        setResult(`Saved ${res.saved} of ${res.requested} entered rows.`);
        setValues({});
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 rounded-3xl border border-slate-200 bg-white p-5 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-500">Supplier</span>
          <Select
            value={supplierId}
            onChange={selectSupplier}
            placeholder="Select supplier"
            options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-500">Project</span>
          <Select
            value={projectId}
            onChange={setProjectId}
            placeholder={supplierId ? "Select project" : "Select a supplier first"}
            disabled={!supplierId}
            options={projectOptions}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-500">Date</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
          />
        </label>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Employees</h2>
        {!supplierId || !projectId ? (
          <p className="text-sm text-slate-500">Select a supplier and a project first.</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-slate-500">No employees for this supplier on this project.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 text-left text-xs font-medium tracking-wide text-slate-500 uppercase">
                <tr>
                  <th className="px-2 py-2">Employee</th>
                  <th className="px-2 py-2">Trade</th>
                  <th className="px-2 py-2">Rate</th>
                  <th className="px-2 py-2">Hours</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((e) => (
                  <tr key={e.id}>
                    <td className="px-2 py-2 text-slate-900">
                      {e.name} <span className="text-slate-400">{e.employeeIdNo}</span>
                    </td>
                    <td className="px-2 py-2 text-slate-600">{e.trade || "—"}</td>
                    <td className="px-2 py-2">
                      <input
                        value={rates[e.id] || ""}
                        onChange={(ev) => setRates((prev) => ({ ...prev, [e.id]: ev.target.value }))}
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="Rate"
                        className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-slate-900"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        value={values[e.id] || ""}
                        onChange={(ev) => setValues((prev) => ({ ...prev, [e.id]: ev.target.value }))}
                        placeholder="e.g. 8, A, OFF"
                        className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-slate-900"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {result && <p className="text-sm text-slate-600">{result}</p>}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={pending || !supplierId || !projectId || rows.length === 0}
        className="rounded-lg bg-[#166534] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#166534]/90 disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save Daily Timesheet"}
      </button>
    </div>
  );
}
