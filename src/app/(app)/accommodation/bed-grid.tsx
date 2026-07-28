"use client";

import { useState } from "react";
import { BedDouble } from "lucide-react";
import { assignBedAction, unassignBedAction } from "./actions";

type Bed = { id: string; label: string; employeeId: string | null };
type EmployeeOption = {
  id: string;
  name: string;
  employeeIdNo: string;
  nationality: string | null;
};

export function BedGrid({
  beds,
  employeeNames,
  unassignedEmployees,
}: {
  beds: Bed[];
  employeeNames: Record<string, { name: string; employeeIdNo: string }>;
  unassignedEmployees: EmployeeOption[];
}) {
  const [assigningBed, setAssigningBed] = useState<string | null>(null);

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {beds.map((bed) => {
        const occupant = bed.employeeId ? employeeNames[bed.employeeId] : null;
        return (
          <div
            key={bed.id}
            className={`rounded-xl border p-4 ${
              occupant
                ? "border-slate-200 bg-slate-50"
                : "border-emerald-200 bg-emerald-50"
            }`}
          >
            <BedDouble
              className={`h-5 w-5 ${occupant ? "text-slate-400" : "text-emerald-500"}`}
            />
            <p className="mt-2 text-sm font-semibold text-slate-900">
              {bed.label}
            </p>
            {occupant ? (
              <>
                <p className="text-xs text-slate-500">occupied</p>
                <p className="mt-2 text-sm text-slate-700">{occupant.name}</p>
                <p className="text-xs text-slate-400">{occupant.employeeIdNo}</p>
                <form action={unassignBedAction} className="mt-2">
                  <input type="hidden" name="bedId" value={bed.id} />
                  <button
                    type="submit"
                    className="text-xs font-medium text-red-600 hover:underline"
                  >
                    Unassign
                  </button>
                </form>
              </>
            ) : (
              <>
                <span className="mt-1 inline-block rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                  vacant
                </span>
                <button
                  type="button"
                  onClick={() => setAssigningBed(bed.id)}
                  className="mt-2 block w-full rounded-lg bg-emerald-600 px-2 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
                >
                  + Assign
                </button>
              </>
            )}
          </div>
        );
      })}

      {assigningBed && (
        <AssignModal
          bedId={assigningBed}
          bedLabel={beds.find((b) => b.id === assigningBed)?.label || ""}
          employees={unassignedEmployees}
          onClose={() => setAssigningBed(null)}
        />
      )}
    </div>
  );
}

function AssignModal({
  bedId,
  bedLabel,
  employees,
  onClose,
}: {
  bedId: string;
  bedLabel: string;
  employees: EmployeeOption[];
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900">
            Assign Employee to {bedLabel}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
          >
            ×
          </button>
        </div>
        <p className="mb-3 text-sm text-slate-500">
          Select an unassigned employee to assign to this bed.
        </p>
        {employees.length === 0 ? (
          <p className="text-sm text-slate-500">
            No unassigned employees available.
          </p>
        ) : (
          <form
            action={async (formData) => {
              await assignBedAction(formData);
              onClose();
            }}
            className="space-y-4"
          >
            <input type="hidden" name="bedId" value={bedId} />
            <select
              name="employeeId"
              required
              defaultValue=""
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            >
              <option value="">Select an employee</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} {e.nationality ? `(${e.nationality})` : ""}
                </option>
              ))}
            </select>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-[#0B1642] px-4 py-2 text-sm font-medium text-white hover:bg-[#0B1642]/90"
              >
                Assign
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
