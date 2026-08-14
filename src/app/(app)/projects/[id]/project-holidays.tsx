"use client";

import { useState, useTransition } from "react";
import { addProjectHolidayAction, removeProjectHolidayAction } from "../actions";
import { DeleteButton } from "@/components/DeleteButton";

type Holiday = { id: string; date: Date; label: string; rateMultiplier: number | null };

function fmtDate(d: Date) {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function ProjectHolidays({
  projectId,
  holidays,
}: {
  projectId: string;
  holidays: Holiday[];
}) {
  const [date, setDate] = useState("");
  const [label, setLabel] = useState("");
  const [rateMultiplier, setRateMultiplier] = useState("");
  const [pending, startTransition] = useTransition();

  function add() {
    if (!date || !label.trim()) return;
    const formData = new FormData();
    formData.set("projectId", projectId);
    formData.set("date", date);
    formData.set("label", label.trim());
    formData.set("rateMultiplier", rateMultiplier);
    startTransition(async () => {
      await addProjectHolidayAction(formData);
      setDate("");
      setLabel("");
      setRateMultiplier("");
    });
  }

  const sorted = [...holidays].sort((a, b) => a.date.getTime() - b.date.getTime());

  return (
    <div className="card overflow-hidden">
      {sorted.length > 0 && (
        <table className="w-full text-sm">
          <thead className="border-b border-default bg-surface-subtle text-left text-xs font-medium tracking-wide text-muted uppercase">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Label</th>
              <th className="px-4 py-3 text-right">Rate multiplier</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {sorted.map((h) => (
              <tr key={h.id}>
                <td className="px-4 py-3 text-primary">{fmtDate(h.date)}</td>
                <td className="px-4 py-3 text-secondary">{h.label}</td>
                <td className="px-4 py-3 text-right text-secondary">
                  {h.rateMultiplier ? `${h.rateMultiplier}x` : "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  <DeleteButton
                    action={removeProjectHolidayAction}
                    hiddenFields={{ projectId, holidayId: h.id }}
                    confirmMessage={`Remove holiday "${h.label}"?`}
                    label="Remove"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {sorted.length === 0 && (
        <p className="px-4 py-8 text-center text-sm text-muted">
          No holidays added yet.
        </p>
      )}
      <div className="flex flex-wrap items-end gap-3 border-t border-default p-4">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">Date</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="input"
          />
        </label>
        <label className="block min-w-[160px] flex-1">
          <span className="mb-1 block text-xs font-medium text-muted">Label</span>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. UAE National Day"
            className="input w-full"
          />
        </label>
        <label className="block w-36">
          <span className="mb-1 block text-xs font-medium text-muted">
            Rate multiplier (optional)
          </span>
          <input
            type="number"
            step="0.1"
            value={rateMultiplier}
            onChange={(e) => setRateMultiplier(e.target.value)}
            placeholder="e.g. 1.5"
            className="input w-full"
          />
        </label>
        <button
          type="button"
          disabled={pending}
          onClick={add}
          className="btn btn-primary"
        >
          + Add
        </button>
      </div>
    </div>
  );
}
