"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { updateProjectAction } from "../actions";

type Project = {
  id: string;
  description: string | null;
  siteId: string | null;
  manager: string | null;
  timelineStart: string;
  timelineEnd: string;
  status: string;
  clientProjectNo: string | null;
  jobType: string | null;
  mainContractor: string | null;
  paymentType: string | null;
  lpoNo: string | null;
  lpoDate: string;
  closedLpo: boolean;
  sponsorshipCompany: string | null;
  salesExecutive: string | null;
  contactNo: string | null;
  timesheetCollectionDate: string;
  noOfEmployeesRequired: number | null;
  dayShiftStart: string | null;
  dayShiftEnd: string | null;
  nightShiftStart: string | null;
  nightShiftEnd: string | null;
  interTransfer: boolean;
  internalUse: boolean;
};

export function EditProjectForm({
  project,
  sites,
}: {
  project: Project;
  sites: { id: string; name: string }[];
}) {
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  return (
    <form
      action={(formData) => {
        setSaved(false);
        startTransition(async () => {
          await updateProjectAction(formData);
          setSaved(true);
        });
      }}
      className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6"
    >
      <input type="hidden" name="projectId" value={project.id} />

      <Section title="Overview">
        <Field label="Description" className="sm:col-span-2">
          <textarea
            name="description"
            rows={2}
            defaultValue={project.description || ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
          />
        </Field>
        <Field label="Site">
          {sites.length === 0 ? (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              No sites yet.{" "}
              <Link href="/sites" className="underline">
                Add a site
              </Link>
              .
            </p>
          ) : (
            <select
              name="siteId"
              defaultValue={project.siteId || ""}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            >
              <option value="">No site</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Project manager">
          <input
            name="manager"
            defaultValue={project.manager || ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
          />
        </Field>
        <Field label="Status">
          <select
            name="status"
            defaultValue={project.status}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
          >
            <option value="PLANNING">Planning</option>
            <option value="ACTIVE">Active</option>
            <option value="ON_HOLD">On Hold</option>
            <option value="COMPLETED">Completed</option>
          </select>
        </Field>
        <Field label="Timeline start">
          <input
            name="timelineStart"
            type="date"
            defaultValue={project.timelineStart}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
          />
        </Field>
        <Field label="Timeline end">
          <input
            name="timelineEnd"
            type="date"
            defaultValue={project.timelineEnd}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
          />
        </Field>
      </Section>

      <Section title="Procurement">
        <Field label="Client project no.">
          <input
            name="clientProjectNo"
            defaultValue={project.clientProjectNo || ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
          />
        </Field>
        <Field label="Job type">
          <input
            name="jobType"
            defaultValue={project.jobType || ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
          />
        </Field>
        <Field label="Main contractor">
          <input
            name="mainContractor"
            defaultValue={project.mainContractor || ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
          />
        </Field>
        <Field label="Payment type">
          <input
            name="paymentType"
            defaultValue={project.paymentType || ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
          />
        </Field>
        <Field label="LPO no.">
          <input
            name="lpoNo"
            defaultValue={project.lpoNo || ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
          />
        </Field>
        <Field label="LPO date">
          <input
            name="lpoDate"
            type="date"
            defaultValue={project.lpoDate}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
          />
        </Field>
        <Field label="Sponsorship company">
          <input
            name="sponsorshipCompany"
            defaultValue={project.sponsorshipCompany || ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
          />
        </Field>
        <CheckboxField label="Closed LPO" name="closedLpo" defaultChecked={project.closedLpo} />
      </Section>

      <Section title="Staffing & schedule">
        <Field label="Sales executive">
          <input
            name="salesExecutive"
            defaultValue={project.salesExecutive || ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
          />
        </Field>
        <Field label="Contact no.">
          <input
            name="contactNo"
            defaultValue={project.contactNo || ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
          />
        </Field>
        <Field label="Timesheet collection date">
          <input
            name="timesheetCollectionDate"
            type="date"
            defaultValue={project.timesheetCollectionDate}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
          />
        </Field>
        <Field label="No. of employees required">
          <input
            name="noOfEmployeesRequired"
            type="number"
            min={0}
            defaultValue={project.noOfEmployeesRequired ?? ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
          />
        </Field>
        <Field label="Day shift start">
          <input
            name="dayShiftStart"
            type="time"
            defaultValue={project.dayShiftStart || ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
          />
        </Field>
        <Field label="Day shift end">
          <input
            name="dayShiftEnd"
            type="time"
            defaultValue={project.dayShiftEnd || ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
          />
        </Field>
        <Field label="Night shift start">
          <input
            name="nightShiftStart"
            type="time"
            defaultValue={project.nightShiftStart || ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
          />
        </Field>
        <Field label="Night shift end">
          <input
            name="nightShiftEnd"
            type="time"
            defaultValue={project.nightShiftEnd || ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
          />
        </Field>
        <CheckboxField
          label="Inter transfer"
          name="interTransfer"
          defaultChecked={project.interTransfer}
        />
        <CheckboxField label="Internal use" name="internalUse" defaultChecked={project.internalUse} />
      </Section>

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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-3 text-xs font-semibold tracking-wide text-slate-400 uppercase">
        {title}
      </h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className || ""}`}>
      <span className="mb-1 block text-xs font-medium text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}

function CheckboxField({
  label,
  name,
  defaultChecked,
}: {
  label: string;
  name: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex items-center gap-2 pt-5 text-sm text-slate-600">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="h-4 w-4 rounded border-slate-300"
      />
      {label}
    </label>
  );
}
