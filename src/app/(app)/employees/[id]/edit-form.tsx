"use client";

import { useRef, useState, useTransition } from "react";
import { updateEmployeeAction } from "./actions";
import { Select } from "@/components/ui/Select";
import { Checkbox } from "@/components/ui/Checkbox";
import { CountrySelect } from "@/components/ui/CountrySelect";
import { InlineDocumentUpload } from "./inline-document-upload";
import type { ExtractedDocumentFields } from "@/app/api/documents/extract/route";

type Doc = { id: string; type: string; filename: string; expiryDate: Date | null; uploadedAt: Date };

type Employee = {
  id: string;
  category: "STAFF" | "SITE_STAFF";
  supplierId: string | null;
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
  siteId: string | null;
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
type Site = { id: string; name: string; projectId: string };
type Vehicle = { id: string; plateNumber: string; type: string | null };
type SponsorshipCompany = { id: string; name: string };
type Supplier = { id: string; name: string };
type LookupsByCategory = Record<string, { value: string }[]>;

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "documents", label: "Documents" },
  { id: "payroll", label: "Payroll & WPS" },
  { id: "project", label: "Project & Salary" },
  { id: "records", label: "Skills & Records" },
];

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
  sites,
  vehicles,
  sponsorshipCompanies,
  suppliers,
  documents,
  lookups,
  recordsContent,
}: {
  employee: Employee;
  projects: Project[];
  sites: Site[];
  vehicles: Vehicle[];
  sponsorshipCompanies: SponsorshipCompany[];
  suppliers: Supplier[];
  documents: Doc[];
  lookups: LookupsByCategory;
  // Skills/Visa History/Labour Card History/Other Documents — each of
  // these owns its own <form>, so they can't live inside this component's
  // single <form> (nested forms are invalid HTML and silently break).
  // Rendered as a sibling, still switched by the same tab state.
  recordsContent: React.ReactNode;
}) {
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState("overview");
  const [active, setActive] = useState(employee.active);
  const [salaryType, setSalaryType] = useState(employee.salaryType || "");
  const [nationality, setNationality] = useState(employee.nationality || "");
  const [projectId, setProjectId] = useState(employee.projectId || "");
  const [siteId, setSiteId] = useState(employee.siteId || "");
  const knownReason = INACTIVE_REASONS.some((r) => r.value === employee.inactiveReason);
  const [inactiveReasonPreset, setInactiveReasonPreset] = useState(
    employee.inactiveReason && !knownReason ? "Other" : employee.inactiveReason || ""
  );
  const docsByType = (type: string) => documents.filter((d) => d.type === type);

  const dobRef = useRef<HTMLInputElement>(null);
  const passportNumberRef = useRef<HTMLInputElement>(null);
  const passportExpiryRef = useRef<HTMLInputElement>(null);
  const emiratesIdRef = useRef<HTMLInputElement>(null);
  const emiratesIdExpiryRef = useRef<HTMLInputElement>(null);
  const laborCardNumberRef = useRef<HTMLInputElement>(null);
  const laborCardPersonalNoRef = useRef<HTMLInputElement>(null);
  const laborCardExpiryRef = useRef<HTMLInputElement>(null);

  function applyExtractedFields(fields: ExtractedDocumentFields) {
    if (fields.dateOfBirth && dobRef.current) dobRef.current.value = fields.dateOfBirth;
    if (fields.nationality) setNationality(fields.nationality);
    if (fields.passportNumber && passportNumberRef.current) passportNumberRef.current.value = fields.passportNumber;
    if (fields.passportExpiry && passportExpiryRef.current) passportExpiryRef.current.value = fields.passportExpiry;
    if (fields.emiratesId && emiratesIdRef.current) emiratesIdRef.current.value = fields.emiratesId;
    if (fields.emiratesIdExpiry && emiratesIdExpiryRef.current) emiratesIdExpiryRef.current.value = fields.emiratesIdExpiry;
    if (fields.laborCardNumber && laborCardNumberRef.current) laborCardNumberRef.current.value = fields.laborCardNumber;
    if (fields.laborCardPersonalNo && laborCardPersonalNoRef.current) laborCardPersonalNoRef.current.value = fields.laborCardPersonalNo;
    if (fields.laborCardExpiry && laborCardExpiryRef.current) laborCardExpiryRef.current.value = fields.laborCardExpiry;
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-1 border-b border-default">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`border-b-2 px-3 py-2 text-sm font-medium transition ${
              tab === t.id
                ? "border-[var(--brand-primary)] text-[var(--brand-primary)]"
                : "border-transparent text-muted hover:text-primary"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <form
        action={(formData) => {
          setSaved(false);
          setError(null);
          startTransition(async () => {
            const result = await updateEmployeeAction(formData);
            if (result?.error) {
              setError(result.error);
            } else {
              setSaved(true);
            }
          });
        }}
      >
        <input type="hidden" name="employeeId" value={employee.id} />

      <div className={tab === "overview" ? "space-y-8" : "hidden"}>
        <section>
          <h2 className="mb-3 text-sm font-semibold text-primary">Status</h2>
          <div className="card grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
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
                      className="input w-full"
                    />
                  </Field>
                )}
                <Field label="Last demobilized date">
                  <input
                    name="lastDemobilizedDate"
                    type="date"
                    defaultValue={toDateInput(employee.lastDemobilizedDate)}
                    className="input w-full"
                  />
                </Field>
              </>
            )}
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold text-primary">
            Personal details
          </h2>
          <div className="card grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
            <Field label="Supplier">
              <Select
                name="supplierId"
                defaultValue={employee.supplierId || ""}
                placeholder="No supplier assigned"
                options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
              />
            </Field>
            <Field label="Nationality">
              <CountrySelect name="nationality" value={nationality} onChange={setNationality} />
            </Field>
            <Field label="Sponsorship company">
              <Select
                name="sponsorshipCompanyId"
                defaultValue={employee.sponsorshipCompanyId || ""}
                placeholder="Not set"
                options={sponsorshipCompanies.map((s) => ({ value: s.id, label: s.name }))}
              />
            </Field>
            <LookupField label="Position" name="position" defaultValue={employee.position} options={lookups.POSITION} />
            <Field label="Date of birth">
              <input
                ref={dobRef}
                type="date"
                name="dateOfBirth"
                defaultValue={toDateInput(employee.dateOfBirth)}
                className="input w-full"
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
            <LookupField label="Blood group" name="bloodGroup" defaultValue={employee.bloodGroup} options={lookups.BLOOD_GROUP} />
            <Field label="Mobile number">
              <input
                name="mobileNumber"
                defaultValue={employee.mobileNumber || ""}
                className="input w-full"
              />
            </Field>
            <Field label="WhatsApp number">
              <input
                name="whatsappNumber"
                defaultValue={employee.whatsappNumber || ""}
                className="input w-full"
              />
            </Field>
            <Field label="Join date">
              <input
                type="date"
                name="joinDate"
                defaultValue={toDateInput(employee.joinDate)}
                className="input w-full"
              />
            </Field>
            <Field label="Emergency contact name">
              <input
                name="emergencyContactName"
                defaultValue={employee.emergencyContactName || ""}
                className="input w-full"
              />
            </Field>
            <Field label="Emergency contact phone">
              <input
                name="emergencyContactPhone"
                defaultValue={employee.emergencyContactPhone || ""}
                className="input w-full"
              />
            </Field>
            <LookupField label="Religion" name="religion" defaultValue={employee.religion} options={lookups.RELIGION} />
            <LookupField label="State" name="state" defaultValue={employee.state} options={lookups.STATE} />
            <LookupField
              label="Accommodation type"
              name="accommodationType"
              defaultValue={employee.accommodationType}
              options={lookups.ACCOMMODATION_TYPE}
            />
            <Field label="Previous ID">
              <input
                name="previousId"
                defaultValue={employee.previousId || ""}
                className="input w-full"
              />
            </Field>
            <Field label="Name in ID card">
              <input
                name="nameInIdCard"
                defaultValue={employee.nameInIdCard || ""}
                className="input w-full"
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Additional notes">
                <textarea
                  name="notes"
                  defaultValue={employee.notes || ""}
                  rows={3}
                  className="input w-full"
                />
              </Field>
            </div>
          </div>
        </section>
      </div>

      <div className={tab === "documents" ? "space-y-8" : "hidden"}>
        <section>
          <h2 className="mb-3 text-sm font-semibold text-primary">Passport</h2>
          <div className="card grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
            <Field label="Passport number">
              <input
                ref={passportNumberRef}
                name="passportNumber"
                defaultValue={employee.passportNumber || ""}
                className="input w-full"
              />
            </Field>
            <LookupField label="Passport status" name="passportStatus" defaultValue={employee.passportStatus} options={lookups.PASSPORT_STATUS} />
            <Field label="Passport expiry date">
              <input
                ref={passportExpiryRef}
                type="date"
                name="passportExpiry"
                defaultValue={toDateInput(employee.passportExpiry)}
                className="input w-full"
              />
            </Field>
            <DateField label="Release date" name="passportReleaseDate" defaultValue={employee.passportReleaseDate} />
            <DateField label="Return date" name="passportReturnDate" defaultValue={employee.passportReturnDate} />
            <InlineDocumentUpload
              employeeId={employee.id}
              type="PASSPORT"
              documents={docsByType("PASSPORT")}
              expiryFieldName="passportExpiry"
              onExtracted={applyExtractedFields}
            />
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold text-primary">Emirates ID</h2>
          <div className="card grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
            <Field label="Emirates ID number">
              <input
                ref={emiratesIdRef}
                name="emiratesId"
                defaultValue={employee.emiratesId || ""}
                className="input w-full"
              />
            </Field>
            <Field label="Emirates ID expiry date">
              <input
                ref={emiratesIdExpiryRef}
                type="date"
                name="emiratesIdExpiry"
                defaultValue={toDateInput(employee.emiratesIdExpiry)}
                className="input w-full"
              />
            </Field>
            <LookupField label="Emirates ID status" name="eidStatus" defaultValue={employee.eidStatus} options={lookups.EID_STATUS} />
            <div />
            <InlineDocumentUpload
              employeeId={employee.id}
              type="EMIRATES_ID"
              documents={docsByType("EMIRATES_ID")}
              expiryFieldName="emiratesIdExpiry"
              onExtracted={applyExtractedFields}
            />
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold text-primary">Labour Card</h2>
          <div className="card grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
            <Field label="Labor card number">
              <input
                ref={laborCardNumberRef}
                name="laborCardNumber"
                defaultValue={employee.laborCardNumber || ""}
                className="input w-full"
              />
            </Field>
            <Field label="Personal No">
              <input
                ref={laborCardPersonalNoRef}
                name="laborCardPersonalNo"
                defaultValue={employee.laborCardPersonalNo || ""}
                className="input w-full"
              />
            </Field>
            <LookupField label="Labour card status" name="laborCardStatus" defaultValue={employee.laborCardStatus} options={lookups.LABOR_CARD_STATUS} />
            <Field label="Labor card expiry">
              <input
                ref={laborCardExpiryRef}
                type="date"
                name="laborCardExpiry"
                defaultValue={toDateInput(employee.laborCardExpiry)}
                className="input w-full"
              />
            </Field>
            <InlineDocumentUpload
              employeeId={employee.id}
              type="LABOR_CARD"
              documents={docsByType("LABOR_CARD")}
              expiryFieldName="laborCardExpiry"
              onExtracted={applyExtractedFields}
            />
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold text-primary">Visa</h2>
          <div className="card grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
            <TextField label="Visa number" name="visaNumber" defaultValue={employee.visaNumber} />
            <LookupField label="Visa type" name="visaType" defaultValue={employee.visaType} options={lookups.VISA_TYPE} />
            <LookupField label="Visa status" name="visaStatus" defaultValue={employee.visaStatus} options={lookups.VISA_STATUS} />
            <TextField label="Visa designation" name="visaDesignation" defaultValue={employee.visaDesignation} />
            <DateField label="First visa stamping date" name="visaStampingDate" defaultValue={employee.visaStampingDate} />
            <TextField label="MOL person code" name="molPersonCode" defaultValue={employee.molPersonCode} />
            <DateField label="Visa expiry date" name="visaExpiry" defaultValue={employee.visaExpiry} />
            <div />
            <InlineDocumentUpload
              employeeId={employee.id}
              type="VISA"
              documents={docsByType("VISA")}
              expiryFieldName="visaExpiry"
            />
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold text-primary">Medical Certificate</h2>
          <div className="card grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
            <Field label="Medical certificate expiry">
              <input
                type="date"
                name="medicalExpiry"
                defaultValue={toDateInput(employee.medicalExpiry)}
                className="input w-full"
              />
            </Field>
            <LookupField label="Medical status" name="medicalStatus" defaultValue={employee.medicalStatus} options={lookups.MEDICAL_STATUS} />
            <InlineDocumentUpload
              employeeId={employee.id}
              type="MEDICAL"
              documents={docsByType("MEDICAL")}
              expiryFieldName="medicalExpiry"
            />
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold text-primary">
            CICPA <span className="font-normal text-subtle">(Abu Dhabi critical-infrastructure clearance)</span>
          </h2>
          <div className="card grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
            <TextField label="CICPA number" name="cicpaNumber" defaultValue={employee.cicpaNumber} />
            <LookupField label="CICPA status" name="cicpaStatus" defaultValue={employee.cicpaStatus} options={lookups.CICPA_STATUS} />
            <DateField label="Issue date" name="cicpaIssueDate" defaultValue={employee.cicpaIssueDate} />
            <DateField label="Expiry date" name="cicpaExpiry" defaultValue={employee.cicpaExpiry} />
            <TextField label="Location" name="cicpaLocation" defaultValue={employee.cicpaLocation} />
            <InlineDocumentUpload
              employeeId={employee.id}
              type="CICPA"
              documents={docsByType("CICPA")}
              expiryFieldName="cicpaExpiry"
            />
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold text-primary">Insurance</h2>
          <div className="card grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
            <LookupField label="Card type" name="insuranceCardType" defaultValue={employee.insuranceCardType} options={lookups.INSURANCE_CARD_TYPE} />
            <TextField label="Card number" name="insuranceCardNumber" defaultValue={employee.insuranceCardNumber} />
            <DateField label="Issue date" name="insuranceIssueDate" defaultValue={employee.insuranceIssueDate} />
            <DateField label="Expiry date" name="insuranceExpiry" defaultValue={employee.insuranceExpiry} />
            <LookupField label="Status" name="insuranceStatus" defaultValue={employee.insuranceStatus} options={lookups.INSURANCE_STATUS} />
            <TextField label="Service provider" name="insuranceServiceProvider" defaultValue={employee.insuranceServiceProvider} />
            <InlineDocumentUpload
              employeeId={employee.id}
              type="INSURANCE"
              documents={docsByType("INSURANCE")}
              expiryFieldName="insuranceExpiry"
            />
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold text-primary">Driving Licence</h2>
          <div className="card grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
            <TextField label="Licence number" name="drivingLicenceNumber" defaultValue={employee.drivingLicenceNumber} />
            <LookupField label="Licence type" name="drivingLicenceType" defaultValue={employee.drivingLicenceType} options={lookups.DRIVING_LICENCE_TYPE} />
            <DateField label="Issue date" name="drivingLicenceIssueDate" defaultValue={employee.drivingLicenceIssueDate} />
            <DateField label="Expiry date" name="drivingLicenceExpiry" defaultValue={employee.drivingLicenceExpiry} />
            <LookupField label="Status" name="drivingLicenceStatus" defaultValue={employee.drivingLicenceStatus} options={lookups.DRIVING_LICENCE_STATUS} />
            <InlineDocumentUpload
              employeeId={employee.id}
              type="DRIVING_LICENCE"
              documents={docsByType("DRIVING_LICENCE")}
              expiryFieldName="drivingLicenceExpiry"
            />
          </div>
        </section>
      </div>

      <div className={tab === "payroll" ? "space-y-8" : "hidden"}>
        <section>
          <h2 className="mb-3 text-sm font-semibold text-primary">
            Payroll & WPS
          </h2>
          <div className="card grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
            <Field label="WPS bank / exchange house name">
              <input
                name="wpsBankName"
                defaultValue={employee.wpsBankName || ""}
                className="input w-full"
              />
            </Field>
            <Field label="WPS IBAN">
              <input
                name="wpsIban"
                defaultValue={employee.wpsIban || ""}
                className="input w-full"
              />
            </Field>
            <TextField label="Payment mode" name="wpsPaymentMode" defaultValue={employee.wpsPaymentMode} />
            <TextField label="Bank routing code" name="wpsRoutingCode" defaultValue={employee.wpsRoutingCode} />
            <TextField label="Account holder name" name="wpsAccountHolderName" defaultValue={employee.wpsAccountHolderName} />
            <TextField label="Account number" name="wpsAccountNumber" defaultValue={employee.wpsAccountNumber} />
          </div>
        </section>
      </div>

      <div className={tab === "project" ? "space-y-8" : "hidden"}>
        <section>
          <h2 className="mb-3 text-sm font-semibold text-primary">
            Project & salary
          </h2>
          <div className="card grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
            <Field label="Project assignment">
              <Select
                name="projectId"
                value={projectId}
                onChange={(v) => {
                  setProjectId(v);
                  setSiteId("");
                }}
                placeholder="No project assigned"
                options={projects.map((p) => ({ value: p.id, label: `${p.code} — ${p.name}` }))}
              />
            </Field>
            <Field label="Site assignment">
              <Select
                name="siteId"
                value={siteId}
                onChange={setSiteId}
                disabled={!projectId}
                placeholder={projectId ? "No site assigned" : "Select a project first"}
                options={sites
                  .filter((s) => s.projectId === projectId)
                  .map((s) => ({ value: s.id, label: s.name }))}
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
                  className="input w-full"
                />
              </Field>
            )}
          </div>
        </section>
      </div>

      {tab !== "records" && (
        <div className="mt-8 flex items-center gap-3">
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
          {error && !pending && (
            <span className="text-sm text-red-600">{error}</span>
          )}
        </div>
      )}
      </form>

      <div className={tab === "records" ? "space-y-8" : "hidden"}>
        {recordsContent}
      </div>
    </div>
  );
}

const INPUT_CLASS =
  "w-full rounded-lg border border-strong px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]";

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

// Admin-configurable dropdown (Lookups page) instead of free text — falls
// back to showing the employee's existing raw value even if it isn't in the
// current lookup list, so older/unmigrated data never gets silently blanked.
function LookupField({
  label,
  name,
  defaultValue,
  options,
}: {
  label: string;
  name: string;
  defaultValue: string | null;
  options: { value: string }[];
}) {
  return (
    <Field label={label}>
      <Select
        name={name}
        defaultValue={defaultValue || ""}
        placeholder="Not set"
        options={options.map((o) => ({ value: o.value, label: o.value }))}
      />
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
      <span className="mb-1 block text-xs font-medium text-muted">
        {label}
      </span>
      {children}
    </label>
  );
}
