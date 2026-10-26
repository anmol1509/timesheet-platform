"use client";

import { primaryOptions, rootOf, sponsorFits, sponsorOptions } from "@/lib/supplierOptions";
import { PhoneField } from "@/components/ui/PhoneField";
import { useEffect, useRef, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { SaveWarnings } from "@/components/SaveWarnings";
import { m } from "motion/react";
import { SPRING } from "@/lib/motion";
import { updateEmployeeAction } from "./actions";
import { Select } from "@/components/ui/Select";
import { Checkbox } from "@/components/ui/Checkbox";
import { CountrySelect } from "@/components/ui/CountrySelect";
import { InlineDocumentUpload } from "./inline-document-upload";
import type { ExtractedDocumentFields } from "@/app/api/documents/extract/route";
import { PassportCheckNote } from "@/components/PassportCheckNote";
import type { PassportCheck } from "@/lib/passportMrz";
import { ComboSelect } from "@/components/ui/ComboSelect";
import { UAE_BANKS } from "@/lib/formLists";
import { DatePicker } from "@/components/ui/DatePicker";
import { NumberInput } from "@/components/ui/NumberInput";
import { MaskedInput } from "@/components/ui/MaskedInput";
import { Hint } from "@/components/Hint";
import type { GlossaryKey } from "@/lib/payrollGlossary";
import { MAX_OT_MULTIPLIER } from "@/lib/payFields";

type Doc = { id: string; type: string; filename: string; expiryDate: Date | null; uploadedAt: Date };

type Employee = {
  id: string;
  name: string;
  employeeIdNo: string;
  sponsorName: string | null;
  unifiedNo: string | null;
  category: "STAFF" | "SITE_STAFF";
  supplierId: string | null;
  sponsorSupplierId: string | null;
  nationality: string | null;
  position: string | null;
  department: string | null;
  passportNumber: string | null;
  emiratesId: string | null;
  visaExpiry: Date | null;
  laborCardExpiry: Date | null;
  medicalExpiry: Date | null;
  passportExpiry: Date | null;
  emiratesIdExpiry: Date | null;
  salaryType: string | null;
  salaryRate: number | null;
  payStructure: string | null;
  paysOvertime: boolean;
  gasWaived: boolean;
  payOverride: boolean;
  trade: string | null;
  essEnabled: boolean;
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
  exitDate: Date | null;
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
  c3Id: string | null;

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

type Supplier = { id: string; name: string; parentSupplierId?: string | null };
type LookupsByCategory = Record<string, { value: string }[]>;

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "documents", label: "Documents" },
  { id: "trade", label: "Trade & pay" },
  { id: "payroll", label: "Payroll & WPS" },
  { id: "project", label: "Project & Site" },
  { id: "timesheet", label: "Timesheet" },
  { id: "records", label: "Notes" },
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

export type PayFormValues = {
  canEdit: boolean;
  basicSalary: string;
  housingAllowance: string;
  foodAllowance: string;
  transportAllowance: string;
  otherAllowance: string;
  flatMonthlyRate: string;
  hourlyRate: string;
  otMultiplier: string;
  dailyHours: string;
  leaveDaysPerYear: string;
  airTicketAmount: string;
  airTicketEveryMonths: string;
  skipGratuity: boolean;
};

function toDateInput(d: Date | null) {
  if (!d) return "";
  return new Date(d).toISOString().slice(0, 10);
}

export function EditForm({
  employee,
  projects,
  sites,
  vehicles,
  sponsors,
  suppliers,
  documents,
  lookups,
  recordsContent,
  timesheetContent,
  tradesContent,
  siteContent,
  documentsContent,
  pay,
}: {
  employee: Employee;
  /** Pay figures as strings; null when the viewer may not see pay. */
  pay: PayFormValues | null;
  projects: Project[];
  sites: Site[];
  vehicles: Vehicle[];
  sponsors: Supplier[];
  suppliers: Supplier[];
  documents: Doc[];
  lookups: LookupsByCategory;
  // Skills/Visa History/Labour Card History/Other Documents — each of
  // these owns its own <form>, so they can't live inside this component's
  // single <form> (nested forms are invalid HTML and silently break).
  // Rendered as a sibling, still switched by the same tab state.
  recordsContent: React.ReactNode;
  /** Read-only month view; null hides the tab (no access to timesheets). */
  timesheetContent: React.ReactNode;
  tradesContent: React.ReactNode;
  siteContent: React.ReactNode;
  documentsContent: React.ReactNode;
}) {
  const [supplierSel, setSupplierSel] = useState(employee.supplierId || "");
  const [sponsorSel, setSponsorSel] = useState(employee.sponsorSupplierId || "");
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [pendingProject, setPendingProject] = useState<string | null>(null);
  // ~100 fields sit in this form; leaving the page used to bin every edit
  // without a word.
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const [error, setError] = useState<string | null>(null);
  // Likely mistakes the server found on the last save; the form is kept so "Save anyway" can send it again unchanged.
  const [warnings, setWarnings] = useState<string[] | null>(null);
  const lastForm = useRef<FormData | null>(null);
  // ?tab=trade (or payroll, documents…) opens that tab, so the assistant's fix buttons land on the right field.
  const wanted = useSearchParams().get("tab");
  const [tabState, setTab] = useState(TABS.some((x) => x.id === wanted) ? wanted! : "overview");
  const [active, setActive] = useState(employee.active);
    const [payStructure, setPayStructure] = useState(employee.payStructure || "");
  const [category, setCategory] = useState(employee.category);
  const isStaff = category === "STAFF";
  const tab = isStaff && tabState === "project" ? "overview" : tabState;
  const [nationality, setNationality] = useState(employee.nationality || "");
  const [projectId, setProjectId] = useState(employee.projectId || "");
  const [siteId, setSiteId] = useState(employee.siteId || "");
  const knownReason = INACTIVE_REASONS.some((r) => r.value === employee.inactiveReason);
  const [inactiveReasonPreset, setInactiveReasonPreset] = useState(
    employee.inactiveReason && !knownReason ? "Other" : employee.inactiveReason || ""
  );
  const docsByType = (type: string) => documents.filter((d) => d.type === type);

  // Dates filled in from a scanned document remount their picker with the new value.
  const [auto, setAuto] = useState<Record<string, string>>({});
  // How far the last scanned passport can be trusted; cleared when the expiry is typed over.
  const [passportCheck, setPassportCheck] = useState<PassportCheck | null>(null);
  const passportNumberRef = useRef<HTMLInputElement>(null);
  const emiratesIdRef = useRef<HTMLInputElement>(null);
  const laborCardNumberRef = useRef<HTMLInputElement>(null);
  const laborCardPersonalNoRef = useRef<HTMLInputElement>(null);

  function applyExtractedFields(fields: ExtractedDocumentFields) {
    if (fields.passportCheck) setPassportCheck(fields.passportCheck);
    setAuto((a) => ({ ...a, ...(fields.dateOfBirth ? { dateOfBirth: fields.dateOfBirth } : {}), ...(fields.passportExpiry ? { passportExpiry: fields.passportExpiry } : {}), ...(fields.emiratesIdExpiry ? { emiratesIdExpiry: fields.emiratesIdExpiry } : {}), ...(fields.laborCardExpiry ? { laborCardExpiry: fields.laborCardExpiry } : {}) }));
    if (fields.nationality) setNationality(fields.nationality);
    if (fields.passportNumber && passportNumberRef.current) passportNumberRef.current.value = fields.passportNumber;
    if (fields.emiratesId && emiratesIdRef.current) emiratesIdRef.current.value = fields.emiratesId;
    if (fields.laborCardNumber && laborCardNumberRef.current) laborCardNumberRef.current.value = fields.laborCardNumber;
    if (fields.laborCardPersonalNo && laborCardPersonalNoRef.current) laborCardPersonalNoRef.current.value = fields.laborCardPersonalNo;
  }

  // Office staff are white-collar: no trade, project or site. Their position (designation + department)
  // sits on Overview, so those tabs go and "Trade & pay" becomes just "Pay".
  const visibleTabs = timesheetContent ? TABS : TABS.filter((t) => t.id !== "timesheet");
  const tabs = isStaff ? visibleTabs.filter((t) => t.id !== "project").map((t) => (t.id === "trade" ? { ...t, label: "Pay" } : t)) : visibleTabs;

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-1 border-b border-default">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`relative px-3 py-2 text-sm font-medium transition-colors ${
              tab === t.id ? "text-[var(--brand-primary)]" : "text-muted hover:text-primary"
            }`}
          >
            {t.label}
            {tab === t.id && (
              <m.span
                layoutId="employee-edit-tabs-underline"
                transition={SPRING}
                className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-[var(--brand-primary)]"
                aria-hidden
              />
            )}
          </button>
        ))}
      </div>

      {/* Known trades come first on this tab; they own their own forms, so they sit above the main form, not in it. */}
      <div className={tab === "trade" && !isStaff ? "mb-8 space-y-8" : "hidden"}>{tradesContent}</div>

      <form
        onInput={() => {
          if (!dirty) setDirty(true);
          if (saved) setSaved(false);
        }}
        action={(formData) => {
          setSaved(false);
          setPendingProject(null);
          setError(null);
          setWarnings(null);
          lastForm.current = formData;
          startTransition(async () => {
            const result = await updateEmployeeAction(formData);
            if (result?.error) {
              setError(result.error);
              setDirty(true);
            } else if (result?.warnings?.length) {
              setWarnings(result.warnings);
              setDirty(true);
            } else {
              setDirty(false);
              setSaved(true);
              if (result?.pendingProject) {
                // The new project is held for approval, so the worker keeps the one they have until it is decided.
                setPendingProject(result.pendingProject);
                setProjectId(employee.projectId || "");
              }
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
                value={category}
                onChange={(v) => setCategory(v as "STAFF" | "SITE_STAFF")}
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
                <Field required label="Last working day">
                  <DatePicker name="exitDate" defaultValue={toDateInput(employee.exitDate)} className="w-full" />
                  <span className="mt-1 block text-xs text-muted">Payroll pays up to this day, then final settlement picks up the rest.</span>
                </Field>
                <Field label="Last demobilized date">
                  <DatePicker name="lastDemobilizedDate" defaultValue={toDateInput(employee.lastDemobilizedDate)} className="w-full" />
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
            {/* Both were set once at registration and then unchangeable, so a
                mistyped name or ID could only be fixed in the database. */}
            <Field required label="Full name">
              <input
                name="name"
                defaultValue={employee.name}
                required
                className="input w-full"
              />
            </Field>
            <Field required label="Employee ID No">
              <input
                name="employeeIdNo"
                defaultValue={employee.employeeIdNo}
                required
                className="input tabular w-full"
              />
            </Field>
            <Field label="Supplier">
              <Select
                name="supplierId"
                value={supplierSel}
                onChange={(v) => { setSupplierSel(v); if (!sponsorFits(sponsors, v, sponsorSel)) setSponsorSel(""); }}
                placeholder="No supplier assigned"
                options={primaryOptions(suppliers, employee.supplierId).map((s) => ({ value: s.id, label: s.name }))}
              />
            </Field>
            <Field label="Nationality">
              <CountrySelect name="nationality" value={nationality} onChange={setNationality} />
            </Field>
            <Field label="Visa sponsor">
              <Select
                name="sponsorSupplierId"
                value={sponsorSel}
                // Picking the sponsor first fills in the supplier (the primary company it belongs under), so it isn't chosen twice.
                onChange={(v) => { setSponsorSel(v); if (v && !supplierSel) setSupplierSel(rootOf(sponsors, v)); }}
                placeholder="Not set"
                options={sponsorOptions(sponsors, supplierSel, employee.sponsorSupplierId).map((s) => ({ value: s.id, label: s.name }))}
              />
            </Field>
            {category === "STAFF" && (
              <>
                <p className="-mb-2 text-xs font-semibold uppercase tracking-wide text-muted sm:col-span-2">Position</p>
                <Field label="Designation">
                  <input name="position" defaultValue={employee.position || ""} maxLength={80} placeholder="e.g. Accountant" className="input w-full" />
                </Field>
                <Field label="Department">
                  <input name="department" defaultValue={employee.department || ""} maxLength={80} placeholder="e.g. Finance" className="input w-full" />
                </Field>
              </>
            )}
            <Field label="Date of birth">
              <DatePicker key={`dateOfBirth-${auto.dateOfBirth ?? ""}`} name="dateOfBirth" defaultValue={auto.dateOfBirth ?? toDateInput(employee.dateOfBirth)} />
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
            <LookupField
              label="Blood group"
              name="bloodGroup"
              defaultValue={employee.bloodGroup}
              options={[...new Set([...["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"], ...(employee.bloodGroup ? [employee.bloodGroup] : [])])].map((value) => ({ value }))}
            />
            <Field label="Mobile number">
              <PhoneField name="mobileNumber" defaultValue={employee.mobileNumber} />
            </Field>
            <Field label="WhatsApp number">
              <PhoneField name="whatsappNumber" defaultValue={employee.whatsappNumber} />
            </Field>
            <label className="flex items-start gap-2 text-sm text-secondary sm:col-span-2">
              <input type="checkbox" name="essEnabled" defaultChecked={employee.essEnabled} className="mt-0.5" />
              <span>
                Allow this employee to sign in to the self-service portal
                <span className="block text-xs text-muted">They sign in at /me/login with a code sent to the mobile or WhatsApp number above. Make sure it is correct and belongs only to them.</span>
              </span>
            </label>
            <Field label="Join date">
              <DatePicker name="joinDate" defaultValue={toDateInput(employee.joinDate)} className="w-full" />
            </Field>
            <Field label="Emergency contact name">
              <input
                name="emergencyContactName"
                defaultValue={employee.emergencyContactName || ""}
                className="input w-full"
              />
            </Field>
            <Field label="Emergency contact phone">
              <PhoneField name="emergencyContactPhone" defaultValue={employee.emergencyContactPhone} />
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
              <MaskedInput kind="passport"
                ref={passportNumberRef}
                name="passportNumber"
                defaultValue={employee.passportNumber || ""}
                className="input w-full"
              />
            </Field>
            <Field label="Passport expiry date">
              <DatePicker key={`passportExpiry-${auto.passportExpiry ?? ""}`} name="passportExpiry" defaultValue={auto.passportExpiry ?? toDateInput(employee.passportExpiry)} onChange={() => setPassportCheck(null)} />
              <PassportCheckNote check={passportCheck} hasExpiry={!!auto.passportExpiry} />
            </Field>
            <InlineDocumentUpload
              employeeId={employee.id}
              employeeName={employee.name}
              employeeDob={employee.dateOfBirth ? toDateInput(employee.dateOfBirth) : null}
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
              <MaskedInput kind="eid"
                ref={emiratesIdRef}
                name="emiratesId"
                defaultValue={employee.emiratesId || ""}
                className="input w-full"
              />
            </Field>
            <Field label="Emirates ID expiry date">
              <DatePicker key={`emiratesIdExpiry-${auto.emiratesIdExpiry ?? ""}`} name="emiratesIdExpiry" defaultValue={auto.emiratesIdExpiry ?? toDateInput(employee.emiratesIdExpiry)} />
            </Field>
            <div />
            <InlineDocumentUpload
              employeeId={employee.id}
              employeeName={employee.name}
              employeeDob={employee.dateOfBirth ? toDateInput(employee.dateOfBirth) : null}
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
            <Field label="Labor card expiry">
              <DatePicker key={`laborCardExpiry-${auto.laborCardExpiry ?? ""}`} name="laborCardExpiry" defaultValue={auto.laborCardExpiry ?? toDateInput(employee.laborCardExpiry)} />
            </Field>
            <InlineDocumentUpload
              employeeId={employee.id}
              employeeName={employee.name}
              employeeDob={employee.dateOfBirth ? toDateInput(employee.dateOfBirth) : null}
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
            <TextField label="Unified No" name="unifiedNo" defaultValue={employee.unifiedNo} />
            <LookupField label="Visa status" name="visaStatus" defaultValue={employee.visaStatus} options={lookups.VISA_STATUS} />
            <TextField label="MOL person code" name="molPersonCode" defaultValue={employee.molPersonCode} hint="MOL_PERSON_CODE" />
            <DateField label="Visa expiry date" name="visaExpiry" defaultValue={employee.visaExpiry} />
            <div />
            <InlineDocumentUpload
              employeeId={employee.id}
              employeeName={employee.name}
              employeeDob={employee.dateOfBirth ? toDateInput(employee.dateOfBirth) : null}
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
              <DatePicker name="medicalExpiry" defaultValue={toDateInput(employee.medicalExpiry)} className="w-full" />
            </Field>
            <LookupField label="Medical status" name="medicalStatus" defaultValue={employee.medicalStatus} options={lookups.MEDICAL_STATUS} />
            <InlineDocumentUpload
              employeeId={employee.id}
              employeeName={employee.name}
              employeeDob={employee.dateOfBirth ? toDateInput(employee.dateOfBirth) : null}
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
            <DateField label="Expiry date" name="cicpaExpiry" defaultValue={employee.cicpaExpiry} />
            <InlineDocumentUpload
              employeeId={employee.id}
              employeeName={employee.name}
              employeeDob={employee.dateOfBirth ? toDateInput(employee.dateOfBirth) : null}
              type="CICPA"
              documents={docsByType("CICPA")}
              expiryFieldName="cicpaExpiry"
            />
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold text-primary">Insurance</h2>
          <div className="card grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
            <DateField label="Expiry date" name="insuranceExpiry" defaultValue={employee.insuranceExpiry} />
            <InlineDocumentUpload
              employeeId={employee.id}
              employeeName={employee.name}
              employeeDob={employee.dateOfBirth ? toDateInput(employee.dateOfBirth) : null}
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
            <DateField label="Expiry date" name="drivingLicenceExpiry" defaultValue={employee.drivingLicenceExpiry} />
            <InlineDocumentUpload
              employeeId={employee.id}
              employeeName={employee.name}
              employeeDob={employee.dateOfBirth ? toDateInput(employee.dateOfBirth) : null}
              type="DRIVING_LICENCE"
              documents={docsByType("DRIVING_LICENCE")}
              expiryFieldName="drivingLicenceExpiry"
            />
          </div>
        </section>
      </div>

      <div className={tab === "trade" ? "space-y-8" : "hidden"}>
        {pay && (
          <section>
            <h2 className="mb-1 text-sm font-semibold text-primary">Pay structure<Hint term="PAY_STRUCTURE" /></h2>
            <p className="mb-3 text-xs text-muted">
              Choose how this worker is paid. Overtime is worked out from attendance hours beyond the standard day (rate = basic ÷ 30 ÷ standard hours).
              {!pay.canEdit && " You can view these figures but not change them."}
            </p>
            <input type="hidden" name="_pay" value="1" />
            <fieldset disabled={!pay.canEdit} className="card grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
              <Field label="Pay structure">
                <Select
                  name="payStructure"
                  value={payStructure}
                  onChange={setPayStructure}
                  placeholder="Not set — excluded from payroll"
                  searchable={false}
                  options={[
                    { value: "ITEMISED", label: "Itemised — basic + allowances" },
                    { value: "FLAT", label: "Flat — one monthly rate" },
                    // The hourly rate is not typed here: it is the rate on the worker's trade (Known Trade Details).
                    { value: "HOURLY", label: "Hourly — paid per hour worked" },
                  ]}
                />
              </Field>
              {payStructure === "FLAT" && (
                <Field label="Monthly rate (AED)">
                  <NumberInput name="flatMonthlyRate" defaultValue={pay.flatMonthlyRate} min={0} step={0.01} className="w-full" />
                </Field>
              )}
              {payStructure === "HOURLY" && isStaff && (
                <Field label="Trade rate: hourly (AED)">
                  <NumberInput name="hourlyRate" defaultValue={pay.hourlyRate} min={0} step={0.01} className="w-full" />
                </Field>
              )}
              {payStructure === "HOURLY" && !isStaff && Number(pay.hourlyRate) > 0 && (
                <Field label="Trade rate: hourly rate saved on this worker (AED)">
                  <NumberInput name="hourlyRate" defaultValue={pay.hourlyRate} min={0} step={0.01} className="w-full" />
                </Field>
              )}
              {payStructure === "HOURLY" && !isStaff && (
                <p className="rounded-lg border border-default bg-surface-subtle px-4 py-2 text-xs text-secondary sm:col-span-2">
                  {Number(pay.hourlyRate) > 0
                    ? "Payroll pays the hourly rate saved on this worker first; the rate on the trade (Known Trade Details above) is used only when this is empty."
                    : "Paid per hour worked at the rate on this worker's trade — set it in Known Trade Details above."}
                </p>
              )}
              {payStructure === "ITEMISED" && (
                <>
                  <Field label="Basic salary (AED)">
                    <NumberInput name="basicSalary" defaultValue={pay.basicSalary} min={0} step={0.01} className="w-full" />
                  </Field>
                  <Field label="Housing allowance (AED)">
                    <NumberInput name="housingAllowance" defaultValue={pay.housingAllowance} min={0} step={0.01} className="w-full" />
                  </Field>
                  <Field label="Food allowance (AED)">
                    <NumberInput name="foodAllowance" defaultValue={pay.foodAllowance} min={0} step={0.01} className="w-full" />
                  </Field>
                  <Field label="Transport allowance (AED)">
                    <NumberInput name="transportAllowance" defaultValue={pay.transportAllowance} min={0} step={0.01} className="w-full" />
                  </Field>
                  <Field label="Other allowance (AED)">
                    <NumberInput name="otherAllowance" defaultValue={pay.otherAllowance} min={0} step={0.01} className="w-full" />
                  </Field>
                </>
              )}
              {payStructure && pay.canEdit && (
                <>
                  <Field label="Pay change takes effect from (optional)">
                    <DatePicker name="payEffectiveFrom" defaultValue="" className="w-full" />
                  </Field>
                  <Field label="Reason for a pay change (optional)">
                    <input name="payChangeReason" className="input w-full" placeholder="e.g. Annual increment" />
                  </Field>
                </>
              )}
              {payStructure && (
                <>
                  <label className="flex items-center gap-2 text-sm text-secondary sm:col-span-2">
                    <input type="checkbox" name="paysOvertime" defaultChecked={employee.paysOvertime} /> Paid for overtime
                  </label>
                  <Field label="Standard hours per day">
                    <NumberInput name="dailyHours" defaultValue={pay.dailyHours} min={1} max={16} step={0.25} className="w-full" />
                  </Field>
                  <Field label="Overtime multiplier">
                    <NumberInput name="otMultiplier" defaultValue={pay.otMultiplier} min={1} max={MAX_OT_MULTIPLIER} step={0.01} className="w-full" />
                  </Field>
                  <p className="text-xs text-muted sm:col-span-2">Contract terms the books can set aside each month. Leave a box blank to use the company default (Accounting › Settings), or enter 0 for none.</p>
                  <Field label="Paid leave (days a year)">
                    <NumberInput name="leaveDaysPerYear" defaultValue={pay.leaveDaysPerYear} min={0} max={90} step={1} className="w-full" />
                  </Field>
                  <Field label="Air ticket amount (AED)">
                    <NumberInput name="airTicketAmount" defaultValue={pay.airTicketAmount} min={0} step={0.01} className="w-full" />
                  </Field>
                  <Field label="Air ticket every (months)">
                    <NumberInput name="airTicketEveryMonths" defaultValue={pay.airTicketEveryMonths} min={1} max={60} step={1} className="w-full" />
                  </Field>
                  <label className="flex items-center gap-2 text-sm text-secondary sm:col-span-2">
                    <input type="checkbox" name="skipGratuity" defaultChecked={pay.skipGratuity} disabled={!pay.canEdit} /> Not entitled to end-of-service gratuity
                  </label>
                </>
              )}
            </fieldset>
            <label className="mt-3 flex items-center gap-2 text-sm text-secondary">
              <input type="checkbox" name="gasWaived" defaultChecked={employee.gasWaived} disabled={!pay.canEdit} /> Waive gas charge for this worker
            </label>
          </section>
        )}
      </div>

      <div className={tab === "payroll" ? "space-y-8" : "hidden"}>
        <section>
          <h2 className="mb-3 text-sm font-semibold text-primary">
            Payroll & WPS
          </h2>
          <div className="card grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
            <Field label="WPS bank / exchange house name">
              <ComboSelect name="wpsBankName" options={UAE_BANKS} defaultValue={employee.wpsBankName} />
            </Field>
            <Field label="WPS IBAN" hint="IBAN">
              <MaskedInput kind="iban"
                name="wpsIban"
                defaultValue={employee.wpsIban || ""}
                className="input w-full"
              />
            </Field>
            <TextField label="Payment mode" name="wpsPaymentMode" defaultValue={employee.wpsPaymentMode} />
            <TextField label="Bank routing code" name="wpsRoutingCode" defaultValue={employee.wpsRoutingCode} hint="ROUTING_CODE" />
            <TextField label="Account holder name" name="wpsAccountHolderName" defaultValue={employee.wpsAccountHolderName} />
            <TextField label="Account number" name="wpsAccountNumber" defaultValue={employee.wpsAccountNumber} />
            <TextField label="C3 ID (salary card)" name="c3Id" defaultValue={employee.c3Id} />
          </div>
        </section>
      </div>

      <div className={tab === "project" ? "space-y-8" : "hidden"}>
        <section>
          <h2 className="mb-3 text-sm font-semibold text-primary">
            Project & site
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
          </div>
        </section>
      </div>

      {tab !== "records" && tab !== "timesheet" && (
        // Sticky: this form is ~100 fields deep, so a correction made at the
        // top used to mean scrolling the whole page to find Save.
        <div className="sticky bottom-0 z-10 mt-8 -mx-4 flex flex-wrap items-center gap-3 border-t border-default bg-surface/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
          {warnings && !pending && (
            <div className="basis-full">
              <SaveWarnings
                warnings={warnings}
                onDismiss={() => setWarnings(null)}
                onSaveAnyway={() => {
                  const fd = lastForm.current;
                  if (!fd) return;
                  const again = new FormData();
                  for (const [k, v] of fd.entries()) again.append(k, v);
                  again.set("confirmWarnings", "1");
                  setWarnings(null);
                  setError(null);
                  startTransition(async () => {
                    const result = await updateEmployeeAction(again);
                    if (result?.error) { setError(result.error); setDirty(true); } else { setDirty(false); setSaved(true); }
                  });
                }}
              />
            </div>
          )}
          <button type="submit" disabled={pending} className="btn btn-primary">
            {pending ? "Saving…" : "Save changes"}
          </button>
          {dirty && !pending && !saved && (
            <span className="text-sm text-[var(--warning)]">Unsaved changes</span>
          )}
          {saved && !pending && (
            <span className="text-sm text-[var(--success)]">
              Saved.{pendingProject && <> The move to <strong>{pendingProject}</strong> was sent for approval, and the project changes once it is approved.</>}
            </span>
          )}
          {error && !pending && (
            <span className="text-sm text-[var(--error)]">{error}</span>
          )}
        </div>
      )}
      </form>

      {/* Each of these owns its own <form>, so they sit beside the main form rather than in it. */}
      <div className={tab === "project" ? "mt-8 space-y-8" : "hidden"}>{siteContent}</div>
      <div className={tab === "documents" ? "mt-8 space-y-8" : "hidden"}>{documentsContent}</div>
      <div className={tab === "timesheet" && timesheetContent ? "space-y-8" : "hidden"}>{timesheetContent}</div>
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
  hint,
}: {
  label: string;
  name: string;
  defaultValue: string | null;
  hint?: GlossaryKey;
}) {
  return (
    <Field label={label} hint={hint}>
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
      <DatePicker name={name} defaultValue={toDateInput(defaultValue)} />
    </Field>
  );
}

function Field({ label, children, required, hint }: { label: string; children: React.ReactNode; required?: boolean; hint?: GlossaryKey }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted">
        {label}
        {required && <span className="text-[var(--error)]"> *</span>}
        {hint && <Hint term={hint} />}
      </span>
      {children}
    </label>
  );
}
