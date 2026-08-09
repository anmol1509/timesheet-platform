"use client";

import { useState, useTransition } from "react";
import { updateProjectAction } from "../actions";
import { Select } from "@/components/ui/Select";
import { Checkbox } from "@/components/ui/Checkbox";

type Project = {
  id: string;
  name: string;
  clientId: string;
  manager: string | null;
  projectCoordinator: string | null;
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
  clients,
}: {
  project: Project;
  clients: { id: string; name: string }[];
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
      className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6"
    >
      <input type="hidden" name="projectId" value={project.id} />

      <Section title="Basic Detail">
        <Field label="Project name">
          <input
            name="name"
            required
            defaultValue={project.name}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
          />
        </Field>
        <Field label="Client project no.">
          <input
            name="clientProjectNo"
            defaultValue={project.clientProjectNo || ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
          />
        </Field>
        <Field label="Status">
          <Select
            name="status"
            defaultValue={project.status}
            searchable={false}
            options={[
              { value: "PLANNING", label: "Planning" },
              { value: "ACTIVE", label: "Active" },
              { value: "ON_HOLD", label: "On Hold" },
              { value: "COMPLETED", label: "Completed" },
            ]}
          />
        </Field>
        <Field label="Job type">
          <input
            name="jobType"
            defaultValue={project.jobType || ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
          />
        </Field>
        <Field label="Main contractor">
          <input
            name="mainContractor"
            defaultValue={project.mainContractor || ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
          />
        </Field>
        <Field label="Payment type">
          <input
            name="paymentType"
            defaultValue={project.paymentType || ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
          />
        </Field>
        <Field label="Client">
          <Select
            name="clientId"
            defaultValue={project.clientId}
            options={clients.map((c) => ({ value: c.id, label: c.name }))}
          />
        </Field>
        <Field label="LPO no.">
          <input
            name="lpoNo"
            defaultValue={project.lpoNo || ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
          />
        </Field>
        <Field label="LPO date">
          <input
            name="lpoDate"
            type="date"
            defaultValue={project.lpoDate}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
          />
        </Field>
        <Field label="Sponsorship company">
          <input
            name="sponsorshipCompany"
            defaultValue={project.sponsorshipCompany || ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
          />
        </Field>
        <Field label="Sales executive">
          <input
            name="salesExecutive"
            defaultValue={project.salesExecutive || ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
          />
        </Field>
        <Field label="Project coordinator">
          <input
            name="projectCoordinator"
            defaultValue={project.projectCoordinator || ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
          />
        </Field>
        <Field label="Project manager">
          <input
            name="manager"
            defaultValue={project.manager || ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
          />
        </Field>
        <Field label="Start date">
          <input
            name="timelineStart"
            type="date"
            defaultValue={project.timelineStart}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
          />
        </Field>
        <Field label="End date">
          <input
            name="timelineEnd"
            type="date"
            defaultValue={project.timelineEnd}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
          />
        </Field>
        <Field label="Contact no.">
          <input
            name="contactNo"
            defaultValue={project.contactNo || ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
          />
        </Field>
        <Field label="Timesheet collection date">
          <input
            name="timesheetCollectionDate"
            type="date"
            defaultValue={project.timesheetCollectionDate}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
          />
        </Field>
        <Field label="No. of employees required">
          <input
            name="noOfEmployeesRequired"
            type="number"
            min={0}
            defaultValue={project.noOfEmployeesRequired ?? ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
          />
        </Field>
        <Field label="Day shift start">
          <input
            name="dayShiftStart"
            type="time"
            defaultValue={project.dayShiftStart || ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
          />
        </Field>
        <Field label="Day shift end">
          <input
            name="dayShiftEnd"
            type="time"
            defaultValue={project.dayShiftEnd || ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
          />
        </Field>
        <Field label="Night shift start">
          <input
            name="nightShiftStart"
            type="time"
            defaultValue={project.nightShiftStart || ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
          />
        </Field>
        <Field label="Night shift end">
          <input
            name="nightShiftEnd"
            type="time"
            defaultValue={project.nightShiftEnd || ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
          />
        </Field>
        <CheckboxField label="Inter transfer" name="interTransfer" defaultChecked={project.interTransfer} />
        <CheckboxField label="Closed LPO" name="closedLpo" defaultChecked={project.closedLpo} />
        <CheckboxField label="Internal use" name="internalUse" defaultChecked={project.internalUse} />
      </Section>

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
    <div className="pt-5">
      <Checkbox name={name} value="on" defaultChecked={defaultChecked} label={label} />
    </div>
  );
}
