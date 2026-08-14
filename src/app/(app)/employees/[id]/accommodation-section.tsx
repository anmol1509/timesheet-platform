"use client";

import { useState } from "react";
import { assignBedAction, unassignBedAction } from "../../accommodation/actions";
import { Select } from "@/components/ui/Select";
import { DeleteButton } from "@/components/DeleteButton";

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
    <div className="card p-5">
      <h2 className="mb-2 text-sm font-semibold text-primary">
        Accommodation
      </h2>
      {currentBed ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-secondary">
            <span className="font-medium text-primary">
              {currentBed.campName} · {currentBed.roomName} · {currentBed.label}
            </span>
          </p>
          <DeleteButton
            action={unassignBedAction}
            hiddenFields={{ bedId: currentBed.id, employeeId }}
            confirmMessage={`Unassign ${currentBed.campName} · ${currentBed.roomName} · ${currentBed.label} from this employee?`}
            label="Unassign bed"
          />
        </div>
      ) : vacantBeds.length === 0 ? (
        <p className="text-sm text-muted">
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
            <span className="mb-1 block text-xs font-medium text-muted">
              Camp
            </span>
            <Select
              value={camp}
              onChange={(v) => {
                setCamp(v);
                setSelected("");
              }}
              placeholder="Select a camp"
              options={camps.map((c) => ({ value: c, label: c }))}
            />
          </label>
          <label className="block min-w-[240px] flex-1">
            <span className="mb-1 block text-xs font-medium text-muted">
              Bed
            </span>
            <Select
              name="bedId"
              value={selected}
              onChange={setSelected}
              disabled={!camp}
              placeholder={camp ? "Select a vacant bed" : "Select a camp first"}
              options={bedsInCamp.map((b) => ({ value: b.id, label: `${b.roomName} · ${b.label}` }))}
            />
          </label>
          <button
            type="submit"
            disabled={!selected}
            className="btn btn-primary"
          >
            Assign
          </button>
        </form>
      )}
    </div>
  );
}
