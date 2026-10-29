"use client";

import { Plus } from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Checkbox } from "@/components/ui/Checkbox";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  deleteTimesheetEntryAction,
  updateDailyHoursAction,
  batchUpdateHoursAction,
  submitTimesheetForReviewAction,
  approveTimesheetAction,
  rejectTimesheetAction,
} from "./actions";
import type { DailyHourCell } from "@/lib/parseTimesheet";
import { DatePicker } from "@/components/ui/DatePicker";

import { Button } from "@/components/ui/Button";
type Entry = {
  id: string;
  employeeIdNo: string;
  employeeName: string;
  trade: string;
  dailyHours: string;
  totalHours: number;
  absentCount: number;
  status: string;
  /** Set when the sheet shows every client at once. */
  clientName?: string;
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-surface-sunken text-secondary",
  SUBMITTED: "bg-[var(--info-soft)] text-[var(--brand-primary)]",
  UNDER_REVIEW: "bg-[var(--warning-soft)] text-[var(--warning)]",
  CLIENT_APPROVED: "bg-[var(--success-soft)] text-[var(--success)]",
  REJECTED: "bg-[var(--error-soft)] text-[var(--error)]",
  LOCKED: "bg-[var(--text-primary)] text-[var(--surface)]",
};

function badgeClass(value: string) {
  const v = value.trim().toUpperCase();
  if (!v) return "bg-surface-subtle text-subtle"; // missing
  if (v === "A") return "bg-[var(--error-soft)] text-[var(--error)]";
  if (v === "OFF") return "bg-surface-sunken text-muted";
  return "bg-[var(--success-soft)] text-[var(--success)]"; // numeric hours entered
}

export function ClientTimesheetGrid({ month, entries, showClient = false }: { month: string; entries: Entry[]; showClient?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [edited, setEdited] = useState<Record<string, DailyHourCell[]>>({});
  const [showBatch, setShowBatch] = useState(false);
  const [statusResult, setStatusResult] = useState<string | null>(null);

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

  const dirtyIds = Object.keys(edited);

  function saveAll() {
    const ids = Object.keys(edited);
    if (ids.length === 0) return;
    startTransition(async () => {
      let failed = 0;
      for (const id of ids) {
        const formData = new FormData();
        formData.append("entryId", id);
        formData.append("days", JSON.stringify(edited[id]));
        try {
          await updateDailyHoursAction(formData);
          setEdited((prev) => {
            const next = { ...prev };
            delete next[id];
            return next;
          });
        } catch {
          failed++;
        }
      }
      setStatusResult(failed ? `${failed} of ${ids.length} rows didn't save. Try again.` : `Saved ${ids.length} ${ids.length === 1 ? "row" : "rows"}.`);
    });
  }

  // Unsaved edits are guarded against closing the tab, and ⌘S / Ctrl+S saves them all.
  useEffect(() => {
    if (dirtyIds.length === 0) return;
    const warn = (ev: BeforeUnloadEvent) => ev.preventDefault();
    const onKey = (ev: KeyboardEvent) => {
      if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === "s") {
        ev.preventDefault();
        saveAll();
      }
    };
    window.addEventListener("beforeunload", warn);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("beforeunload", warn);
      window.removeEventListener("keydown", onKey);
    };
    // saveAll reads the latest edits through closure; re-bind whenever they change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edited, pending]);

  /** Hours as typed: numbers add up, A / OFF / blanks count as nothing. */
  function liveTotal(entryId: string) {
    return (edited[entryId] ?? parsed[entryId] ?? []).reduce((sum, d) => sum + (Number(d.value) || 0), 0);
  }

  function moveFocus(ev: React.KeyboardEvent<HTMLInputElement>, row: number, col: number) {
    const move = ({ ArrowUp: [-1, 0], ArrowDown: [1, 0], Enter: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] } as Record<string, number[]>)[ev.key];
    if (!move) return;
    const input = ev.currentTarget;
    // Left / right only jump cells once the caret is at that edge of the text.
    if (ev.key === "ArrowLeft" && input.selectionStart !== 0) return;
    if (ev.key === "ArrowRight" && input.selectionEnd !== input.value.length) return;
    ev.preventDefault();
    const next = input.closest("table")?.querySelector<HTMLInputElement>(`input[data-r="${row + move[0]}"][data-c="${col + move[1]}"]:not(:disabled)`);
    next?.focus();
    next?.select();
  }

  // Pasting a block from Excel fills the cells from the one you are in, down and to the right.
  function pasteBlock(ev: React.ClipboardEvent<HTMLInputElement>, row: number, col: number) {
    const lines = ev.clipboardData.getData("text").replace(/\r/g, "").replace(/\n+$/, "").split("\n").map((l) => l.split("\t"));
    if (lines.length === 1 && lines[0].length === 1) return;
    ev.preventDefault();
    lines.forEach((cells, dr) =>
      cells.forEach((v, dc) => {
        const target = entries[row + dr];
        if (target && target.status !== "LOCKED" && col + dc < dayCount) editCell(target.id, col + dc, v.trim());
      })
    );
  }

  function deleteRow(entryId: string) {
    const formData = new FormData();
    formData.append("entryId", entryId);
    startTransition(async () => {
      const res = await deleteTimesheetEntryAction(formData);
      setStatusResult(res.error ?? (res.deleted ? "Row deleted." : null));
      if (res.deleted) router.refresh();
    });
  }

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
        <p className="text-xs text-muted">{entries.length} {entries.length === 1 ? "row" : "rows"} · {month}{showClient ? ` · ${new Set(entries.map((e) => e.clientName)).size} clients` : ""}</p>
        {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={selected.size === 0 || pending}
            onClick={() => runTransition(submitTimesheetForReviewAction)}
            className="btn btn-secondary btn-sm"
          >
            Submit selected
          </button>
          <button
            type="button"
            disabled={selected.size === 0 || pending}
            onClick={() => runTransition(approveTimesheetAction)}
            className="rounded-lg border border-[var(--success-border)] px-3 py-1.5 text-xs font-medium text-[var(--success)] hover:bg-[var(--success-soft)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Approve selected
          </button>
          <button
            type="button"
            disabled={selected.size === 0 || pending}
            onClick={() => runTransition(rejectTimesheetAction)}
            className="rounded-lg border border-[var(--error-border)] px-3 py-1.5 text-xs font-medium text-[var(--error)] hover:bg-[var(--error-soft)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Reject selected
          </button>
          <button
            type="button"
            onClick={() => setShowBatch((v) => !v)}
            disabled={selected.size === 0}
            className="btn btn-secondary btn-sm"
          >
            Edit Common Details ({selected.size})
          </button>
        </div>
        )}
      </div>
      {statusResult && <p className="text-xs text-muted">{statusResult}</p>}

      {showBatch && (
        <BatchEditPanel
          entryIds={[...selected]}
          onClose={() => setShowBatch(false)}
        />
      )}

      {/* Capped height turns this wrapper into the scroll container, so
          `sticky top-0` below sticks to *it*, not the viewport (that would
          overlap the app header — see the DataTable component for the same
          pattern). */}
      <div className="card max-h-[calc(100vh-20rem)] overflow-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 z-20 border-b border-default bg-surface-subtle text-left font-medium tracking-wide text-muted uppercase">
            <tr>
              <th className="w-8 px-2 py-2">
                <Checkbox
                  ariaLabel="Select all rows"
                  checked={entries.length > 0 && selected.size === entries.length}
                  onCheckedChange={() =>
                    setSelected(selected.size === entries.length ? new Set() : new Set(entries.map((e) => e.id)))
                  }
                />
              </th>
              <th className="sticky left-0 z-10 bg-surface-subtle px-2 py-2">Employee</th>
              {showClient && <th className="px-2 py-2">Client</th>}
              <th className="px-2 py-2">Trade</th>
              <th className="px-2 py-2">Status</th>
              <th className="px-2 py-2">Total</th>
              {dayHeaders.map((d, i) => (
                <th key={i} className="w-12 px-1 py-2 text-center">
                  <span className="block">{d.label}</span>
                  {d.date && (
                    <span className="block text-[10px] font-normal text-subtle">
                      {new Date(d.date).getDate()}
                    </span>
                  )}
                </th>
              ))}
              <th className="px-2 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {entries.map((e, rowIndex) => {
              const hasEdits = !!edited[e.id];
              const locked = e.status === "LOCKED";
              return (
                <tr key={e.id}>
                  <td className="px-2 py-1.5">
                    <Checkbox ariaLabel={`Select ${e.employeeName}`} checked={selected.has(e.id)} onCheckedChange={() => toggle(e.id)} />
                  </td>
                  <td className="sticky left-0 z-[5] bg-surface px-2 py-1.5 whitespace-nowrap text-primary">
                    {e.employeeName}
                    <span className="ml-1 text-subtle">{e.employeeIdNo}</span>
                  </td>
                  {showClient && <td className="px-2 py-1.5 whitespace-nowrap text-secondary">{e.clientName}</td>}
                  <td className="px-2 py-1.5 text-secondary">{e.trade}</td>
                  <td className="px-2 py-1.5">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_COLORS[e.status] || "bg-surface-sunken text-secondary"}`}>
                      {e.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className={`tabular px-2 py-1.5 font-medium ${hasEdits ? "text-[var(--brand-primary)]" : "text-primary"}`}>{hasEdits ? liveTotal(e.id) : e.totalHours}</td>
                  {Array.from({ length: dayCount }).map((_, i) => (
                    <td key={i} className="px-0.5 py-1">
                      <input
                        data-r={rowIndex}
                        data-c={i}
                        value={cellValue(e.id, i)}
                        onChange={(ev) => editCell(e.id, i, ev.target.value)}
                        onKeyDown={(ev) => moveFocus(ev, rowIndex, i)}
                        onPaste={(ev) => pasteBlock(ev, rowIndex, i)}
                        onFocus={(ev) => ev.currentTarget.select()}
                        disabled={locked}
                        aria-label={`${e.employeeName}, ${dayHeaders[i]?.label ?? `day ${i + 1}`}`}
                        className={`w-11 rounded px-1 py-1 text-center transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)] focus-visible:ring-offset-1 disabled:opacity-50 ${badgeClass(cellValue(e.id, i))}`}
                      />
                    </td>
                  ))}
                  <td className="px-2 py-1.5 whitespace-nowrap">
                    {!locked && (
                      <ConfirmDialog
                        title="Delete this row?"
                        description={`Remove ${e.employeeName} (${e.trade}) from this timesheet? The row and its hours go for good.`}
                        confirmLabel="Delete"
                        onConfirm={() => deleteRow(e.id)}
                        trigger={(open) => (
                          <button
                            type="button"
                            disabled={pending}
                            onClick={open}
                            aria-label={`Delete ${e.employeeName}'s row`}
                            className="text-[10px] font-medium text-[var(--error)] hover:underline disabled:opacity-50"
                          >
                            Delete
                          </button>
                        )}
                      />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {dirtyIds.length > 0 && (
        <div className="sticky bottom-4 z-30 flex justify-center">
          <div className="flex items-center gap-3 rounded-2xl bg-[#1e1b3a] py-2.5 pr-2.5 pl-4 text-sm text-white shadow-modal">
            <span><b>{dirtyIds.length} {dirtyIds.length === 1 ? "row" : "rows"} changed</b><span className="ml-2 hidden text-white/70 sm:inline">⌘S to save</span></span>
            <button type="button" onClick={() => setEdited({})} disabled={pending} className="rounded-lg border border-white/30 px-3 py-1.5 text-xs font-medium hover:bg-white/10 disabled:opacity-50">Discard</button>
            <Button size="btn" type="button" onClick={saveAll} disabled={pending} loading={pending}>{`Save ${dirtyIds.length} ${dirtyIds.length === 1 ? "row" : "rows"}`}</Button>
          </div>
        </div>
      )}
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
    <div className="card p-4">
      <h3 className="mb-3 text-sm font-semibold text-primary">
        Edit Common Details: {entryIds.length} selected
      </h3>
      <div className="space-y-2">
        {ranges.map((r) => (
          <div key={r.id} className="flex flex-wrap items-end gap-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">From date</span>
              <DatePicker value={r.fromDate} onChange={(v) => updateRange(r.id, { fromDate: v })} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">To date</span>
              <DatePicker value={r.toDate} onChange={(v) => updateRange(r.id, { toDate: v })} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">Update hours</span>
              <input
                value={r.value}
                onChange={(e) => updateRange(r.id, { value: e.target.value })}
                placeholder="e.g. 10, A, OFF"
                className="input w-32"
              />
            </label>
            <button
              type="button"
              onClick={() => setRanges((prev) => prev.filter((row) => row.id !== r.id))}
              disabled={ranges.length === 1}
              className="rounded-lg border border-[var(--error-border)] px-3 py-2 text-xs font-medium text-[var(--error)] hover:bg-[var(--error-soft)] disabled:cursor-not-allowed disabled:opacity-40"
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
          className="btn btn-secondary btn-sm"
        >
          <Plus className="h-4 w-4" aria-hidden />

          Add range
        </button>
        <Button size="btn" type="button" disabled={pending || validRanges.length === 0} onClick={handleApply} loading={pending}>
          Update
        </Button>
        <button
          type="button"
          onClick={onClose}
          className="btn btn-secondary"
        >
          Close
        </button>
      </div>
      {result && <p className="mt-2 text-xs text-muted">{result}</p>}
    </div>
  );
}
