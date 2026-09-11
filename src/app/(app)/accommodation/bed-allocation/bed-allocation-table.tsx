"use client";

import { useState, useTransition } from "react";
import { BedDouble, Building2 } from "lucide-react";
import { Select } from "@/components/ui/Select";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/Dialog";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/ui/Button";
import { initials, avatarGradient } from "@/lib/avatar";
import { cn } from "@/lib/cn";
import { allocateBedAction } from "../checkin-actions";

type BedOption = { id: string; label: string; vacant: boolean };
type RoomOption = { id: string; name: string; beds: BedOption[] };
type Row = {
  checkInId: string;
  checkInNo: number;
  employeeName: string;
  employeeIdNo: string;
  nationality: string | null;
  campId: string;
  campName: string;
  roomName: string | null;
  bedLabel: string | null;
  bedId: string | null;
  checkInDate: string;
  rooms: RoomOption[];
};

type Filter = "all" | "awaiting" | "allocated";

export function BedAllocationTable({ rows }: { rows: Row[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [activeRow, setActiveRow] = useState<Row | null>(null);

  const counts = {
    all: rows.length,
    awaiting: rows.filter((r) => !r.bedId).length,
    allocated: rows.filter((r) => r.bedId).length,
  };
  const visible =
    filter === "all" ? rows : rows.filter((r) => (filter === "awaiting" ? !r.bedId : !!r.bedId));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {(
          [
            ["all", `All (${counts.all})`],
            ["awaiting", `Awaiting allocation (${counts.awaiting})`],
            ["allocated", `Bed allocated (${counts.allocated})`],
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

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {visible.map((r) => (
          <div
            key={r.checkInId}
            className={cn(
              "card flex items-center gap-3 p-4 transition",
              !r.bedId && "border-[var(--warning-border)] bg-[var(--warning-soft)]/30"
            )}
          >
            <div
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-sm font-semibold text-white",
                avatarGradient(r.employeeName)
              )}
            >
              {initials(r.employeeName)}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <p className="truncate text-sm font-semibold text-primary">{r.employeeName}</p>
                <span className="tabular shrink-0 text-[10px] text-subtle">
                  CHK-{String(r.checkInNo).padStart(5, "0")}
                </span>
              </div>
              <p className="truncate text-xs text-subtle">
                {r.employeeIdNo}
                {r.nationality ? ` · ${r.nationality}` : ""}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1 text-xs text-secondary">
                  <Building2 className="h-3 w-3 text-subtle" /> {r.campName}
                </span>
                {r.bedId ? (
                  <Badge color="green" dot>
                    {r.roomName} · {r.bedLabel}
                  </Badge>
                ) : (
                  <Badge color="amber" dot>
                    Not allocated
                  </Badge>
                )}
              </div>
            </div>

            <Button
              variant={r.bedId ? "secondary" : "primary"}
              size="sm"
              onClick={() => setActiveRow(r)}
              className="shrink-0"
            >
              <BedDouble className="h-3.5 w-3.5" />
              {r.bedId ? "Switch Room" : "Allocate Bed"}
            </Button>
          </div>
        ))}
      </div>

      {visible.length === 0 && (
        <p className="empty-state py-10 text-center text-sm text-muted">
          {rows.length === 0
            ? "No one is checked into a camp right now — start under Create Check-In."
            : "Nothing matches this filter."}
        </p>
      )}

      <AllocateModal row={activeRow} onClose={() => setActiveRow(null)} />
    </div>
  );
}

function AllocateModal({ row, onClose }: { row: Row | null; onClose: () => void }) {
  return (
    <Dialog modal={false} open={row !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        title={row?.bedId ? `Switch Room for ${row?.employeeName ?? ""}` : `Allocate Bed for ${row?.employeeName ?? ""}`}
        description={`Camp: ${row?.campName ?? ""}. Pick a room, then a vacant bed, and the check-in date.`}
      >
        {row && <AllocateForm key={row.checkInId} row={row} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function AllocateForm({ row, onClose }: { row: Row; onClose: () => void }) {
  const [roomId, setRoomId] = useState(
    row.rooms.find((r) => r.beds.some((b) => b.id === row.bedId))?.id ?? ""
  );
  const [bedId, setBedId] = useState(row.bedId ?? "");
  const [checkInDate, setCheckInDate] = useState(row.checkInDate);
  const [pending, startTransition] = useTransition();

  const room = row.rooms.find((r) => r.id === roomId) ?? null;
  const bedsInRoom = room ? room.beds.filter((b) => b.vacant) : [];

  return (
    <div className="mt-4 space-y-4">
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted">Room</span>
        <Select
          value={roomId}
          onChange={(v) => {
            setRoomId(v);
            setBedId("");
          }}
          placeholder="Select a room"
          options={row.rooms.map((r) => ({
            value: r.id,
            label: `${r.name} (${r.beds.filter((b) => b.vacant).length}/${r.beds.length} vacant)`,
          }))}
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted">Bed</span>
        <Select
          value={bedId}
          onChange={setBedId}
          disabled={!roomId}
          placeholder={roomId ? "Select a vacant bed" : "Select a room first"}
          options={bedsInRoom.map((b) => ({ value: b.id, label: b.label }))}
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted">Check-in date</span>
        <input
          type="date"
          value={checkInDate}
          onChange={(e) => setCheckInDate(e.target.value)}
          className="input w-full"
        />
      </label>
      <DialogFooter>
        <button type="button" onClick={onClose} className="btn btn-secondary">
          Cancel
        </button>
        <button
          type="button"
          disabled={!bedId || pending}
          onClick={() => {
            const formData = new FormData();
            formData.append("checkInId", row.checkInId);
            formData.append("bedId", bedId);
            formData.append("checkInDate", checkInDate);
            startTransition(async () => {
              await allocateBedAction(formData);
              onClose();
            });
          }}
          className="btn btn-primary"
        >
          {pending ? "Saving…" : "Allocate"}
        </button>
      </DialogFooter>
    </div>
  );
}
