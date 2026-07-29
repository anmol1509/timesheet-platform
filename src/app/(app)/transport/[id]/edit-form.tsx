"use client";

import { useState, useTransition } from "react";
import { updateVehicleAction } from "../actions";

type Vehicle = {
  id: string;
  type: string | null;
  capacity: number | null;
  driverName: string | null;
  driverPhone: string | null;
  registrationExpiry: string;
  insuranceExpiry: string;
  status: string;
  notes: string | null;
};

export function EditVehicleForm({ vehicle }: { vehicle: Vehicle }) {
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  return (
    <form
      action={(formData) => {
        setSaved(false);
        startTransition(async () => {
          await updateVehicleAction(formData);
          setSaved(true);
        });
      }}
      className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6"
    >
      <input type="hidden" name="vehicleId" value={vehicle.id} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Type">
          <input
            name="type"
            placeholder="e.g. 30-seater bus"
            defaultValue={vehicle.type || ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
          />
        </Field>
        <Field label="Capacity (seats)">
          <input
            name="capacity"
            type="number"
            min={0}
            defaultValue={vehicle.capacity ?? ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
          />
        </Field>
        <Field label="Driver name">
          <input
            name="driverName"
            defaultValue={vehicle.driverName || ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
          />
        </Field>
        <Field label="Driver phone">
          <input
            name="driverPhone"
            defaultValue={vehicle.driverPhone || ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
          />
        </Field>
        <Field label="Registration (Mulkiya) expiry">
          <input
            name="registrationExpiry"
            type="date"
            defaultValue={vehicle.registrationExpiry}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
          />
        </Field>
        <Field label="Insurance expiry">
          <input
            name="insuranceExpiry"
            type="date"
            defaultValue={vehicle.insuranceExpiry}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
          />
        </Field>
        <Field label="Status">
          <select
            name="status"
            defaultValue={vehicle.status}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
          >
            <option value="ACTIVE">Active</option>
            <option value="MAINTENANCE">Maintenance</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </Field>
        <div className="sm:col-span-2">
          <Field label="Notes">
            <textarea
              name="notes"
              rows={2}
              defaultValue={vehicle.notes || ""}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            />
          </Field>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-[#0B1642] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#0B1642]/90 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save changes"}
        </button>
        {saved && !pending && (
          <span className="text-sm text-emerald-600">Saved.</span>
        )}
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}
