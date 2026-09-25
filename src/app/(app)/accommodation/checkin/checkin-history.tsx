"use client";

import { useMemo, useState } from "react";
import { FileDown } from "lucide-react";
import { Select } from "@/components/ui/Select";
import { Checkbox } from "@/components/ui/Checkbox";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/ui/Button";
import { initials, avatarGradient } from "@/lib/avatar";

type HistoryRow = {
  checkInId: string;
  checkInNo: number;
  employeeName: string;
  employeeIdNo: string;
  nationality: string | null;
  campId: string;
  campName: string;
  checkInDate: string;
  status: string;
  checkOutDate: string | null;
  bedLabel: string | null;
  stayDays: number;
};

const STATUS_BADGE: Record<string, { label: string; color: "amber" | "green" | "slate" }> = {
  CHECKED_IN: { label: "Checked In", color: "amber" },
  BED_ALLOCATED: { label: "Bed Allocated", color: "green" },
  CHECKED_OUT: { label: "Checked Out", color: "slate" },
};

/**
 * Reprints a check-in slip for any past batch — the auto-download right
 * after Create Check-In only fires once, so this is the only way back to it
 * if that download was missed, the tab was closed, or a slip needs a
 * duplicate print. Scoped to one camp at a time since the PDF's header
 * (Camp / Camp Type) only makes sense for a single camp's batch.
 */
export function CheckInHistory({ rows, camps }: { rows: HistoryRow[]; camps: { id: string; name: string }[] }) {
  const [campId, setCampId] = useState(camps[0]?.id ?? "");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const campRows = useMemo(() => rows.filter((r) => r.campId === campId), [rows, campId]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) =>
      prev.size === campRows.length ? new Set() : new Set(campRows.map((r) => r.checkInId))
    );
  }

  function generate() {
    if (selected.size === 0) return;
    // Direct navigation (not window.open) so the download isn't blocked as a
    // popup — it fires from a click handler with no await in between, and
    // the Content-Disposition header makes the browser download rather than
    // navigate away.
    window.location.href = `/api/checkins/pdf?ids=${[...selected].join(",")}`;
  }

  return (
    <div className="card space-y-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-primary">Generate Check-In List</h2>
          <p className="mt-0.5 text-xs text-muted">
            Reprint or regenerate the check-in slip PDF for a past batch.
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={generate} disabled={selected.size === 0}>
          <FileDown className="h-3.5 w-3.5" />
          Generate ({selected.size})
        </Button>
      </div>

      <label className="block max-w-xs">
        <span className="mb-1 block text-xs font-medium text-muted">Camp</span>
        <Select
          value={campId}
          onChange={(v) => {
            setCampId(v);
            setSelected(new Set());
          }}
          placeholder="Select a camp"
          options={camps.map((c) => ({ value: c.id, label: c.name }))}
        />
      </label>

      {campId && (
        <div className="rounded-card border border-default">
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 border-b border-default bg-surface-subtle text-left text-xs font-medium tracking-wide text-muted uppercase">
                <tr>
                  <th className="w-10 px-4 py-2.5">
                    <label className="cursor-pointer" onClick={(e) => { e.preventDefault(); toggleAll(); }}>
                      <Checkbox checked={campRows.length > 0 && selected.size === campRows.length} />
                    </label>
                  </th>
                  <th className="px-4 py-2.5">Check-In No</th>
                  <th className="px-4 py-2.5">Employee</th>
                  <th className="px-4 py-2.5">Bed</th>
                  <th className="px-4 py-2.5">Stay</th>
                  <th className="px-4 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {campRows.map((r) => {
                  const badge = STATUS_BADGE[r.status] ?? { label: r.status, color: "slate" as const };
                  return (
                    <tr key={r.checkInId} className="hover:bg-surface-hover">
                      <td className="px-4 py-2.5">
                        <label
                          className="cursor-pointer"
                          onClick={(e) => {
                            e.preventDefault();
                            toggle(r.checkInId);
                          }}
                        >
                          <Checkbox checked={selected.has(r.checkInId)} />
                        </label>
                      </td>
                      <td className="tabular px-4 py-2.5 text-secondary">
                        CHK-{String(r.checkInNo).padStart(5, "0")}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <div
                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-[9px] font-semibold text-white ${avatarGradient(
                              r.employeeName
                            )}`}
                          >
                            {initials(r.employeeName)}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-primary">{r.employeeName}</p>
                            <p className="truncate text-[10px] text-subtle">{r.employeeIdNo}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-secondary">{r.bedLabel ?? <span className="text-subtle">Not allocated</span>}</td>
                      <td className="px-4 py-2.5">
                        <span className="tabular text-secondary">{r.stayDays}d</span>
                        <span className="block text-[11px] text-subtle">
                          {new Date(r.checkInDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                          {r.checkOutDate ? ` → ${new Date(r.checkOutDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}` : " → now"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge color={badge.color}>{badge.label}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {campRows.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-muted">No check-ins recorded for this camp yet.</p>
          )}
        </div>
      )}
    </div>
  );
}
