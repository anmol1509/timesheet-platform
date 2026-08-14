"use client";

import { useState, useTransition } from "react";
import { BedDouble } from "lucide-react";
import { DeleteButton } from "@/components/DeleteButton";
import { InlineEditRow } from "@/components/InlineEditRow";
import { SegmentedControl } from "@/components/ui/RadioGroup";
import { Select } from "@/components/ui/Select";
import { Checkbox } from "@/components/ui/Checkbox";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/Dialog";
import {
  assignBedAction,
  unassignBedAction,
  updateRoomAction,
  deleteRoomAction,
  addBedsToRoomAction,
  bulkCheckInAction,
} from "./actions";

type Bed = { id: string; label: string; employeeId: string | null };
type Room = {
  id: string;
  name: string;
  beds: Bed[];
  roomType: string | null;
  nationality: string | null;
};
type EmployeeOption = {
  id: string;
  name: string;
  employeeIdNo: string;
  nationality: string | null;
};

export function CampView({
  rooms,
  employeeNames,
  unassignedEmployees,
}: {
  rooms: Room[];
  employeeNames: Record<string, { name: string; employeeIdNo: string }>;
  unassignedEmployees: EmployeeOption[];
}) {
  const [vacantOnly, setVacantOnly] = useState(false);
  const [assigningBed, setAssigningBed] = useState<string | null>(null);
  const [bulkCheckInRoomId, setBulkCheckInRoomId] = useState<string | null>(null);

  const allBeds = rooms.flatMap((r) => r.beds);
  const vacantCount = allBeds.filter((b) => !b.employeeId).length;
  const assigningBedObj = allBeds.find((b) => b.id === assigningBed) || null;
  const bulkCheckInRoom = rooms.find((r) => r.id === bulkCheckInRoomId) || null;
  const bulkCheckInVacantCount = bulkCheckInRoom
    ? bulkCheckInRoom.beds.filter((b) => !b.employeeId).length
    : 0;

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
                  <button
                    type="button"
                    onClick={() => setBulkCheckInRoomId(room.id)}
                    disabled={room.beds.every((b) => b.employeeId)}
                    className="rounded-lg border border-strong px-2 py-1 text-xs font-medium text-secondary hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Bulk Check-In
                  </button>
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
                                hiddenFields={{ bedId: bed.id }}
                                confirmMessage={`Unassign ${occupant.name} from bed ${bed.label}?`}
                                label="Unassign"
                              />
                            </div>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setAssigningBed(bed.id)}
                            className="mt-2 block w-full rounded-lg bg-[var(--brand-primary)] px-2 py-1.5 text-xs font-medium text-white hover:bg-[var(--brand-primary-hover)]"
                          >
                            + Assign
                          </button>
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

      <AssignModal
        bedId={assigningBed}
        bedLabel={assigningBedObj?.label || ""}
        employees={unassignedEmployees}
        onClose={() => setAssigningBed(null)}
      />

      <BulkCheckInModal
        roomId={bulkCheckInRoomId}
        roomName={bulkCheckInRoom?.name || ""}
        vacantCount={bulkCheckInVacantCount}
        roomNationality={bulkCheckInRoom?.nationality || null}
        employees={unassignedEmployees}
        onClose={() => setBulkCheckInRoomId(null)}
      />
    </div>
  );
}

function AssignModal({
  bedId,
  bedLabel,
  employees,
  onClose,
}: {
  bedId: string | null;
  bedLabel: string;
  employees: EmployeeOption[];
  onClose: () => void;
}) {
  return (
    <Dialog modal={false} open={bedId !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        title={`Assign Employee to ${bedLabel}`}
        description="Select an unassigned employee to assign to this bed."
      >
        {employees.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            No unassigned employees available.
          </p>
        ) : (
          // Keyed by bedId so the selected employee resets whenever a different bed is opened.
          <AssignForm key={bedId} bedId={bedId} employees={employees} onClose={onClose} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function AssignForm({
  bedId,
  employees,
  onClose,
}: {
  bedId: string | null;
  employees: EmployeeOption[];
  onClose: () => void;
}) {
  const [employeeId, setEmployeeId] = useState("");

  return (
    <form
      action={async (formData) => {
        await assignBedAction(formData);
        onClose();
      }}
      className="mt-4 space-y-4"
    >
      <input type="hidden" name="bedId" value={bedId ?? ""} />
      <Select
        name="employeeId"
        value={employeeId}
        onChange={setEmployeeId}
        required
        placeholder="Select an employee"
        options={employees.map((e) => ({
          value: e.id,
          label: `${e.name} (${e.employeeIdNo})${e.nationality ? ` — ${e.nationality}` : ""}`,
        }))}
      />
      <DialogFooter>
        <button
          type="button"
          onClick={onClose}
          className="btn btn-secondary"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!employeeId}
          className="btn btn-primary"
        >
          Assign
        </button>
      </DialogFooter>
    </form>
  );
}

function BulkCheckInModal({
  roomId,
  roomName,
  vacantCount,
  roomNationality,
  employees,
  onClose,
}: {
  roomId: string | null;
  roomName: string;
  vacantCount: number;
  roomNationality: string | null;
  employees: EmployeeOption[];
  onClose: () => void;
}) {
  return (
    <Dialog modal={false} open={roomId !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        title={`Bulk Check-In to ${roomName}`}
        description={`Select up to ${vacantCount} employee${vacantCount === 1 ? "" : "s"} to check into this room's vacant beds.`}
      >
        {employees.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No unassigned employees available.</p>
        ) : (
          <BulkCheckInForm
            key={roomId}
            roomId={roomId}
            vacantCount={vacantCount}
            roomNationality={roomNationality}
            employees={employees}
            onClose={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function BulkCheckInForm({
  roomId,
  vacantCount,
  roomNationality,
  employees,
  onClose,
}: {
  roomId: string | null;
  vacantCount: number;
  roomNationality: string | null;
  employees: EmployeeOption[];
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < vacantCount) {
        next.add(id);
      }
      return next;
    });
  }

  function handleSubmit() {
    if (!roomId || selected.size === 0) return;
    const formData = new FormData();
    formData.append("roomId", roomId);
    for (const id of selected) formData.append("employeeId", id);
    startTransition(async () => {
      const res = await bulkCheckInAction(formData);
      if (res.assigned < res.requested) {
        setResult(`Checked in ${res.assigned} of ${res.requested} — room is now full.`);
      } else {
        onClose();
      }
    });
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="max-h-72 space-y-1 overflow-y-auto rounded-lg border border-default p-2">
        {employees.map((e) => {
          const disabled = !selected.has(e.id) && selected.size >= vacantCount;
          const matches = roomNationality && e.nationality === roomNationality;
          return (
            <label
              key={e.id}
              className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm ${
                disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer hover:bg-surface-hover"
              }`}
              onClick={(ev) => {
                ev.preventDefault();
                if (!disabled) toggle(e.id);
              }}
            >
              <Checkbox checked={selected.has(e.id)} />
              <span className="flex-1 truncate">
                {e.name} ({e.employeeIdNo})
                {e.nationality && <span className="text-subtle"> — {e.nationality}</span>}
              </span>
              {matches && (
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                  match
                </span>
              )}
            </label>
          );
        })}
      </div>
      {result && <p className="text-xs text-amber-600">{result}</p>}
      <DialogFooter>
        <button
          type="button"
          onClick={onClose}
          className="btn btn-secondary"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={selected.size === 0 || pending}
          className="btn btn-primary"
        >
          {pending ? "Checking in…" : `Check in ${selected.size}`}
        </button>
      </DialogFooter>
    </div>
  );
}
