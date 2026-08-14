"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import {
  assignEmployeesToVehicleAction,
  unassignEmployeeFromVehicleAction,
} from "../actions";
import { Checkbox } from "@/components/ui/Checkbox";
import { DeleteButton } from "@/components/DeleteButton";

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
      <h2 className="mb-3 text-sm font-semibold text-primary">
        Roster ({roster.length})
      </h2>
      <div className="card space-y-4 p-5">
        {roster.length === 0 ? (
          <p className="rounded-lg border border-dashed border-strong px-4 py-6 text-center text-sm text-muted">
            No employees assigned yet. Pick from the list below.
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-default">
            <table className="w-full text-sm">
              <thead className="border-b border-default bg-surface-subtle text-left text-xs font-medium tracking-wide text-muted uppercase">
                <tr>
                  <th className="px-4 py-2.5">Employee</th>
                  <th className="px-4 py-2.5">ID No</th>
                  <th className="px-4 py-2.5">Trade</th>
                  <th className="px-4 py-2.5">Project</th>
                  <th className="px-4 py-2.5">Skills</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {roster.map((e) => (
                  <tr key={e.id}>
                    <td className="px-4 py-3 font-medium text-primary">
                      <Link href={`/employees/${e.id}`}>{e.name}</Link>
                    </td>
                    <td className="px-4 py-3 text-muted">{e.employeeIdNo}</td>
                    <td className="px-4 py-3 text-secondary">{e.trade || "—"}</td>
                    <td className="px-4 py-3 text-secondary">{e.projectName || "—"}</td>
                    <td className="px-4 py-3 text-muted">
                      {e.skills.length > 0 ? e.skills.join(", ") : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <DeleteButton
                        action={unassignEmployeeFromVehicleAction}
                        hiddenFields={{ vehicleId, employeeId: e.id }}
                        confirmMessage={`Remove "${e.name}" from this vehicle's roster?`}
                        label="Remove"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs font-semibold tracking-wide text-subtle uppercase">
              Add employees ({available.length} available)
            </h3>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, ID, trade, or project…"
              className="input w-full max-w-xs py-1.5"
            />
          </div>

          <div className="max-h-72 overflow-y-auto rounded-lg border border-default">
            {available.length === 0 ? (
              <p className="px-3 py-4 text-sm text-muted">
                {query ? `No matches for “${query}”.` : "Everyone is already on this roster."}
              </p>
            ) : (
              available.map((e) => (
                <div
                  key={e.id}
                  onClick={() => toggle(e.id)}
                  className="flex cursor-pointer items-center gap-2.5 border-b border-default px-3 py-2 text-sm last:border-b-0 hover:bg-surface-hover"
                >
                  <Checkbox checked={selected.has(e.id)} />
                  <span className="min-w-0 flex-1">
                    <span className="font-medium text-primary">{e.name}</span>{" "}
                    <span className="text-subtle">
                      {e.employeeIdNo}
                      {e.trade ? ` · ${e.trade}` : ""}
                    </span>
                    <span className="block truncate text-xs text-muted">
                      {e.projectName ? `Project: ${e.projectName}` : "No project"}
                      {e.skills.length > 0 ? ` · Skills: ${e.skills.join(", ")}` : ""}
                    </span>
                  </span>
                  {e.vehicleId && (
                    <span className="shrink-0 text-[10px] text-amber-600">
                      on another vehicle
                    </span>
                  )}
                </div>
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
                    className="flex items-center gap-1 rounded-full bg-surface-sunken px-2.5 py-1 text-xs text-secondary"
                  >
                    {emp.name}
                    <button
                      type="button"
                      onClick={() => toggle(id)}
                      className="text-subtle hover:text-secondary"
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
                className="btn btn-primary btn-sm"
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
