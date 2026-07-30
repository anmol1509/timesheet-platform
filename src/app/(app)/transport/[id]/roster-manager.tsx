"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import {
  assignEmployeesToVehicleAction,
  unassignEmployeeFromVehicleAction,
} from "../actions";

type EmployeeOption = {
  id: string;
  name: string;
  employeeIdNo: string;
  trade: string | null;
  vehicleId: string | null;
};

export function RosterManager({
  vehicleId,
  roster,
  allEmployees,
}: {
  vehicleId: string;
  roster: { id: string; name: string; employeeIdNo: string; trade: string | null }[];
  allEmployees: EmployeeOption[];
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();

  const rosterIds = new Set(roster.map((e) => e.id));

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return allEmployees
      .filter((e) => !rosterIds.has(e.id))
      .filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.employeeIdNo.toLowerCase().includes(q)
      )
      .slice(0, 20);
  }, [query, allEmployees, rosterIds]);

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
      setOpen(false);
    });
  }

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-slate-900">
        Roster ({roster.length})
      </h2>
      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
        <div className="relative">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500">
              Search employees by name or ID to add
            </span>
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              placeholder="Type a name or ID number…"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            />
          </label>
          {(open && query.trim()) || selected.size > 0 ? (
            <div className="absolute top-full left-0 z-10 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg">
              {open && query.trim() && (
                <div className="max-h-64 overflow-y-auto">
                  {matches.length === 0 ? (
                    <p className="px-3 py-3 text-sm text-slate-500">
                      No unassigned matches for &ldquo;{query}&rdquo;.
                    </p>
                  ) : (
                    matches.map((e) => (
                      <label
                        key={e.id}
                        className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50"
                      >
                        <input
                          type="checkbox"
                          checked={selected.has(e.id)}
                          onChange={() => toggle(e.id)}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                        <span className="flex-1">
                          <span className="font-medium text-slate-900">
                            {e.name}
                          </span>{" "}
                          <span className="text-slate-400">
                            {e.employeeIdNo}
                            {e.trade ? ` · ${e.trade}` : ""}
                          </span>
                        </span>
                        {e.vehicleId && (
                          <span className="text-[10px] text-amber-600">
                            on another vehicle
                          </span>
                        )}
                      </label>
                    ))
                  )}
                </div>
              )}
              {selected.size > 0 && (
                <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 p-3">
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
          ) : null}
        </div>

        {roster.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">
            No employees assigned yet. Search above to add some.
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-100">
                {roster.map((e) => (
                  <tr key={e.id}>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      <Link href={`/employees/${e.id}`}>{e.name}</Link>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{e.employeeIdNo}</td>
                    <td className="px-4 py-3 text-slate-600">{e.trade}</td>
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
      </div>
    </section>
  );
}
