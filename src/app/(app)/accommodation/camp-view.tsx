"use client";

import { useState } from "react";
import { BedDouble } from "lucide-react";
import { DeleteButton } from "@/components/DeleteButton";
import { InlineEditRow } from "@/components/InlineEditRow";
import { SegmentedControl } from "@/components/ui/RadioGroup";
import { Select } from "@/components/ui/Select";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/Dialog";
import {
  assignBedAction,
  unassignBedAction,
  updateRoomAction,
  deleteRoomAction,
  addBedsToRoomAction,
} from "./actions";

type Bed = { id: string; label: string; employeeId: string | null };
type Room = { id: string; name: string; beds: Bed[] };
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

  const allBeds = rooms.flatMap((r) => r.beds);
  const vacantCount = allBeds.filter((b) => !b.employeeId).length;
  const assigningBedObj = allBeds.find((b) => b.id === assigningBed) || null;

  if (rooms.length === 0) {
    return (
      <p className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-sm text-slate-500">
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
        <div className="flex items-center gap-4 text-xs text-slate-500">
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
            <div key={room.id} className="rounded-3xl border border-slate-200 bg-white p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <InlineEditRow
                    value={room.name}
                    action={updateRoomAction}
                    hiddenFields={{ roomId: room.id }}
                  />
                  <span className="text-xs text-slate-400">
                    {occupied}/{room.beds.length} occupied
                  </span>
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
                      className="w-14 rounded-lg border border-slate-300 px-2 py-1 text-xs outline-none focus:border-slate-900"
                    />
                    <button
                      type="submit"
                      className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
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
                <p className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-400">
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
                        <p className="mt-1.5 text-sm font-semibold text-slate-900">
                          {bed.label}
                        </p>
                        {occupant ? (
                          <>
                            <p className="mt-1 truncate text-xs text-slate-700" title={occupant.name}>
                              {occupant.name}
                            </p>
                            <p className="text-[10px] text-slate-400">
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
                            className="mt-2 block w-full rounded-lg bg-emerald-600 px-2 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
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
          <p className="mt-3 text-sm text-slate-500">
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
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!employeeId}
          className="rounded-lg bg-[#166534] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#166534]/90 disabled:opacity-50"
        >
          Assign
        </button>
      </DialogFooter>
    </form>
  );
}
