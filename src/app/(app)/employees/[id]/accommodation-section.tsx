"use client";

import { useState } from "react";
import { assignBedAction, unassignBedAction } from "../../accommodation/actions";

type BedOption = {
  id: string;
  label: string;
  roomName: string;
  campName: string;
};

export function AccommodationSection({
  employeeId,
  currentBed,
  vacantBeds,
}: {
  employeeId: string;
  currentBed: BedOption | null;
  vacantBeds: BedOption[];
}) {
  const [selected, setSelected] = useState("");

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="mb-2 text-sm font-semibold text-slate-900">
        Accommodation
      </h2>
      {currentBed ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-600">
            <span className="font-medium text-slate-900">
              {currentBed.campName} · {currentBed.roomName} · {currentBed.label}
            </span>
          </p>
          <form action={unassignBedAction}>
            <input type="hidden" name="bedId" value={currentBed.id} />
            <input type="hidden" name="employeeId" value={employeeId} />
            <button
              type="submit"
              className="text-xs font-medium text-red-600 hover:underline"
            >
              Unassign bed
            </button>
          </form>
        </div>
      ) : vacantBeds.length === 0 ? (
        <p className="text-sm text-slate-500">
          Not housed yet, and no vacant beds available right now.
        </p>
      ) : (
        <form
          action={async (formData) => {
            await assignBedAction(formData);
            setSelected("");
          }}
          className="flex flex-wrap items-end gap-3"
        >
          <input type="hidden" name="employeeId" value={employeeId} />
          <label className="block flex-1 min-w-[240px]">
            <span className="mb-1 block text-xs font-medium text-slate-500">
              Assign a bed
            </span>
            <select
              name="bedId"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            >
              <option value="">Select a vacant bed</option>
              {vacantBeds.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.campName} · {b.roomName} · {b.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            disabled={!selected}
            className="rounded-lg bg-[#0B1642] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#0B1642]/90 disabled:opacity-50"
          >
            Assign
          </button>
        </form>
      )}
    </div>
  );
}
