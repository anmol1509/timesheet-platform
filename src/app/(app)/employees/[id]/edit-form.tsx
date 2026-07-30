"use client";

import { useState, useTransition } from "react";
import { updateEmployeeAction } from "./actions";

type Employee = {
  id: string;
  nationality: string | null;
  position: string | null;
  passportNumber: string | null;
  emiratesId: string | null;
  visaExpiry: Date | null;
  laborCardExpiry: Date | null;
  medicalExpiry: Date | null;
  passportExpiry: Date | null;
  salaryType: string | null;
  projectId: string | null;
  vehicleId: string | null;
  notes: string | null;
  dateOfBirth: Date | null;
  gender: string | null;
  bloodGroup: string | null;
  mobileNumber: string | null;
  whatsappNumber: string | null;
  joinDate: Date | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  sponsorName: string | null;
  laborCardNumber: string | null;
  wpsBankName: string | null;
  wpsIban: string | null;
  active: boolean;
  inactiveReason: string | null;
  lastDemobilizedDate: Date | null;
  religion: string | null;
  state: string | null;
  accommodationType: string | null;
  previousId: string | null;
  nameInIdCard: string | null;
};

type Project = { id: string; name: string; code: string };
type Vehicle = { id: string; plateNumber: string; type: string | null };

function toDateInput(d: Date | null) {
  if (!d) return "";
  return new Date(d).toISOString().slice(0, 10);
}

export function EditForm({
  employee,
  projects,
  vehicles,
}: {
  employee: Employee;
  projects: Project[];
  vehicles: Vehicle[];
}) {
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [active, setActive] = useState(employee.active);

  return (
    <form
      action={(formData) => {
        setSaved(false);
        startTransition(async () => {
          await updateEmployeeAction(formData);
          setSaved(true);
        });
      }}
      className="space-y-8"
    >
      <input type="hidden" name="employeeId" value={employee.id} />

      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Status</h2>
        <div className="grid grid-cols-1 gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:grid-cols-2">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              name="active"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            Active
          </label>
          <div />
          {!active && (
            <>
              <Field label="Reason">
                <input
                  name="inactiveReason"
                  defaultValue={employee.inactiveReason || ""}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
                />
              </Field>
              <Field label="Last demobilized date">
                <input
                  name="lastDemobilizedDate"
                  type="date"
                  defaultValue={toDateInput(employee.lastDemobilizedDate)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
                />
              </Field>
            </>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-900">
          Personal details
        </h2>
        <div className="grid grid-cols-1 gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:grid-cols-2">
          <Field label="Nationality">
            <input
              name="nationality"
              defaultValue={employee.nationality || ""}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            />
          </Field>
          <Field label="Position">
            <input
              name="position"
              defaultValue={employee.position || ""}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            />
          </Field>
          <Field label="Passport number">
            <input
              name="passportNumber"
              defaultValue={employee.passportNumber || ""}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            />
          </Field>
          <Field label="Emirates ID">
            <input
              name="emiratesId"
              defaultValue={employee.emiratesId || ""}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            />
          </Field>
          <Field label="Date of birth">
            <input
              type="date"
              name="dateOfBirth"
              defaultValue={toDateInput(employee.dateOfBirth)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            />
          </Field>
          <Field label="Gender">
            <select
              name="gender"
              defaultValue={employee.gender || ""}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            >
              <option value="">Not set</option>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
            </select>
          </Field>
          <Field label="Blood group">
            <input
              name="bloodGroup"
              placeholder="e.g. O+"
              defaultValue={employee.bloodGroup || ""}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            />
          </Field>
          <Field label="Mobile number">
            <input
              name="mobileNumber"
              defaultValue={employee.mobileNumber || ""}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            />
          </Field>
          <Field label="WhatsApp number">
            <input
              name="whatsappNumber"
              defaultValue={employee.whatsappNumber || ""}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            />
          </Field>
          <Field label="Join date">
            <input
              type="date"
              name="joinDate"
              defaultValue={toDateInput(employee.joinDate)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            />
          </Field>
          <Field label="Sponsor / visa-holding entity">
            <input
              name="sponsorName"
              placeholder="If different from company"
              defaultValue={employee.sponsorName || ""}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            />
          </Field>
          <Field label="Emergency contact name">
            <input
              name="emergencyContactName"
              defaultValue={employee.emergencyContactName || ""}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            />
          </Field>
          <Field label="Emergency contact phone">
            <input
              name="emergencyContactPhone"
              defaultValue={employee.emergencyContactPhone || ""}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            />
          </Field>
          <Field label="Religion">
            <input
              name="religion"
              defaultValue={employee.religion || ""}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            />
          </Field>
          <Field label="State">
            <input
              name="state"
              placeholder="State/province within nationality"
              defaultValue={employee.state || ""}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            />
          </Field>
          <Field label="Accommodation type">
            <input
              name="accommodationType"
              placeholder="e.g. Staff Accommodation"
              defaultValue={employee.accommodationType || ""}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            />
          </Field>
          <Field label="Previous ID">
            <input
              name="previousId"
              defaultValue={employee.previousId || ""}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            />
          </Field>
          <Field label="Name in ID card">
            <input
              name="nameInIdCard"
              defaultValue={employee.nameInIdCard || ""}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            />
          </Field>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-900">
          Payroll & WPS
        </h2>
        <div className="grid grid-cols-1 gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:grid-cols-2">
          <Field label="Labor card number">
            <input
              name="laborCardNumber"
              defaultValue={employee.laborCardNumber || ""}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            />
          </Field>
          <div />
          <Field label="WPS bank / exchange house name">
            <input
              name="wpsBankName"
              defaultValue={employee.wpsBankName || ""}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            />
          </Field>
          <Field label="WPS IBAN">
            <input
              name="wpsIban"
              defaultValue={employee.wpsIban || ""}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            />
          </Field>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-900">
          Compliance & documents
        </h2>
        <div className="grid grid-cols-1 gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:grid-cols-2">
          <Field label="Visa expiry date">
            <input
              type="date"
              name="visaExpiry"
              defaultValue={toDateInput(employee.visaExpiry)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            />
          </Field>
          <Field label="Labor card expiry">
            <input
              type="date"
              name="laborCardExpiry"
              defaultValue={toDateInput(employee.laborCardExpiry)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            />
          </Field>
          <Field label="Medical certificate expiry">
            <input
              type="date"
              name="medicalExpiry"
              defaultValue={toDateInput(employee.medicalExpiry)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            />
          </Field>
          <Field label="Passport expiry date">
            <input
              type="date"
              name="passportExpiry"
              defaultValue={toDateInput(employee.passportExpiry)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Additional notes">
              <textarea
                name="notes"
                defaultValue={employee.notes || ""}
                rows={3}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
              />
            </Field>
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-900">
          Project & salary
        </h2>
        <div className="grid grid-cols-1 gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:grid-cols-2">
          <Field label="Project assignment">
            <select
              name="projectId"
              defaultValue={employee.projectId || ""}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            >
              <option value="">No project assigned</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Vehicle assignment">
            <select
              name="vehicleId"
              defaultValue={employee.vehicleId || ""}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            >
              <option value="">No vehicle assigned</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.plateNumber} {v.type ? `(${v.type})` : ""}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Salary type (reference only)">
            <select
              name="salaryType"
              defaultValue={employee.salaryType || ""}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            >
              <option value="">Not set</option>
              <option value="BASIC">Basic Salary</option>
              <option value="HOURLY">Hourly Rate</option>
            </select>
          </Field>
        </div>
      </section>

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
