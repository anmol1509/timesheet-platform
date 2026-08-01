"use client";

import { useState, useTransition } from "react";
import { addProjectHolidayAction, removeProjectHolidayAction } from "../actions";

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
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      {sorted.length > 0 && (
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium tracking-wide text-slate-500 uppercase">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Label</th>
              <th className="px-4 py-3 text-right">Rate multiplier</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sorted.map((h) => (
              <tr key={h.id}>
                <td className="px-4 py-3 text-slate-900">{fmtDate(h.date)}</td>
                <td className="px-4 py-3 text-slate-600">{h.label}</td>
                <td className="px-4 py-3 text-right text-slate-600">
                  {h.rateMultiplier ? `${h.rateMultiplier}x` : "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  <form action={removeProjectHolidayAction}>
                    <input type="hidden" name="projectId" value={projectId} />
                    <input type="hidden" name="holidayId" value={h.id} />
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
      )}
      {sorted.length === 0 && (
        <p className="px-4 py-8 text-center text-sm text-slate-500">
          No holidays added yet.
        </p>
      )}
      <div className="flex flex-wrap items-end gap-3 border-t border-slate-100 p-4">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-500">Date</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
          />
        </label>
        <label className="block min-w-[160px] flex-1">
          <span className="mb-1 block text-xs font-medium text-slate-500">Label</span>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. UAE National Day"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
          />
        </label>
        <label className="block w-36">
          <span className="mb-1 block text-xs font-medium text-slate-500">
            Rate multiplier (optional)
          </span>
          <input
            type="number"
            step="0.1"
            value={rateMultiplier}
            onChange={(e) => setRateMultiplier(e.target.value)}
            placeholder="e.g. 1.5"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
          />
        </label>
        <button
          type="button"
          disabled={pending}
          onClick={add}
          className="rounded-lg bg-[#0B1642] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#0B1642]/90 disabled:opacity-50"
        >
          + Add
        </button>
      </div>
    </div>
  );
}
