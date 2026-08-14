"use client";

import { useActionState, useRef, useState } from "react";
import { createEmployeeAction } from "./actions";
import type { ExtractedDocumentFields } from "@/app/api/documents/extract/route";
import { Select } from "@/components/ui/Select";
import { CountrySelect } from "@/components/ui/CountrySelect";

type Project = { id: string; name: string; code: string };
type SponsorshipCompany = { id: string; name: string };

const STEPS = [
  "Passport",
  "Emirates ID",
  "Labour Card",
  "Personal Details",
  "Other & Documents",
  "Project & Salary",
  "Skills",
];

const COMMON_SKILLS = [
  "Welding",
  "Carpentry",
  "Electrical Work",
  "Plumbing",
  "Heavy Machinery",
  "Safety Protocols",
];

const ADDITIONAL_DOC_TYPES = [
  { value: "VISA", label: "Visa" },
  { value: "MEDICAL", label: "Medical Certificate" },
  { value: "CICPA", label: "CICPA" },
  { value: "INSURANCE", label: "Insurance" },
  { value: "DRIVING_LICENCE", label: "Driving Licence" },
  { value: "OTHER", label: "Other" },
];

const FILE_INPUT_CLASS =
  "file-input";

export function EmployeeWizard({
  projects,
  sponsorshipCompanies,
  lookups,
}: {
  projects: Project[];
  sponsorshipCompanies: SponsorshipCompany[];
  lookups: Record<string, { value: string }[]>;
}) {
  const [state, formAction, pending] = useActionState(createEmployeeAction, {
    error: null,
  });
  const [step, setStep] = useState(0);
  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState("");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [salaryType, setSalaryType] = useState("");
  const [nationality, setNationality] = useState("");
  const [additionalDocType, setAdditionalDocType] = useState("");
  const [docFiles, setDocFiles] = useState<Record<string, File | null>>({});
  const [extracting, setExtracting] = useState<string | null>(null);
  const [extractedNote, setExtractedNote] = useState<Record<string, string>>({});

  const nameRef = useRef<HTMLInputElement>(null);
  const dobRef = useRef<HTMLInputElement>(null);
  const passportNumberRef = useRef<HTMLInputElement>(null);
  const passportExpiryRef = useRef<HTMLInputElement>(null);
  const emiratesIdRef = useRef<HTMLInputElement>(null);
  const emiratesIdExpiryRef = useRef<HTMLInputElement>(null);
  const laborCardNumberRef = useRef<HTMLInputElement>(null);
  const laborCardPersonalNoRef = useRef<HTMLInputElement>(null);
  const laborCardExpiryRef = useRef<HTMLInputElement>(null);

  function addSkill(name: string) {
    const trimmed = name.trim();
    if (!trimmed || skills.includes(trimmed)) return;
    setSkills((s) => [...s, trimmed]);
    setSkillInput("");
  }

  function goNext() {
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }
  function goPrev() {
    setStep((s) => Math.max(s - 1, 0));
  }

  function applyExtractedFields(fields: ExtractedDocumentFields) {
    if (fields.name && nameRef.current) nameRef.current.value = fields.name;
    if (fields.nationality) setNationality(fields.nationality);
    if (fields.dateOfBirth && dobRef.current) dobRef.current.value = fields.dateOfBirth;
    if (fields.passportNumber && passportNumberRef.current) passportNumberRef.current.value = fields.passportNumber;
    if (fields.passportExpiry && passportExpiryRef.current) passportExpiryRef.current.value = fields.passportExpiry;
    if (fields.emiratesId && emiratesIdRef.current) emiratesIdRef.current.value = fields.emiratesId;
    if (fields.emiratesIdExpiry && emiratesIdExpiryRef.current) emiratesIdExpiryRef.current.value = fields.emiratesIdExpiry;
    if (fields.laborCardNumber && laborCardNumberRef.current) laborCardNumberRef.current.value = fields.laborCardNumber;
    if (fields.laborCardPersonalNo && laborCardPersonalNoRef.current) laborCardPersonalNoRef.current.value = fields.laborCardPersonalNo;
    if (fields.laborCardExpiry && laborCardExpiryRef.current) laborCardExpiryRef.current.value = fields.laborCardExpiry;
  }

  async function handleUploadDocFile(type: string, file: File | null) {
    setDocFiles((d) => ({ ...d, [type]: file }));
    setExtractedNote((n) => ({ ...n, [type]: "" }));
    if (!file || (!file.type.startsWith("image/") && file.type !== "application/pdf")) return;
    setExtracting(type);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("docType", type);
      const res = await fetch("/api/documents/extract", { method: "POST", body: formData });
      if (res.ok) {
        const fields = (await res.json()) as ExtractedDocumentFields;
        applyExtractedFields(fields);
        setExtractedNote((n) => ({ ...n, [type]: "Auto-filled below — review before continuing." }));
      }
    } catch {
      // Extraction is a convenience — fail silently.
    } finally {
      setExtracting(null);
    }
  }

  function UploadSlot({ type, label }: { type: string; label: string }) {
    return (
      <div>
        <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
        <input
          type="file"
          name={`docFile_${type}`}
          onChange={(e) => handleUploadDocFile(type, e.target.files?.[0] ?? null)}
          className={FILE_INPUT_CLASS}
        />
        {extracting === type && <p className="mt-1 text-xs text-subtle">Reading document…</p>}
        {extractedNote[type] && extracting !== type && (
          <p className="mt-1 text-xs text-emerald-600">✓ {extractedNote[type]}</p>
        )}
        {docFiles[type] && !extractedNote[type] && extracting !== type && (
          <p className="mt-1 text-xs text-muted">{docFiles[type]!.name} selected</p>
        )}
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="skills" value={skills.join(",")} />

      <div className="flex flex-wrap gap-2 border-b border-default pb-3">
        {STEPS.map((label, i) => (
          <span
            key={label}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              i === step
                ? "bg-[var(--brand-primary)] text-white"
                : i < step
                  ? "text-emerald-600"
                  : "text-subtle"
            }`}
          >
            {label}
          </span>
        ))}
      </div>

      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      {/* Step 0: Passport */}
      <div className={step === 0 ? "space-y-4" : "hidden"}>
        <UploadSlot type="PASSPORT" label="Upload passport" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Passport number">
            <input
              ref={passportNumberRef}
              name="passportNumber"
              placeholder="Enter passport number"
              className="input w-full"
            />
          </Field>
          <Field label="Passport expiry date">
            <input
              ref={passportExpiryRef}
              type="date"
              name="passportExpiry"
              className="input w-full"
            />
          </Field>
        </div>
        <StepNav onNext={goNext} nextLabel="Next" />
      </div>

      {/* Step 1: Emirates ID */}
      <div className={step === 1 ? "space-y-4" : "hidden"}>
        <UploadSlot type="EMIRATES_ID" label="Upload Emirates ID" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Emirates ID number">
            <input
              ref={emiratesIdRef}
              name="emiratesId"
              placeholder="Enter Emirates ID"
              className="input w-full"
            />
          </Field>
          <Field label="Emirates ID expiry date">
            <input
              ref={emiratesIdExpiryRef}
              type="date"
              name="emiratesIdExpiry"
              className="input w-full"
            />
          </Field>
        </div>
        <StepNav onPrev={goPrev} onNext={goNext} nextLabel="Next" />
      </div>

      {/* Step 2: Labour Card */}
      <div className={step === 2 ? "space-y-4" : "hidden"}>
        <UploadSlot type="LABOR_CARD" label="Upload labour card" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Labor card number">
            <input
              ref={laborCardNumberRef}
              name="laborCardNumber"
              placeholder="Enter labor card number"
              className="input w-full"
            />
          </Field>
          <Field label="Labor card personal no.">
            <input
              ref={laborCardPersonalNoRef}
              name="laborCardPersonalNo"
              placeholder="Enter personal number"
              className="input w-full"
            />
          </Field>
          <Field label="Labor card expiry">
            <input
              ref={laborCardExpiryRef}
              type="date"
              name="laborCardExpiry"
              className="input w-full"
            />
          </Field>
        </div>
        <StepNav onPrev={goPrev} onNext={goNext} nextLabel="Next" />
      </div>

      {/* Step 3: Personal Details */}
      <div className={step === 3 ? "space-y-4" : "hidden"}>
        <div className="flex items-center gap-4">
          <div className="h-20 w-20 shrink-0 overflow-hidden rounded-full border border-default bg-surface-sunken">
            {photoPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photoPreview}
                alt="Preview"
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-2xl text-subtle">
                +
              </span>
            )}
          </div>
          <label className="btn btn-secondary cursor-pointer px-3">
            Upload Photo
            <input
              type="file"
              name="photo"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) setPhotoPreview(URL.createObjectURL(file));
              }}
            />
          </label>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Employee ID No">
            <input
              name="employeeIdNo"
              required
              placeholder="e.g. BACC999"
              className="input w-full"
            />
          </Field>
          <Field label="Full name">
            <input
              ref={nameRef}
              name="name"
              required
              placeholder="Enter full name"
              className="input w-full"
            />
          </Field>
          <Field label="Category">
            <Select
              name="category"
              defaultValue="SITE_STAFF"
              searchable={false}
              options={[
                { value: "SITE_STAFF", label: "Site Staff" },
                { value: "STAFF", label: "Staff" },
              ]}
            />
          </Field>
          <Field label="Sponsorship company">
            <Select
              name="sponsorshipCompanyId"
              placeholder="Not set"
              options={sponsorshipCompanies.map((s) => ({ value: s.id, label: s.name }))}
            />
          </Field>
          <Field label="Nationality">
            <CountrySelect
              name="nationality"
              value={nationality}
              onChange={setNationality}
              placeholder="Select nationality"
            />
          </Field>
          <Field label="Position / Trade">
            <Select
              name="position"
              placeholder="Select position"
              options={lookups.POSITION.map((o) => ({ value: o.value, label: o.value }))}
            />
          </Field>
          <Field label="Date of birth">
            <input
              ref={dobRef}
              type="date"
              name="dateOfBirth"
              className="input w-full"
            />
          </Field>
        </div>
        <StepNav onPrev={goPrev} onNext={goNext} nextLabel="Next" />
      </div>

      {/* Step 4: Other & Documents */}
      <div className={step === 4 ? "space-y-4" : "hidden"}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Visa Expiry Date">
            <input
              type="date"
              name="visaExpiry"
              className="input w-full"
            />
          </Field>
          <Field label="Medical Certificate Expiry">
            <input
              type="date"
              name="medicalExpiry"
              className="input w-full"
            />
          </Field>
        </div>
        <Field label="Additional Notes">
          <textarea
            name="notes"
            rows={3}
            placeholder="Any special requirements, medical conditions, or other important notes..."
            className="input w-full"
          />
        </Field>

        <div className="rounded-lg border border-default p-4">
          <p className="mb-3 text-xs text-muted">
            Passport, Emirates ID, and Labor Card are already handled above.
            Use this only for anything else (Visa, Medical, CICPA, etc.) — optional.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Document type">
              <Select
                name="additionalDocType"
                value={additionalDocType}
                onChange={setAdditionalDocType}
                searchable={false}
                placeholder="Select type"
                options={ADDITIONAL_DOC_TYPES}
              />
            </Field>
            <Field label="File">
              <input type="file" name="docFile_ADDITIONAL" className={FILE_INPUT_CLASS} />
            </Field>
            <Field label="Expiry date (optional)">
              <input
                type="date"
                name="additionalDocExpiry"
                className="input w-full"
              />
            </Field>
          </div>
        </div>
        <StepNav onPrev={goPrev} onNext={goNext} nextLabel="Next" />
      </div>

      {/* Step 5: Project & Salary */}
      <div className={step === 5 ? "space-y-4" : "hidden"}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Project Assignment (optional)">
            <Select
              name="projectId"
              placeholder="Select project (optional)"
              options={projects.map((p) => ({ value: p.id, label: `${p.code} — ${p.name}` }))}
            />
          </Field>
          <Field label="Salary type (reference only)">
            <Select
              name="salaryType"
              value={salaryType}
              onChange={setSalaryType}
              placeholder="Select salary type"
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
                className="input w-full"
              />
            </Field>
          )}
        </div>
        <p className="text-xs text-subtle">
          Hours, rate, and invoice value are managed through the timesheet
          upload flow, not set manually here.
        </p>
        <StepNav onPrev={goPrev} onNext={goNext} nextLabel="Next" />
      </div>

      {/* Step 6: Skills */}
      <div className={step === 6 ? "space-y-4" : "hidden"}>
        <Field label="Employee Skills">
          <div className="flex gap-2">
            <input
              value={skillInput}
              onChange={(e) => setSkillInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addSkill(skillInput);
                }
              }}
              placeholder="Add a skill (e.g., Welding, Carpentry, etc.)"
              className="input flex-1"
            />
            <button
              type="button"
              onClick={() => addSkill(skillInput)}
              className="btn btn-primary"
            >
              +
            </button>
          </div>
        </Field>

        {skills.length > 0 && (
          <div>
            <p className="mb-1 text-xs font-medium text-muted">
              Added skills:
            </p>
            <div className="flex flex-wrap gap-2">
              {skills.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSkills((arr) => arr.filter((x) => x !== s))}
                  className="inline-flex items-center gap-1.5 rounded-full bg-surface-sunken px-3 py-1.5 text-xs font-medium text-secondary hover:bg-[var(--border)]"
                >
                  {s} <span className="text-subtle">×</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <p className="mb-1 text-xs text-subtle">
            Common skills for construction workers:
          </p>
          <div className="flex flex-wrap gap-2">
            {COMMON_SKILLS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => addSkill(s)}
                className="text-xs text-subtle hover:text-secondary hover:underline"
              >
                + {s}
              </button>
            ))}
          </div>
        </div>

        <StepNav
          onPrev={goPrev}
          submit
          pending={pending}
          nextLabel={pending ? "Registering…" : "Register Employee"}
        />
      </div>
    </form>
  );
}

function StepNav({
  onPrev,
  onNext,
  submit,
  pending,
  nextLabel,
}: {
  onPrev?: () => void;
  onNext?: () => void;
  submit?: boolean;
  pending?: boolean;
  nextLabel: string;
}) {
  return (
    <div className="flex items-center justify-between pt-2">
      {onPrev ? (
        <button
          type="button"
          onClick={onPrev}
          className="btn btn-secondary"
        >
          Previous
        </button>
      ) : (
        <span />
      )}
      {submit ? (
        <button
          type="submit"
          disabled={pending}
          className="btn btn-primary"
        >
          {nextLabel}
        </button>
      ) : (
        <button
          type="button"
          onClick={onNext}
          className="btn btn-primary"
        >
          {nextLabel}
        </button>
      )}
    </div>
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
