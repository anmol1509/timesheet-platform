"use client";

import { useState } from "react";
import { BedDouble } from "lucide-react";
import { DeleteButton } from "@/components/DeleteButton";
import { InlineEditRow } from "@/components/InlineEditRow";
import { SegmentedControl } from "@/components/ui/RadioGroup";
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
            <span className="h-3 w-3 rounded bg-emerald-500" /> Vacant
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded bg-red-500" /> Occupied
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {rooms.map((room) => {
          const beds = vacantOnly ? room.beds.filter((b) => !b.employeeId) : room.beds;
          const occupied = room.beds.filter((b) => b.employeeId).length;
          return (
            <div key={room.id} className="card p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <InlineEditRow
                    value={room.name}
                    action={updateRoomAction}
                    hiddenFields={{ roomId: room.id }}
                  />
                  <span className="text-xs text-subtle">
                    {occupied}/{room.beds.length} occupied
                  </span>
                  {room.roomType && (
                    <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-[10px] font-medium text-muted">
                      {room.roomType}
                    </span>
                  )}
                  {room.nationality && (
                    <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-[10px] font-medium text-muted">
                      {room.nationality}
                    </span>
                  )}
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
                      className="rounded-lg border border-strong px-2 py-1 text-xs font-medium text-secondary hover:bg-surface-hover"
                    >
                      + Beds
                    </button>
                  </form>
                  <DeleteButton
                    action={deleteRoomAction}
                    hiddenFields={{ roomId: room.id }}
                    confirmMessage={`Delete ${room.name}? Its ${room.beds.length} bed(s) will be removed, unassigning anyone housed there.`}
                    className="rounded-lg border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                  />
                </div>
              </div>

              {beds.length === 0 ? (
                <p className="rounded-lg border border-dashed border-default px-3 py-4 text-center text-xs text-subtle">
                  No vacant beds in this room.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {beds.map((bed) => {
                    const occupant = bed.employeeId ? employeeNames[bed.employeeId] : null;
                    return (
                      <div
                        key={bed.id}
                        className={`rounded-xl border p-3 ${
                          occupant
                            ? "border-red-200 bg-red-50"
                            : "border-emerald-200 bg-emerald-50"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <BedDouble
                            className={`h-4 w-4 ${occupant ? "text-red-500" : "text-emerald-500"}`}
                          />
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold text-white ${
                              occupant ? "bg-red-500" : "bg-emerald-600"
                            }`}
                          >
                            {occupant ? "occupied" : "vacant"}
                          </span>
                        </div>
                        <p className="mt-1.5 text-sm font-semibold text-primary">
                          {bed.label}
                        </p>
                        {occupant ? (
                          <>
                            <p className="mt-1 truncate text-xs text-secondary" title={occupant.name}>
                              {occupant.name}
                            </p>
                            <p className="text-[10px] text-subtle">
                              {occupant.employeeIdNo}
                            </p>
                            <div className="mt-1.5">
                              <DeleteButton
                                action={unassignBedAction}
                                hiddenFields={{ bedId: bed.id, employeeId: bed.employeeId ?? "" }}
                                confirmMessage={`Check out ${occupant.name} from bed ${bed.label}?`}
                                label="Check out"
                              />
                            </div>
                          </>
                        ) : (
                          // Vacant beds are filled via Create Check-In → Bed
                          // Allocation, which keeps the checkInNo/PDF trail —
                          // only removing a bed happens directly here.
                          <div className="mt-2 text-center">
                            <DeleteButton
                              action={deleteBedAction}
                              hiddenFields={{ bedId: bed.id }}
                              confirmMessage={`Delete bed ${bed.label} from ${room.name}?`}
                              label="Delete bed"
                            />
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
