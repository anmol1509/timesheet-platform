"use client";

import { useState, useTransition } from "react";
import { updateVehicleAction } from "../actions";
import { Select } from "@/components/ui/Select";

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
      className="card space-y-4 p-6"
    >
      <input type="hidden" name="vehicleId" value={vehicle.id} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Type">
          <input
            name="type"
            placeholder="e.g. 30-seater bus"
            defaultValue={vehicle.type || ""}
            className="input w-full"
          />
        </Field>
        <Field label="Capacity (seats)">
          <input
            name="capacity"
            type="number"
            min={0}
            defaultValue={vehicle.capacity ?? ""}
            className="input w-full"
          />
        </Field>
        <Field label="Driver name">
          <input
            name="driverName"
            defaultValue={vehicle.driverName || ""}
            className="input w-full"
          />
        </Field>
        <Field label="Driver phone">
          <input
            name="driverPhone"
            defaultValue={vehicle.driverPhone || ""}
            className="input w-full"
          />
        </Field>
        <Field label="Registration (Mulkiya) expiry">
          <input
            name="registrationExpiry"
            type="date"
            defaultValue={vehicle.registrationExpiry}
            className="input w-full"
          />
        </Field>
        <Field label="Insurance expiry">
          <input
            name="insuranceExpiry"
            type="date"
            defaultValue={vehicle.insuranceExpiry}
            className="input w-full"
          />
        </Field>
        <Field label="Status">
          <Select
            name="status"
            defaultValue={vehicle.status}
            searchable={false}
            options={[
              { value: "ACTIVE", label: "Active" },
              { value: "MAINTENANCE", label: "Maintenance" },
              { value: "INACTIVE", label: "Inactive" },
            ]}
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Notes">
            <textarea
              name="notes"
              rows={2}
              defaultValue={vehicle.notes || ""}
              className="input w-full"
            />
          </Field>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="btn btn-primary"
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
      <span className="mb-1 block text-xs font-medium text-muted">
        {label}
      </span>
      {children}
    </label>
  );
}
