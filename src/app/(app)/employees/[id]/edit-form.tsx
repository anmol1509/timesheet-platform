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
  notes: string | null;
};

type Project = { id: string; name: string; code: string };

function toDateInput(d: Date | null) {
  if (!d) return "";
  return new Date(d).toISOString().slice(0, 10);
}

export function EditForm({
  employee,
  projects,
}: {
  employee: Employee;
  projects: Project[];
}) {
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

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
