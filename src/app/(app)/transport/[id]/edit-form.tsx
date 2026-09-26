"use client";

import { PhoneField } from "@/components/ui/PhoneField";
import { useState, useTransition } from "react";
import { updateVehicleAction } from "../actions";
import { Select } from "@/components/ui/Select";
import { ComboSelect } from "@/components/ui/ComboSelect";
import { VEHICLE_TYPES } from "@/lib/formLists";
import { DatePicker } from "@/components/ui/DatePicker";
import { NumberInput } from "@/components/ui/NumberInput";

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
          <ComboSelect name="type" options={VEHICLE_TYPES} defaultValue={vehicle.type} />
        </Field>
        <Field label="Capacity (seats)">
          <NumberInput name="capacity" defaultValue={vehicle.capacity ?? ""} min={0} className="w-full" />
        </Field>
        <Field label="Driver name">
          <input
            name="driverName"
            defaultValue={vehicle.driverName || ""}
            className="input w-full"
          />
        </Field>
        <Field label="Driver phone">
          <PhoneField name="driverPhone" defaultValue={vehicle.driverPhone} />
        </Field>
        <Field label="Registration (Mulkiya) expiry">
          <DatePicker name="registrationExpiry" defaultValue={vehicle.registrationExpiry} className="w-full" />
        </Field>
        <Field label="Insurance expiry">
          <DatePicker name="insuranceExpiry" defaultValue={vehicle.insuranceExpiry} className="w-full" />
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
          <span className="text-sm text-[var(--success)]">Saved.</span>
        )}
      </div>
    </form>
  );
}

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted">
        {label}
        {required && <span className="text-[var(--error)]"> *</span>}
      </span>
      {children}
    </label>
  );
}
