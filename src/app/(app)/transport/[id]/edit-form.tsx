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
      className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6"
    >
      <input type="hidden" name="vehicleId" value={vehicle.id} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Type">
          <input
            name="type"
            placeholder="e.g. 30-seater bus"
            defaultValue={vehicle.type || ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
          />
        </Field>
        <Field label="Capacity (seats)">
          <input
            name="capacity"
            type="number"
            min={0}
            defaultValue={vehicle.capacity ?? ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
          />
        </Field>
        <Field label="Driver name">
          <input
            name="driverName"
            defaultValue={vehicle.driverName || ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
          />
        </Field>
        <Field label="Driver phone">
          <input
            name="driverPhone"
            defaultValue={vehicle.driverPhone || ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
          />
        </Field>
        <Field label="Registration (Mulkiya) expiry">
          <input
            name="registrationExpiry"
            type="date"
            defaultValue={vehicle.registrationExpiry}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
          />
        </Field>
        <Field label="Insurance expiry">
          <input
            name="insuranceExpiry"
            type="date"
            defaultValue={vehicle.insuranceExpiry}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
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
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
            />
          </Field>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--brand-primary-hover)] disabled:opacity-60"
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
