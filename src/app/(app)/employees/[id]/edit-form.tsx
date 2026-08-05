"use client";

import { useState, useTransition } from "react";
import { updateEmployeeAction } from "./actions";
import { Select } from "@/components/ui/Select";
import { Checkbox } from "@/components/ui/Checkbox";
import { CountrySelect } from "@/components/ui/CountrySelect";

type Employee = {
  id: string;
  category: "STAFF" | "SITE_STAFF";
  sponsorshipCompanyId: string | null;
  nationality: string | null;
  position: string | null;
  passportNumber: string | null;
  emiratesId: string | null;
  visaExpiry: Date | null;
  laborCardExpiry: Date | null;
  medicalExpiry: Date | null;
  passportExpiry: Date | null;
  emiratesIdExpiry: Date | null;
  salaryType: string | null;
  salaryRate: number | null;
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
  wpsPaymentMode: string | null;
  wpsRoutingCode: string | null;
  wpsAccountHolderName: string | null;
  wpsAccountNumber: string | null;
  active: boolean;
  inactiveReason: string | null;
  lastDemobilizedDate: Date | null;
  religion: string | null;
  state: string | null;
  accommodationType: string | null;
  previousId: string | null;
  nameInIdCard: string | null;

  visaNumber: string | null;
  visaType: string | null;
  visaStatus: string | null;
  visaDesignation: string | null;
  visaStampingDate: Date | null;
  molPersonCode: string | null;

  passportStatus: string | null;
  passportReleaseDate: Date | null;
  passportReturnDate: Date | null;

  laborCardPersonalNo: string | null;
  laborCardStatus: string | null;

  cicpaNumber: string | null;
  cicpaIssueDate: Date | null;
  cicpaExpiry: Date | null;
  cicpaStatus: string | null;
  cicpaLocation: string | null;

  insuranceCardType: string | null;
  insuranceCardNumber: string | null;
  insuranceIssueDate: Date | null;
  insuranceExpiry: Date | null;
  insuranceStatus: string | null;
  insuranceServiceProvider: string | null;

  drivingLicenceNumber: string | null;
  drivingLicenceIssueDate: Date | null;
  drivingLicenceExpiry: Date | null;
  drivingLicenceType: string | null;
  drivingLicenceStatus: string | null;

  medicalStatus: string | null;
  eidStatus: string | null;
};

type Project = { id: string; name: string; code: string };
type Vehicle = { id: string; plateNumber: string; type: string | null };
type SponsorshipCompany = { id: string; name: string };

const INACTIVE_REASONS = [
  { value: "BlackList", label: "BlackList" },
  { value: "Returned to Supplier", label: "Returned to Supplier" },
  { value: "Site Accident", label: "Site Accident" },
  { value: "Hospital", label: "Hospital" },
  { value: "Vacation", label: "Vacation" },
  { value: "Cancelled", label: "Cancelled" },
  { value: "Other", label: "Other" },
];

function toDateInput(d: Date | null) {
  if (!d) return "";
  return new Date(d).toISOString().slice(0, 10);
}

export function EditForm({
  employee,
  projects,
  vehicles,
  sponsorshipCompanies,
}: {
  employee: Employee;
  projects: Project[];
  vehicles: Vehicle[];
  sponsorshipCompanies: SponsorshipCompany[];
}) {
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [active, setActive] = useState(employee.active);
  const [salaryType, setSalaryType] = useState(employee.salaryType || "");
  const knownReason = INACTIVE_REASONS.some((r) => r.value === employee.inactiveReason);
  const [inactiveReasonPreset, setInactiveReasonPreset] = useState(
    employee.inactiveReason && !knownReason ? "Other" : employee.inactiveReason || ""
  );

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
        <div className="grid grid-cols-1 gap-4 rounded-3xl border border-slate-200 bg-white p-5 sm:grid-cols-2">
          <Field label="Category">
            <Select
              name="category"
              defaultValue={employee.category}
              searchable={false}
              options={[
                { value: "SITE_STAFF", label: "Site Staff" },
                { value: "STAFF", label: "Staff" },
              ]}
            />
          </Field>
          <Checkbox
            name="active"
            value="on"
            checked={active}
            onCheckedChange={setActive}
            label="Active"
          />
          {!active && (
            <>
              <Field label="Reason">
                <Select
                  name="inactiveReasonPreset"
                  value={inactiveReasonPreset}
                  onChange={setInactiveReasonPreset}
                  placeholder="Not set"
                  searchable={false}
                  options={INACTIVE_REASONS}
                />
              </Field>
              {inactiveReasonPreset === "Other" && (
                <Field label="Reason (custom)">
                  <input
                    name="inactiveReasonCustom"
                    defaultValue={!knownReason ? employee.inactiveReason || "" : ""}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
                  />
                </Field>
              )}
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
        <div className="grid grid-cols-1 gap-4 rounded-3xl border border-slate-200 bg-white p-5 sm:grid-cols-2">
          <Field label="Nationality">
            <CountrySelect name="nationality" defaultValue={employee.nationality || ""} />
          </Field>
          <Field label="Sponsorship company">
            <Select
              name="sponsorshipCompanyId"
              defaultValue={employee.sponsorshipCompanyId || ""}
              placeholder="Not set"
              options={sponsorshipCompanies.map((s) => ({ value: s.id, label: s.name }))}
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
            <Select
              name="gender"
              defaultValue={employee.gender || ""}
              placeholder="Not set"
              searchable={false}
              options={[
                { value: "MALE", label: "Male" },
                { value: "FEMALE", label: "Female" },
              ]}
            />
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
        <div className="grid grid-cols-1 gap-4 rounded-3xl border border-slate-200 bg-white p-5 sm:grid-cols-2">
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
          <TextField label="Payment mode" name="wpsPaymentMode" defaultValue={employee.wpsPaymentMode} />
          <TextField label="Bank routing code" name="wpsRoutingCode" defaultValue={employee.wpsRoutingCode} />
          <TextField label="Account holder name" name="wpsAccountHolderName" defaultValue={employee.wpsAccountHolderName} />
          <TextField label="Account number" name="wpsAccountNumber" defaultValue={employee.wpsAccountNumber} />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-900">
          Compliance & documents
        </h2>
        <div className="grid grid-cols-1 gap-4 rounded-3xl border border-slate-200 bg-white p-5 sm:grid-cols-2">
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
          <TextField label="Medical status" name="medicalStatus" defaultValue={employee.medicalStatus} />
          <Field label="Passport expiry date">
            <input
              type="date"
              name="passportExpiry"
              defaultValue={toDateInput(employee.passportExpiry)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            />
          </Field>
          <Field label="Emirates ID expiry date">
            <input
              type="date"
              name="emiratesIdExpiry"
              defaultValue={toDateInput(employee.emiratesIdExpiry)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            />
          </Field>
          <TextField label="Emirates ID status" name="eidStatus" defaultValue={employee.eidStatus} />
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
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Visa</h2>
        <div className="grid grid-cols-1 gap-4 rounded-3xl border border-slate-200 bg-white p-5 sm:grid-cols-2">
          <TextField label="Visa number" name="visaNumber" defaultValue={employee.visaNumber} />
          <TextField label="Visa type" name="visaType" defaultValue={employee.visaType} />
          <TextField label="Visa status" name="visaStatus" defaultValue={employee.visaStatus} />
          <TextField label="Visa designation" name="visaDesignation" defaultValue={employee.visaDesignation} />
          <DateField label="First visa stamping date" name="visaStampingDate" defaultValue={employee.visaStampingDate} />
          <TextField label="MOL person code" name="molPersonCode" defaultValue={employee.molPersonCode} />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Passport</h2>
        <div className="grid grid-cols-1 gap-4 rounded-3xl border border-slate-200 bg-white p-5 sm:grid-cols-2">
          <TextField label="Passport status" name="passportStatus" defaultValue={employee.passportStatus} />
          <div />
          <DateField label="Release date" name="passportReleaseDate" defaultValue={employee.passportReleaseDate} />
          <DateField label="Return date" name="passportReturnDate" defaultValue={employee.passportReturnDate} />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Labour Card</h2>
        <div className="grid grid-cols-1 gap-4 rounded-3xl border border-slate-200 bg-white p-5 sm:grid-cols-2">
          <TextField label="Personal No" name="laborCardPersonalNo" defaultValue={employee.laborCardPersonalNo} />
          <TextField label="Labour card status" name="laborCardStatus" defaultValue={employee.laborCardStatus} />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-900">
          CICPA <span className="font-normal text-slate-400">(Abu Dhabi critical-infrastructure clearance)</span>
        </h2>
        <div className="grid grid-cols-1 gap-4 rounded-3xl border border-slate-200 bg-white p-5 sm:grid-cols-2">
          <TextField label="CICPA number" name="cicpaNumber" defaultValue={employee.cicpaNumber} />
          <TextField label="CICPA status" name="cicpaStatus" defaultValue={employee.cicpaStatus} />
          <DateField label="Issue date" name="cicpaIssueDate" defaultValue={employee.cicpaIssueDate} />
          <DateField label="Expiry date" name="cicpaExpiry" defaultValue={employee.cicpaExpiry} />
          <TextField label="Location" name="cicpaLocation" defaultValue={employee.cicpaLocation} />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Insurance</h2>
        <div className="grid grid-cols-1 gap-4 rounded-3xl border border-slate-200 bg-white p-5 sm:grid-cols-2">
          <TextField label="Card type" name="insuranceCardType" defaultValue={employee.insuranceCardType} />
          <TextField label="Card number" name="insuranceCardNumber" defaultValue={employee.insuranceCardNumber} />
          <DateField label="Issue date" name="insuranceIssueDate" defaultValue={employee.insuranceIssueDate} />
          <DateField label="Expiry date" name="insuranceExpiry" defaultValue={employee.insuranceExpiry} />
          <TextField label="Status" name="insuranceStatus" defaultValue={employee.insuranceStatus} />
          <TextField label="Service provider" name="insuranceServiceProvider" defaultValue={employee.insuranceServiceProvider} />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Driving Licence</h2>
        <div className="grid grid-cols-1 gap-4 rounded-3xl border border-slate-200 bg-white p-5 sm:grid-cols-2">
          <TextField label="Licence number" name="drivingLicenceNumber" defaultValue={employee.drivingLicenceNumber} />
          <TextField label="Licence type" name="drivingLicenceType" defaultValue={employee.drivingLicenceType} />
          <DateField label="Issue date" name="drivingLicenceIssueDate" defaultValue={employee.drivingLicenceIssueDate} />
          <DateField label="Expiry date" name="drivingLicenceExpiry" defaultValue={employee.drivingLicenceExpiry} />
          <TextField label="Status" name="drivingLicenceStatus" defaultValue={employee.drivingLicenceStatus} />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-900">
          Project & salary
        </h2>
        <div className="grid grid-cols-1 gap-4 rounded-3xl border border-slate-200 bg-white p-5 sm:grid-cols-2">
          <Field label="Project assignment">
            <Select
              name="projectId"
              defaultValue={employee.projectId || ""}
              placeholder="No project assigned"
              options={projects.map((p) => ({ value: p.id, label: `${p.code} — ${p.name}` }))}
            />
          </Field>
          <Field label="Vehicle assignment">
            <Select
              name="vehicleId"
              defaultValue={employee.vehicleId || ""}
              placeholder="No vehicle assigned"
              options={vehicles.map((v) => ({
                value: v.id,
                label: `${v.plateNumber}${v.type ? ` (${v.type})` : ""}`,
              }))}
            />
          </Field>
          <Field label="Salary type (reference only)">
            <Select
              name="salaryType"
              value={salaryType}
              onChange={setSalaryType}
              placeholder="Not set"
              searchable={false}
              options={[
                { value: "BASIC", label: "Basic Salary" },
                { value: "HOURLY", label: "Hourly Rate" },
              ]}
            />
          </Field>
          {salaryType && (
            <Field label={salaryType === "HOURLY" ? "Hourly rate (AED, reference only)" : "Basic salary (AED, reference only)"}>
              <input
                type="number"
                step="0.01"
                name="salaryRate"
                defaultValue={employee.salaryRate ?? ""}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
              />
            </Field>
          )}
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-[#166534] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#166534]/90 disabled:opacity-60"
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

const INPUT_CLASS =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900";

// Thin wrappers around Field for the many single-line text/date inputs
// added in the legal-document sections below, to avoid repeating the same
// input className on ~35 fields.
function TextField({
  label,
  name,
  defaultValue,
}: {
  label: string;
  name: string;
  defaultValue: string | null;
}) {
  return (
    <Field label={label}>
      <input name={name} defaultValue={defaultValue || ""} className={INPUT_CLASS} />
    </Field>
  );
}

function DateField({
  label,
  name,
  defaultValue,
}: {
  label: string;
  name: string;
  defaultValue: Date | null;
}) {
  return (
    <Field label={label}>
      <input
        type="date"
        name={name}
        defaultValue={toDateInput(defaultValue)}
        className={INPUT_CLASS}
      />
    </Field>
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
