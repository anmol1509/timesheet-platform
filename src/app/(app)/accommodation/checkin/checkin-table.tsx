"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LogIn } from "lucide-react";
import { Checkbox } from "@/components/ui/Checkbox";
import { Select } from "@/components/ui/Select";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/Dialog";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/ui/Button";
import { initials, avatarGradient } from "@/lib/avatar";
import { cn } from "@/lib/cn";
import { createCheckInAction, switchCampAction } from "../checkin-actions";

type EmployeeRow = {
  id: string;
  name: string;
  employeeIdNo: string;
  nationality: string | null;
  supplierName: string | null;
  supplierCode: string | null;
  projectCode: string | null;
  projectName: string | null;
  checkInId: string | null;
  campName: string | null;
  campId: string | null;
};

type CampOption = {
  id: string;
  name: string;
  ownerType: string;
  supplierName: string | null;
  roomCount: number;
  vacantBeds: number;
  totalBeds: number;
};

type Filter = "all" | "not_checked_in" | "awaiting_bed";

function campLabel(c: CampOption) {
  const type = c.ownerType === "SUPPLIER" ? `Supplier${c.supplierName ? ` — ${c.supplierName}` : ""}` : "Own";
  return `${c.name} (${type}) — ${c.roomCount} rooms, ${c.vacantBeds}/${c.totalBeds} beds vacant`;
}

export function CheckInTable({ rows, camps }: { rows: EmployeeRow[]; camps: CampOption[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [switchRow, setSwitchRow] = useState<EmployeeRow | null>(null);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const counts = {
    all: rows.length,
    not_checked_in: rows.filter((r) => !r.checkInId).length,
    awaiting_bed: rows.filter((r) => !!r.checkInId).length,
  };
  const visible =
    filter === "all" ? rows : rows.filter((r) => (filter === "not_checked_in" ? !r.checkInId : !!r.checkInId));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["all", `All (${counts.all})`],
              ["not_checked_in", `Not checked in (${counts.not_checked_in})`],
              ["awaiting_bed", `Awaiting bed allocation (${counts.awaiting_bed})`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={cn(
                "rounded-control border px-3 py-1.5 text-xs font-medium transition",
                filter === key
                  ? "border-[var(--brand-primary)] bg-brand-soft text-[var(--brand-primary)]"
                  : "border-default bg-surface text-secondary hover:bg-surface-hover"
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <Button
          variant="primary"
          onClick={() => setCheckInOpen(true)}
          disabled={selected.size === 0}
        >
          <LogIn className="h-3.5 w-3.5" />
          Check In Selected ({selected.size})
        </Button>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[64rem] text-sm">
            <thead className="border-b border-default bg-surface-subtle text-left text-xs font-medium tracking-wide text-muted uppercase">
              <tr>
                <th className="w-10 px-4 py-3" />
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Nationality</th>
                <th className="px-4 py-3">Supplier</th>
                <th className="px-4 py-3">Project</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {visible.map((r) => (
                <tr key={r.id} className="hover:bg-surface-hover">
                  <td className="px-4 py-3">
                    <label
                      className={r.checkInId ? "cursor-not-allowed opacity-30" : "cursor-pointer"}
                      onClick={(e) => {
                        e.preventDefault();
                        if (!r.checkInId) toggle(r.id);
                      }}
                    >
                      <Checkbox checked={selected.has(r.id)} disabled={!!r.checkInId} />
                    </label>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-[10px] font-semibold text-white",
                          avatarGradient(r.name)
                        )}
                      >
                        {initials(r.name)}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-primary">{r.name}</p>
                        <p className="truncate text-xs text-subtle">{r.employeeIdNo}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-secondary">{r.nationality || "—"}</td>
                  <td className="px-4 py-3 text-secondary">
                    {r.supplierName ? (
                      <>
                        {r.supplierName}
                        {r.supplierCode && (
                          <span className="tabular ml-1.5 text-xs text-subtle">{r.supplierCode}</span>
                        )}
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-secondary">
                    {r.projectName ? (
                      <>
                        {r.projectName}
                        {r.projectCode && (
                          <span className="tabular ml-1.5 text-xs text-subtle">{r.projectCode}</span>
                        )}
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {r.checkInId ? (
                      <Badge color="amber" dot>
                        Checked in — {r.campName}
                      </Badge>
                    ) : (
                      <Badge color="slate">Not checked in</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {r.checkInId && (
                      <button
                        type="button"
                        onClick={() => setSwitchRow(r)}
                        className="text-xs font-medium text-blue-600 hover:underline"
                      >
                        Switch Camp
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {visible.length === 0 && (
          <p className="empty-state px-4 py-10 text-center text-sm text-muted">
            {rows.length === 0 ? "Every registered employee already has a bed." : "Nothing matches this filter."}
          </p>
        )}
      </div>

      <CheckInModal
        open={checkInOpen}
        employeeIds={[...selected]}
        camps={camps}
        onDone={() => {
          setSelected(new Set());
          setCheckInOpen(false);
        }}
        onClose={() => setCheckInOpen(false)}
      />

      <SwitchCampModal row={switchRow} camps={camps.filter((c) => c.id !== switchRow?.campId)} onClose={() => setSwitchRow(null)} />
    </div>
  );
}

function CheckInModal({
  open,
  employeeIds,
  camps,
  onDone,
  onClose,
}: {
  open: boolean;
  employeeIds: string[];
  camps: CampOption[];
  onDone: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog modal={false} open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        title={`Check In ${employeeIds.length} Employee${employeeIds.length === 1 ? "" : "s"}`}
        description="Select the camp to check them into. A bed isn't picked yet — that's the next step, Bed Allocation."
      >
        {camps.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No camps set up yet — add one under Camps first.</p>
        ) : (
          <CheckInForm employeeIds={employeeIds} camps={camps} onDone={onDone} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function CheckInForm({
  employeeIds,
  camps,
  onDone,
}: {
  employeeIds: string[];
  camps: CampOption[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [campId, setCampId] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit() {
    if (!campId || employeeIds.length === 0) return;
    setError(null);
    const formData = new FormData();
    formData.append("campId", campId);
    for (const id of employeeIds) formData.append("employeeId", id);
    startTransition(async () => {
      const result = await createCheckInAction(formData);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      window.open(`/api/checkins/pdf?ids=${result.ids.join(",")}`, "_blank");
      router.refresh();
      onDone();
    });
  }

  return (
    <div className="mt-4 space-y-4">
      <Select
        value={campId}
        onChange={setCampId}
        placeholder="Select a camp"
        options={camps.map((c) => ({ value: c.id, label: campLabel(c) }))}
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <DialogFooter>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!campId || pending}
          className="btn btn-primary"
        >
          {pending ? "Checking in…" : "Check In"}
        </button>
      </DialogFooter>
    </div>
  );
}

function SwitchCampModal({
  row,
  camps,
  onClose,
}: {
  row: EmployeeRow | null;
  camps: CampOption[];
  onClose: () => void;
}) {
  return (
    <Dialog modal={false} open={row !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        title={`Switch Camp for ${row?.name ?? ""}`}
        description={`Currently checked into ${row?.campName ?? ""}. Pick a different camp.`}
      >
        {row && <SwitchCampForm key={row.id} row={row} camps={camps} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function SwitchCampForm({ row, camps, onClose }: { row: EmployeeRow; camps: CampOption[]; onClose: () => void }) {
  const [campId, setCampId] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <div className="mt-4 space-y-4">
      {camps.length === 0 ? (
        <p className="text-sm text-muted">No other camps to switch to.</p>
      ) : (
        <Select
          value={campId}
          onChange={setCampId}
          placeholder="Select a camp"
          options={camps.map((c) => ({ value: c.id, label: campLabel(c) }))}
        />
      )}
      <DialogFooter>
        <button type="button" onClick={onClose} className="btn btn-secondary">
          Cancel
        </button>
        <button
          type="button"
          disabled={!campId || pending}
          onClick={() => {
            const formData = new FormData();
            formData.append("checkInId", row.checkInId!);
            formData.append("campId", campId);
            startTransition(async () => {
              await switchCampAction(formData);
              onClose();
            });
          }}
          className="btn btn-primary"
        >
          {pending ? "Switching…" : "Switch"}
        </button>
      </DialogFooter>
    </div>
  );
}
