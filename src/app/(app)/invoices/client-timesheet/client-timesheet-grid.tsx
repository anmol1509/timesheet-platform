"use client";

import { useMemo, useState, useTransition } from "react";
import { Checkbox } from "@/components/ui/Checkbox";
import {
  updateDailyHoursAction,
  batchUpdateHoursAction,
  submitTimesheetForReviewAction,
  approveTimesheetAction,
  rejectTimesheetAction,
} from "./actions";
import type { DailyHourCell } from "@/lib/parseTimesheet";

type Entry = {
  id: string;
  employeeIdNo: string;
  employeeName: string;
  trade: string;
  dailyHours: string;
  totalHours: number;
  absentCount: number;
  status: string;
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-600",
  SUBMITTED: "bg-blue-100 text-blue-700",
  UNDER_REVIEW: "bg-amber-100 text-amber-700",
  CLIENT_APPROVED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-red-100 text-red-700",
  LOCKED: "bg-slate-800 text-white",
};

function badgeClass(value: string) {
  const v = value.trim().toUpperCase();
  if (!v) return "bg-slate-50 text-slate-300"; // missing
  if (v === "A") return "bg-red-50 text-red-700";
  if (v === "OFF") return "bg-slate-100 text-slate-500";
  return "bg-emerald-50 text-emerald-700"; // numeric hours entered
}

export function ClientTimesheetGrid({ month, entries }: { month: string; entries: Entry[] }) {
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [edited, setEdited] = useState<Record<string, DailyHourCell[]>>({});
  const [showBatch, setShowBatch] = useState(false);

  const parsed = useMemo(() => {
    const map: Record<string, DailyHourCell[]> = {};
    for (const e of entries) {
      try {
        map[e.id] = JSON.parse(e.dailyHours) as DailyHourCell[];
      } catch {
        map[e.id] = [];
      }
    }
    return map;
  }, [entries]);

  const dayCount = Math.max(0, ...entries.map((e) => parsed[e.id]?.length ?? 0));
  const dayHeaders = entries.length > 0 ? (parsed[entries[0].id] ?? []) : [];

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function cellValue(entryId: string, dayIndex: number) {
    const days = edited[entryId] ?? parsed[entryId];
    return days?.[dayIndex]?.value ?? "";
  }

  function editCell(entryId: string, dayIndex: number, value: string) {
    setEdited((prev) => {
      const base = prev[entryId] ?? parsed[entryId] ?? [];
      const next = base.map((d, i) => (i === dayIndex ? { ...d, value } : d));
      return { ...prev, [entryId]: next };
    });
  }

  function saveRow(entryId: string) {
    const days = edited[entryId];
    if (!days) return;
    const formData = new FormData();
    formData.append("entryId", entryId);
    formData.append("days", JSON.stringify(days));
    startTransition(async () => {
      await updateDailyHoursAction(formData);
      setEdited((prev) => {
        const next = { ...prev };
        delete next[entryId];
        return next;
      });
    });
  }

  const [statusResult, setStatusResult] = useState<string | null>(null);

  function runTransition(action: typeof submitTimesheetForReviewAction) {
    if (selected.size === 0) return;
    const formData = new FormData();
    for (const id of selected) formData.append("entryId", id);
    startTransition(async () => {
      const res = await action(formData);
      setStatusResult(`Updated ${res.updated} of ${res.requested} selected rows.`);
      setSelected(new Set());
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-500">{entries.length} employees · {month}</p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={selected.size === 0 || pending}
            onClick={() => runTransition(submitTimesheetForReviewAction)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Submit selected
          </button>
          <button
            type="button"
            disabled={selected.size === 0 || pending}
            onClick={() => runTransition(approveTimesheetAction)}
            className="rounded-lg border border-emerald-300 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Approve selected
          </button>
          <button
            type="button"
            disabled={selected.size === 0 || pending}
            onClick={() => runTransition(rejectTimesheetAction)}
            className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Reject selected
          </button>
          <button
            type="button"
            onClick={() => setShowBatch((v) => !v)}
            disabled={selected.size === 0}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Edit Common Details ({selected.size})
          </button>
        </div>
      </div>
      {statusResult && <p className="text-xs text-slate-500">{statusResult}</p>}

      {showBatch && (
        <BatchEditPanel
          entryIds={[...selected]}
          onClose={() => setShowBatch(false)}
        />
      )}

      <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white">
        <table className="w-full text-xs">
          <thead className="border-b border-slate-200 bg-slate-50 text-left font-medium tracking-wide text-slate-500 uppercase">
            <tr>
              <th className="w-8 px-2 py-2">
                <Checkbox
                  checked={selected.size === entries.length}
                  onCheckedChange={() =>
                    setSelected(selected.size === entries.length ? new Set() : new Set(entries.map((e) => e.id)))
                  }
                />
              </th>
              <th className="px-2 py-2">Employee</th>
              <th className="px-2 py-2">Trade</th>
              <th className="px-2 py-2">Status</th>
              <th className="px-2 py-2">Total</th>
              {dayHeaders.map((d, i) => (
                <th key={i} className="w-12 px-1 py-2 text-center">
                  {d.label}
                </th>
              ))}
              <th className="px-2 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {entries.map((e) => {
              const hasEdits = !!edited[e.id];
              const locked = e.status === "LOCKED";
              return (
                <tr key={e.id}>
                  <td className="px-2 py-1.5">
                    <Checkbox checked={selected.has(e.id)} onCheckedChange={() => toggle(e.id)} />
                  </td>
                  <td className="px-2 py-1.5 whitespace-nowrap text-slate-900">
                    {e.employeeName}
                    <span className="ml-1 text-slate-400">{e.employeeIdNo}</span>
                  </td>
                  <td className="px-2 py-1.5 text-slate-600">{e.trade}</td>
                  <td className="px-2 py-1.5">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_COLORS[e.status] || "bg-slate-100 text-slate-600"}`}>
                      {e.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 font-medium text-slate-900">{e.totalHours}</td>
                  {Array.from({ length: dayCount }).map((_, i) => (
                    <td key={i} className="px-0.5 py-1">
                      <input
                        value={cellValue(e.id, i)}
                        onChange={(ev) => editCell(e.id, i, ev.target.value)}
                        disabled={locked}
                        className={`w-11 rounded px-1 py-1 text-center outline-none disabled:opacity-50 ${badgeClass(cellValue(e.id, i))}`}
                      />
                    </td>
                  ))}
                  <td className="px-2 py-1.5">
                    {hasEdits && (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => saveRow(e.id)}
                        className="rounded-lg bg-[var(--brand-primary)] px-2 py-1 text-[10px] font-medium text-white hover:bg-[var(--brand-primary-hover)] disabled:opacity-60"
                      >
                        Save
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type RangeRow = { id: string; fromDate: string; toDate: string; value: string };

function blankRange(): RangeRow {
  return { id: crypto.randomUUID(), fromDate: "", toDate: "", value: "" };
}

function BatchEditPanel({ entryIds, onClose }: { entryIds: string[]; onClose: () => void }) {
  const [pending, startTransition] = useTransition();
  const [ranges, setRanges] = useState<RangeRow[]>(() => [blankRange()]);
  const [result, setResult] = useState<string | null>(null);

  const validRanges = ranges.filter((r) => r.fromDate && r.toDate && r.value);

  function updateRange(id: string, patch: Partial<RangeRow>) {
    setRanges((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function handleApply() {
    if (validRanges.length === 0) return;
    const formData = new FormData();
    for (const id of entryIds) formData.append("entryId", id);
    formData.append(
      "rangesJson",
      JSON.stringify(validRanges.map(({ fromDate, toDate, value }) => ({ fromDate, toDate, value })))
    );
    startTransition(async () => {
      const res = await batchUpdateHoursAction(formData);
      setResult(`Updated ${res.updated} of ${res.requested} selected rows.`);
    });
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4">
      <h3 className="mb-3 text-sm font-semibold text-slate-900">
        Edit Common Details — {entryIds.length} selected
      </h3>
      <div className="space-y-2">
        {ranges.map((r) => (
          <div key={r.id} className="flex flex-wrap items-end gap-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-500">From date</span>
              <input
                type="date"
                value={r.fromDate}
                onChange={(e) => updateRange(r.id, { fromDate: e.target.value })}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-500">To date</span>
              <input
                type="date"
                value={r.toDate}
                onChange={(e) => updateRange(r.id, { toDate: e.target.value })}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-500">Update hours</span>
              <input
                value={r.value}
                onChange={(e) => updateRange(r.id, { value: e.target.value })}
                placeholder="e.g. 10, A, OFF"
                className="w-32 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
              />
            </label>
            <button
              type="button"
              onClick={() => setRanges((prev) => prev.filter((row) => row.id !== r.id))}
              disabled={ranges.length === 1}
              className="rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Remove
            </button>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={() => setRanges((prev) => [...prev, blankRange()])}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          + Add range
        </button>
        <button
          type="button"
          disabled={pending || validRanges.length === 0}
          onClick={handleApply}
          className="rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--brand-primary-hover)] disabled:opacity-50"
        >
          {pending ? "Applying…" : "Update"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Close
        </button>
      </div>
      {result && <p className="mt-2 text-xs text-slate-500">{result}</p>}
    </div>
  );
}
