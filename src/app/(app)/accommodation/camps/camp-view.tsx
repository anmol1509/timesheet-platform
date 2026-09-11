"use client";

import { useState } from "react";
import { BedDouble } from "lucide-react";
import { DeleteButton } from "@/components/DeleteButton";
import { InlineEditRow } from "@/components/InlineEditRow";
import { SegmentedControl } from "@/components/ui/RadioGroup";
import { Badge } from "@/components/Badge";
import { initials, avatarGradient } from "@/lib/avatar";
import { cn } from "@/lib/cn";
import {
  unassignBedAction,
  updateRoomAction,
  deleteRoomAction,
  addBedsToRoomAction,
  deleteBedAction,
} from "../actions";

type Bed = { id: string; label: string; employeeId: string | null };
type Room = {
  id: string;
  name: string;
  beds: Bed[];
  roomType: string | null;
  nationality: string | null;
};

export function CampView({
  rooms,
  employeeNames,
}: {
  rooms: Room[];
  employeeNames: Record<string, { name: string; employeeIdNo: string }>;
}) {
  const [vacantOnly, setVacantOnly] = useState(false);

  const allBeds = rooms.flatMap((r) => r.beds);
  const vacantCount = allBeds.filter((b) => !b.employeeId).length;

  if (rooms.length === 0) {
    return (
      <p className="empty-state py-10 text-sm text-muted">
        This camp has no rooms yet — add one below.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl
          value={vacantOnly ? "vacant" : "all"}
          onChange={(v) => setVacantOnly(v === "vacant")}
          options={[
            { value: "all", label: `All beds (${allBeds.length})` },
            { value: "vacant", label: `Vacant only (${vacantCount})` },
          ]}
        />
        <div className="flex items-center gap-4 text-xs text-muted">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[var(--success)]" /> Vacant
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[var(--error)]" /> Occupied
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {rooms.map((room) => {
          const beds = vacantOnly ? room.beds.filter((b) => !b.employeeId) : room.beds;
          const occupied = room.beds.filter((b) => b.employeeId).length;
          const pct = room.beds.length > 0 ? Math.round((occupied / room.beds.length) * 100) : 0;
          const full = room.beds.length > 0 && occupied === room.beds.length;
          return (
            <div key={room.id} className="card p-4">
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <InlineEditRow
                    value={room.name}
                    action={updateRoomAction}
                    hiddenFields={{ roomId: room.id }}
                  />
                  {full ? (
                    <Badge color="red">Full</Badge>
                  ) : (
                    <span className="tabular text-xs text-subtle">
                      {occupied}/{room.beds.length} occupied
                    </span>
                  )}
                  {room.roomType && <Badge color="navy">{room.roomType}</Badge>}
                  {room.nationality && <Badge color="slate">{room.nationality}</Badge>}
                </div>
                <div className="flex items-center gap-2">
                  <form action={addBedsToRoomAction} className="flex items-center gap-1.5">
                    <input type="hidden" name="roomId" value={room.id} />
                    <input
                      name="count"
                      type="number"
                      min={1}
                      max={20}
                      defaultValue={1}
                      className="input w-14 px-2 py-1 text-xs"
                    />
                    <button
                      type="submit"
                      className="rounded-control border border-strong px-2 py-1 text-xs font-medium text-secondary hover:bg-surface-hover"
                    >
                      + Beds
                    </button>
                  </form>
                  <DeleteButton
                    action={deleteRoomAction}
                    hiddenFields={{ roomId: room.id }}
                    confirmMessage={`Delete ${room.name}? Its ${room.beds.length} bed(s) will be removed, unassigning anyone housed there.`}
                    className="rounded-control border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                  />
                </div>
              </div>

              <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-surface-sunken">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    full ? "bg-[var(--error)]" : "bg-[var(--brand-primary)]"
                  )}
                  style={{ width: `${pct}%` }}
                />
              </div>

              {beds.length === 0 ? (
                <p className="rounded-control border border-dashed border-default px-3 py-4 text-center text-xs text-subtle">
                  No vacant beds in this room.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {beds.map((bed) => {
                    const occupant = bed.employeeId ? employeeNames[bed.employeeId] : null;
                    return (
                      <div
                        key={bed.id}
                        className={cn(
                          "group relative rounded-card border p-3 transition",
                          occupant
                            ? "border-default bg-surface"
                            : "border-dashed border-default bg-surface-subtle hover:border-[var(--brand-primary)] hover:bg-brand-soft"
                        )}
                      >
                        {occupant ? (
                          <>
                            <div className="flex items-start justify-between gap-1">
                              <div
                                className={cn(
                                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-[11px] font-semibold text-white",
                                  avatarGradient(occupant.name)
                                )}
                              >
                                {initials(occupant.name)}
                              </div>
                              <span className="rounded-full bg-surface-sunken px-1.5 py-0.5 text-[10px] font-semibold text-secondary">
                                {bed.label}
                              </span>
                            </div>
                            <p className="mt-2 truncate text-xs font-semibold text-primary" title={occupant.name}>
                              {occupant.name}
                            </p>
                            <p className="truncate text-[10px] text-subtle">{occupant.employeeIdNo}</p>
                            <div className="mt-2 border-t border-default pt-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                              <DeleteButton
                                action={unassignBedAction}
                                hiddenFields={{ bedId: bed.id, employeeId: bed.employeeId ?? "" }}
                                confirmMessage={`Check out ${occupant.name} from bed ${bed.label}?`}
                                label="Check out"
                                className="text-[10px] font-medium text-red-600 hover:underline"
                              />
                            </div>
                          </>
                        ) : (
                          // Vacant beds are filled via Create Check-In → Bed
                          // Allocation, which keeps the checkInNo/PDF trail —
                          // only removing a bed happens directly here.
                          <div className="flex flex-col items-center py-1 text-center">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--success-soft)] text-[var(--success)]">
                              <BedDouble className="h-4 w-4" />
                            </div>
                            <p className="mt-2 text-xs font-semibold text-secondary">{bed.label}</p>
                            <p className="text-[10px] text-subtle">Vacant</p>
                            <div className="mt-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                              <DeleteButton
                                action={deleteBedAction}
                                hiddenFields={{ bedId: bed.id }}
                                confirmMessage={`Delete bed ${bed.label} from ${room.name}?`}
                                label="Remove"
                                className="inline-flex items-center gap-0.5 text-[10px] font-medium text-subtle hover:text-red-600 hover:underline"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
