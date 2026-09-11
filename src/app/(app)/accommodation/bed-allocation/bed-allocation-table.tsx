"use client";

import { useState, useTransition } from "react";
import { Select } from "@/components/ui/Select";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/Dialog";
import { Badge } from "@/components/Badge";
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

export function BedAllocationTable({ rows }: { rows: Row[] }) {
  const [activeRow, setActiveRow] = useState<Row | null>(null);

  return (
    <div className="space-y-3">
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[54rem] text-sm">
            <thead className="border-b border-default bg-surface-subtle text-left text-xs font-medium tracking-wide text-muted uppercase">
              <tr>
                <th className="px-4 py-3">Check-In No</th>
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Camp</th>
                <th className="px-4 py-3">Room / Bed</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {rows.map((r) => (
                <tr key={r.checkInId}>
                  <td className="tabular px-4 py-3 text-secondary">
                    CHK-{String(r.checkInNo).padStart(5, "0")}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-primary">{r.employeeName}</p>
                    <p className="text-xs text-subtle">{r.employeeIdNo}</p>
                  </td>
                  <td className="px-4 py-3 text-secondary">{r.campName}</td>
                  <td className="px-4 py-3">
                    {r.bedId ? (
                      <Badge color="green">
                        {r.roomName} · {r.bedLabel}
                      </Badge>
                    ) : (
                      <Badge color="slate">Not allocated</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setActiveRow(r)}
                      className="text-xs font-medium text-blue-600 hover:underline"
                    >
                      {r.bedId ? "Switch Room" : "Allocate Bed"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && (
          <p className="px-4 py-10 text-center text-sm text-muted">
            No one is checked into a camp right now — start under Create Check-In.
          </p>
        )}
      </div>

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
