"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import {
  assignEmployeesToVehicleAction,
  unassignEmployeeFromVehicleAction,
} from "../actions";

type EmployeeInfo = {
  id: string;
  name: string;
  employeeIdNo: string;
  trade: string | null;
  projectName: string | null;
  skills: string[];
};

type EmployeeOption = EmployeeInfo & { vehicleId: string | null };

export function RosterManager({
  vehicleId,
  roster,
  allEmployees,
}: {
  vehicleId: string;
  roster: EmployeeInfo[];
  allEmployees: EmployeeOption[];
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();

  const available = useMemo(() => {
    const rosterIds = new Set(roster.map((e) => e.id));
    const q = query.trim().toLowerCase();
    return allEmployees
      .filter((e) => !rosterIds.has(e.id))
      .filter(
        (e) =>
          !q ||
          e.name.toLowerCase().includes(q) ||
          e.employeeIdNo.toLowerCase().includes(q) ||
          (e.trade || "").toLowerCase().includes(q) ||
          (e.projectName || "").toLowerCase().includes(q)
      );
  }, [query, allEmployees, roster]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function assignSelected() {
    if (selected.size === 0) return;
    const formData = new FormData();
    formData.set("vehicleId", vehicleId);
    for (const id of selected) formData.append("employeeId", id);
    startTransition(async () => {
      await assignEmployeesToVehicleAction(formData);
      setSelected(new Set());
      setQuery("");
    });
  }

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-slate-900">
        Roster ({roster.length})
      </h2>
      <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
        {roster.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">
            No employees assigned yet. Pick from the list below.
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium tracking-wide text-slate-500 uppercase">
                <tr>
                  <th className="px-4 py-2.5">Employee</th>
                  <th className="px-4 py-2.5">ID No</th>
                  <th className="px-4 py-2.5">Trade</th>
                  <th className="px-4 py-2.5">Project</th>
                  <th className="px-4 py-2.5">Skills</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {roster.map((e) => (
                  <tr key={e.id}>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      <Link href={`/employees/${e.id}`}>{e.name}</Link>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{e.employeeIdNo}</td>
                    <td className="px-4 py-3 text-slate-600">{e.trade || "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{e.projectName || "—"}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {e.skills.length > 0 ? e.skills.join(", ") : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <form action={unassignEmployeeFromVehicleAction}>
                        <input type="hidden" name="vehicleId" value={vehicleId} />
                        <input type="hidden" name="employeeId" value={e.id} />
                        <button
                          type="submit"
                          className="text-xs font-medium text-red-600 hover:underline"
                        >
                          Remove
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
              Add employees ({available.length} available)
            </h3>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, ID, trade, or project…"
              className="w-full max-w-xs rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-slate-900"
            />
          </div>

          <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-200">
            {available.length === 0 ? (
              <p className="px-3 py-4 text-sm text-slate-500">
                {query ? `No matches for “${query}”.` : "Everyone is already on this roster."}
              </p>
            ) : (
              available.map((e) => (
                <label
                  key={e.id}
                  className="flex cursor-pointer items-center gap-2.5 border-b border-slate-100 px-3 py-2 text-sm last:border-b-0 hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(e.id)}
                    onChange={() => toggle(e.id)}
                    className="h-4 w-4 shrink-0 rounded border-slate-300"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="font-medium text-slate-900">{e.name}</span>{" "}
                    <span className="text-slate-400">
                      {e.employeeIdNo}
                      {e.trade ? ` · ${e.trade}` : ""}
                    </span>
                    <span className="block truncate text-xs text-slate-500">
                      {e.projectName ? `Project: ${e.projectName}` : "No project"}
                      {e.skills.length > 0 ? ` · Skills: ${e.skills.join(", ")}` : ""}
                    </span>
                  </span>
                  {e.vehicleId && (
                    <span className="shrink-0 text-[10px] text-amber-600">
                      on another vehicle
                    </span>
                  )}
                </label>
              ))
            )}
          </div>

          {selected.size > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {[...selected].map((id) => {
                const emp = allEmployees.find((e) => e.id === id);
                if (!emp) return null;
                return (
                  <span
                    key={id}
                    className="flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700"
                  >
                    {emp.name}
                    <button
                      type="button"
                      onClick={() => toggle(id)}
                      className="text-slate-400 hover:text-slate-700"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                );
              })}
              <button
                type="button"
                disabled={pending}
                onClick={assignSelected}
                className="rounded-lg bg-[#0B1642] px-3 py-1.5 text-xs font-medium text-white transition hover:bg-[#0B1642]/90 disabled:opacity-60"
              >
                {pending ? "Assigning…" : `Assign ${selected.size} to roster`}
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
