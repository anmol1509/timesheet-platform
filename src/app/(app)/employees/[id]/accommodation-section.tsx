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
  const camps = [...new Set(vacantBeds.map((b) => b.campName))].sort();
  const [camp, setCamp] = useState("");
  const [selected, setSelected] = useState("");
  const bedsInCamp = vacantBeds.filter((b) => b.campName === camp);

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
          <label className="block min-w-[200px] flex-1">
            <span className="mb-1 block text-xs font-medium text-slate-500">
              Camp
            </span>
            <select
              value={camp}
              onChange={(e) => {
                setCamp(e.target.value);
                setSelected("");
              }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            >
              <option value="">Select a camp</option>
              {camps.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="block min-w-[240px] flex-1">
            <span className="mb-1 block text-xs font-medium text-slate-500">
              Bed
            </span>
            <select
              name="bedId"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              disabled={!camp}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900 disabled:bg-slate-50 disabled:text-slate-400"
            >
              <option value="">
                {camp ? "Select a vacant bed" : "Select a camp first"}
              </option>
              {bedsInCamp.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.roomName} · {b.label}
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
