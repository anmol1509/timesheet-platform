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
  plateNumber: string;
  type: string | null;
  capacity: number | null;
  driverName: string | null;
  driverPhone: string | null;
  registrationExpiry: string;
  insuranceExpiry: string;
  status: string;
  notes: string | null;
  driverEmployeeId: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  colour: string | null;
  chassisNumber: string | null;
  engineNumber: string | null;
  trafficFileNumber: string | null;
  plateEmirate: string | null;
  plateCategory: string | null;
  fuelType: string | null;
  ownership: string;
  lessor: string | null;
  odometerKm: number | null;
};

const EMIRATES = ["Abu Dhabi", "Dubai", "Sharjah", "Ajman", "Umm Al Quwain", "Ras Al Khaimah", "Fujairah"];
const FUEL = ["Petrol", "Diesel", "Hybrid", "Electric", "CNG"];
const CATEGORIES = ["Private", "Commercial", "Transport", "Heavy vehicle", "Taxi"];

export function EditVehicleForm({ vehicle, drivers }: { vehicle: Vehicle; drivers: { id: string; name: string; employeeIdNo: string | null }[] }) {
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ownership, setOwnership] = useState(vehicle.ownership);
  const [driverId, setDriverId] = useState(vehicle.driverEmployeeId ?? "");

  return (
    <form
      action={(formData) => {
        setSaved(false);
        startTransition(async () => {
          const res = await updateVehicleAction(formData);
          setError(res.error);
          setSaved(!res.error);
        });
      }}
      className="card space-y-4 p-6"
    >
      <input type="hidden" name="vehicleId" value={vehicle.id} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Plate number">
          <input name="plateNumber" required maxLength={40} defaultValue={vehicle.plateNumber} className="input w-full uppercase" />
        </Field>
        <Field label="Type">
          <ComboSelect name="type" options={VEHICLE_TYPES} defaultValue={vehicle.type} />
        </Field>
        <Field label="Capacity (seats)">
          <NumberInput name="capacity" defaultValue={vehicle.capacity ?? ""} min={0} className="w-full" />
        </Field>
        <Field label="Driver (employee)">
          <Select
            name="driverEmployeeId"
            value={driverId}
            onChange={setDriverId}
            placeholder="Outside driver / none"
            options={[{ value: "", label: "Outside driver / none" }, ...drivers.map((d) => ({ value: d.id, label: d.employeeIdNo ? `${d.name} · ${d.employeeIdNo}` : d.name }))]}
          />
        </Field>
        {!driverId && (
          <>
            <Field label="Driver name">
              <input name="driverName" defaultValue={vehicle.driverName || ""} className="input w-full" />
            </Field>
            <Field label="Driver phone">
              <PhoneField name="driverPhone" defaultValue={vehicle.driverPhone} />
            </Field>
          </>
        )}
        <Field label="Make">
          <input name="make" defaultValue={vehicle.make ?? ""} className="input w-full" placeholder="Toyota" />
        </Field>
        <Field label="Model">
          <input name="model" defaultValue={vehicle.model ?? ""} className="input w-full" placeholder="Hiace" />
        </Field>
        <Field label="Model year">
          <NumberInput name="year" defaultValue={vehicle.year ?? ""} min={1950} className="w-full" />
        </Field>
        <Field label="Colour">
          <input name="colour" defaultValue={vehicle.colour ?? ""} className="input w-full" />
        </Field>
        <Field label="Chassis / VIN">
          <input name="chassisNumber" defaultValue={vehicle.chassisNumber ?? ""} maxLength={40} className="input w-full uppercase" />
        </Field>
        <Field label="Engine number">
          <input name="engineNumber" defaultValue={vehicle.engineNumber ?? ""} maxLength={40} className="input w-full uppercase" />
        </Field>
        <Field label="Plate emirate">
          <ComboSelect name="plateEmirate" options={EMIRATES} defaultValue={vehicle.plateEmirate} />
        </Field>
        <Field label="Plate category">
          <ComboSelect name="plateCategory" options={CATEGORIES} defaultValue={vehicle.plateCategory} />
        </Field>
        <Field label="Traffic file number">
          <input name="trafficFileNumber" defaultValue={vehicle.trafficFileNumber ?? ""} className="input w-full" />
        </Field>
        <Field label="Fuel type">
          <ComboSelect name="fuelType" options={FUEL} defaultValue={vehicle.fuelType} />
        </Field>
        <Field label="Odometer (km)">
          <NumberInput name="odometerKm" defaultValue={vehicle.odometerKm ?? ""} min={0} className="w-full" />
        </Field>
        <Field label="Ownership">
          <Select
            name="ownership"
            value={ownership}
            onChange={setOwnership}
            searchable={false}
            options={[
              { value: "OWNED", label: "Owned" },
              { value: "LEASED", label: "Leased" },
              { value: "RENTED", label: "Rented" },
            ]}
          />
        </Field>
        {ownership !== "OWNED" && (
          <Field label={ownership === "LEASED" ? "Leasing company" : "Rental company"}>
            <input name="lessor" defaultValue={vehicle.lessor ?? ""} className="input w-full" />
          </Field>
        )}
        <Field label="Registration (Mulkiya) expiry — follows the uploaded Mulkiya">
          <DatePicker name="registrationExpiry" defaultValue={vehicle.registrationExpiry} className="w-full" />
        </Field>
        <Field label="Insurance expiry — follows the uploaded policy">
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
        {error && <p role="alert" className="text-sm text-[var(--error)]">{error}</p>}
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
