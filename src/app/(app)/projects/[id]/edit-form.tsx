"use client";

import { useState, useTransition } from "react";
import { updateProjectAction } from "../actions";
import { Select } from "@/components/ui/Select";
import { PersonField } from "@/components/form/PersonField";
import { Checkbox } from "@/components/ui/Checkbox";
import { ComboSelect } from "@/components/ui/ComboSelect";
import { PAYMENT_TYPES } from "@/lib/formLists";
import { JOB_TYPES } from "@/lib/formLists";
import { PhoneField } from "@/components/ui/PhoneField";
import { DatePicker } from "@/components/ui/DatePicker";
import { NumberInput } from "@/components/ui/NumberInput";

type Project = {
  id: string;
  name: string;
  clientId: string;
  manager: string | null;
  managerPhone: string | null;
  managerEmail: string | null;
  projectCoordinator: string | null;
  projectCoordinatorPhone: string | null;
  projectCoordinatorEmail: string | null;
  timelineStart: string;
  timelineEnd: string;
  status: string;
  clientProjectNo: string | null;
  jobType: string | null;
  mainContractor: string | null;
  paymentType: string | null;
  sponsorshipCompany: string | null;
  salesExecutive: string | null;
  salesExecutivePhone: string | null;
  salesExecutiveEmail: string | null;
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
  sponsors,
}: {
  project: Project;
  clients: { id: string; name: string }[];
  /** Names of the group's own companies, offered as the visa sponsor. */
  sponsors: string[];
}) {
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      action={(formData) => {
        setSaved(false);
        setError(null);
        startTransition(async () => {
          const res = await updateProjectAction(formData);
          if (res?.error) setError(res.error);
          else setSaved(true);
        });
      }}
      className="card space-y-6 p-6"
    >
      <input type="hidden" name="projectId" value={project.id} />

      <Section title="Basic Detail">
        <Field required label="Project name">
          <input
            name="name"
            required
            defaultValue={project.name}
            className="input w-full"
          />
        </Field>
        <Field label="Client project no.">
          <input
            name="clientProjectNo"
            defaultValue={project.clientProjectNo || ""}
            className="input w-full"
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
          <ComboSelect name="jobType" options={JOB_TYPES} defaultValue={project.jobType} />
        </Field>
        <Field label="Main contractor">
          <input
            name="mainContractor"
            defaultValue={project.mainContractor || ""}
            className="input w-full"
          />
        </Field>
        <Field label="Payment type">
          <ComboSelect name="paymentType" options={PAYMENT_TYPES} defaultValue={project.paymentType} />
        </Field>
        <Field label="Client">
          <Select
            name="clientId"
            defaultValue={project.clientId}
            options={clients.map((c) => ({ value: c.id, label: c.name }))}
          />
        </Field>
        <Field label="Sponsorship company">
          <ComboSelect name="sponsorshipCompany" options={sponsors} defaultValue={project.sponsorshipCompany} />
        </Field>
        <PersonField name="salesExecutive" label="Sales executive" defaultName={project.salesExecutive} defaultPhone={project.salesExecutivePhone} defaultEmail={project.salesExecutiveEmail} />
        <PersonField name="projectCoordinator" label="Project coordinator" defaultName={project.projectCoordinator} defaultPhone={project.projectCoordinatorPhone} defaultEmail={project.projectCoordinatorEmail} />
        <PersonField name="manager" label="Project manager" defaultName={project.manager} defaultPhone={project.managerPhone} defaultEmail={project.managerEmail} />
        <Field label="Start date">
          <DatePicker name="timelineStart" defaultValue={project.timelineStart} className="w-full" />
        </Field>
        <Field label="End date">
          <DatePicker name="timelineEnd" defaultValue={project.timelineEnd} className="w-full" />
        </Field>
        <Field label="Contact no.">
          <PhoneField name="contactNo" defaultValue={project.contactNo} />
        </Field>
        <Field label="Timesheet collection date">
          <DatePicker name="timesheetCollectionDate" defaultValue={project.timesheetCollectionDate} className="w-full" />
        </Field>
        <Field label="No. of employees required">
          <NumberInput name="noOfEmployeesRequired" defaultValue={project.noOfEmployeesRequired ?? ""} min={0} className="w-full" />
        </Field>
        <Field label="Day shift start">
          <input
            name="dayShiftStart"
            type="time"
            defaultValue={project.dayShiftStart || ""}
            className="input w-full"
          />
        </Field>
        <Field label="Day shift end">
          <input
            name="dayShiftEnd"
            type="time"
            defaultValue={project.dayShiftEnd || ""}
            className="input w-full"
          />
        </Field>
        <Field label="Night shift start">
          <input
            name="nightShiftStart"
            type="time"
            defaultValue={project.nightShiftStart || ""}
            className="input w-full"
          />
        </Field>
        <Field label="Night shift end">
          <input
            name="nightShiftEnd"
            type="time"
            defaultValue={project.nightShiftEnd || ""}
            className="input w-full"
          />
        </Field>
        <CheckboxField label="Inter transfer" name="interTransfer" defaultChecked={project.interTransfer} />
        <CheckboxField label="Internal use" name="internalUse" defaultChecked={project.internalUse} />
      </Section>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="btn btn-primary"
        >
          {pending ? "Saving…" : "Save changes"}
        </button>
        {error && <span className="text-sm text-[var(--error)]">{error}</span>}
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
      <h3 className="mb-3 text-xs font-semibold tracking-wide text-subtle uppercase">
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
  required,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
  required?: boolean;
}) {
  return (
    <label className={`block ${className || ""}`}>
      <span className="mb-1 block text-xs font-medium text-muted">
        {label}
        {required && <span className="text-[var(--error)]"> *</span>}
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
