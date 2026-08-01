"use client";

import { useActionState, useRef, useState } from "react";
import { createEmployeeAction } from "./actions";
import type { ExtractedDocumentFields } from "@/app/api/documents/extract/route";

type Project = { id: string; name: string; code: string };

const STEPS = ["Personal Details", "Compliance", "Documents", "Project & Salary", "Skills"];

const COMMON_SKILLS = [
  "Welding",
  "Carpentry",
  "Electrical Work",
  "Plumbing",
  "Heavy Machinery",
  "Safety Protocols",
];

const DOC_SLOTS = [
  { type: "PASSPORT", label: "Passport" },
  { type: "VISA", label: "Visa" },
  { type: "LABOR_CARD", label: "Labor Card" },
  { type: "MEDICAL", label: "Medical Certificate" },
  { type: "EMIRATES_ID", label: "Emirates ID" },
] as const;

export function EmployeeWizard({ projects }: { projects: Project[] }) {
  const [state, formAction, pending] = useActionState(createEmployeeAction, {
    error: null,
  });
  const [step, setStep] = useState(0);
  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState("");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [salaryType, setSalaryType] = useState("");
  const [docFiles, setDocFiles] = useState<Record<string, File | null>>({});
  const [extracting, setExtracting] = useState<string | null>(null);
  const [extracted, setExtracted] = useState<ExtractedDocumentFields | null>(null);

  const nameRef = useRef<HTMLInputElement>(null);
  const nationalityRef = useRef<HTMLInputElement>(null);
  const passportNumberRef = useRef<HTMLInputElement>(null);
  const emiratesIdRef = useRef<HTMLInputElement>(null);
  const dobRef = useRef<HTMLInputElement>(null);

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

  async function handleDocFile(type: string, file: File | null) {
    setDocFiles((d) => ({ ...d, [type]: file }));
    setExtracted(null);
    if (!file || (!file.type.startsWith("image/") && file.type !== "application/pdf")) return;
    setExtracting(type);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/documents/extract", { method: "POST", body: formData });
      if (res.ok) {
        setExtracted(await res.json());
      }
    } catch {
      // Extraction is a convenience — fail silently.
    } finally {
      setExtracting(null);
    }
  }

  function applyExtracted() {
    if (!extracted) return;
    if (extracted.name && nameRef.current) nameRef.current.value = extracted.name;
    if (extracted.nationality && nationalityRef.current) nationalityRef.current.value = extracted.nationality;
    if (extracted.passportNumber && passportNumberRef.current) passportNumberRef.current.value = extracted.passportNumber;
    if (extracted.emiratesId && emiratesIdRef.current) emiratesIdRef.current.value = extracted.emiratesId;
    if (extracted.dateOfBirth && dobRef.current) dobRef.current.value = extracted.dateOfBirth;
    setExtracted(null);
  }

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="skills" value={skills.join(",")} />

      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {STEPS.map((label, i) => (
          <span
            key={label}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              i === step
                ? "bg-[#0B1642] text-white"
                : i < step
                  ? "text-emerald-600"
                  : "text-slate-400"
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

      {/* Step 0: Personal Details */}
      <div className={step === 0 ? "space-y-4" : "hidden"}>
        <div className="flex items-center gap-4">
          <div className="h-20 w-20 shrink-0 overflow-hidden rounded-full border border-slate-200 bg-slate-100">
            {photoPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photoPreview}
                alt="Preview"
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-2xl text-slate-400">
                +
              </span>
            )}
          </div>
          <label className="cursor-pointer rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
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
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            />
          </Field>
          <Field label="Full name">
            <input
              ref={nameRef}
              name="name"
              required
              placeholder="Enter full name"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            />
          </Field>
          <Field label="Nationality">
            <input
              ref={nationalityRef}
              name="nationality"
              placeholder="Select nationality"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            />
          </Field>
          <Field label="Position / Trade">
            <input
              name="position"
              placeholder="Select position"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            />
          </Field>
          <Field label="Passport number">
            <input
              ref={passportNumberRef}
              name="passportNumber"
              placeholder="Enter passport number"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            />
          </Field>
          <Field label="Emirates ID">
            <input
              ref={emiratesIdRef}
              name="emiratesId"
              placeholder="Enter Emirates ID"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            />
          </Field>
          <Field label="Date of birth">
            <input
              ref={dobRef}
              type="date"
              name="dateOfBirth"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            />
          </Field>
        </div>
        <StepNav onNext={goNext} nextLabel="Next" />
      </div>

      {/* Step 1: Compliance */}
      <div className={step === 1 ? "space-y-4" : "hidden"}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Visa Expiry Date">
            <input
              type="date"
              name="visaExpiry"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            />
          </Field>
          <Field label="Labor Card Expiry">
            <input
              type="date"
              name="laborCardExpiry"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            />
          </Field>
          <Field label="Medical Certificate Expiry">
            <input
              type="date"
              name="medicalExpiry"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            />
          </Field>
          <Field label="Passport Expiry Date">
            <input
              type="date"
              name="passportExpiry"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            />
          </Field>
          <Field label="Emirates ID Expiry Date">
            <input
              type="date"
              name="emiratesIdExpiry"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            />
          </Field>
        </div>
        <Field label="Additional Notes">
          <textarea
            name="notes"
            rows={3}
            placeholder="Any special requirements, medical conditions, or other important notes..."
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
          />
        </Field>
        <StepNav onPrev={goPrev} onNext={goNext} nextLabel="Next" />
      </div>

      {/* Step 2: Documents */}
      <div className={step === 2 ? "space-y-4" : "hidden"}>
        <p className="text-xs text-slate-500">
          Upload any documents available now — expiry dates are taken from the
          Compliance step, not asked again here.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {DOC_SLOTS.map((slot) => (
            <Field key={slot.type} label={slot.label}>
              <input
                type="file"
                name={`docFile_${slot.type}`}
                onChange={(e) => handleDocFile(slot.type, e.target.files?.[0] ?? null)}
                className="w-full text-sm"
              />
              {extracting === slot.type && (
                <p className="mt-1 text-xs text-slate-400">Reading document…</p>
              )}
              {docFiles[slot.type] && extracting !== slot.type && (
                <p className="mt-1 text-xs text-emerald-600">
                  {docFiles[slot.type]!.name} selected
                </p>
              )}
            </Field>
          ))}
        </div>
        {extracted && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
            <p className="mb-2 text-xs font-medium text-blue-900">
              Auto-read from the last document — apply to Personal Details?
            </p>
            <div className="mb-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-blue-800 sm:grid-cols-4">
              {extracted.name && <span>Name: {extracted.name}</span>}
              {extracted.passportNumber && <span>Passport: {extracted.passportNumber}</span>}
              {extracted.emiratesId && <span>Emirates ID: {extracted.emiratesId}</span>}
              {extracted.dateOfBirth && <span>DOB: {extracted.dateOfBirth}</span>}
              {extracted.nationality && <span>Nationality: {extracted.nationality}</span>}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={applyExtracted}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
              >
                Apply to Personal Details
              </button>
              <button
                type="button"
                onClick={() => setExtracted(null)}
                className="rounded-lg border border-blue-200 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
        <StepNav onPrev={goPrev} onNext={goNext} nextLabel="Next" />
      </div>

      {/* Step 3: Project & Salary */}
      <div className={step === 3 ? "space-y-4" : "hidden"}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Project Assignment (optional)">
            <select
              name="projectId"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            >
              <option value="">Select project (optional)</option>
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
              value={salaryType}
              onChange={(e) => setSalaryType(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            >
              <option value="">Select salary type</option>
              <option value="BASIC">Basic Salary</option>
              <option value="HOURLY">Hourly Rate</option>
            </select>
          </Field>
          {salaryType && (
            <Field label={salaryType === "HOURLY" ? "Hourly rate (AED, reference only)" : "Basic salary (AED, reference only)"}>
              <input
                type="number"
                step="0.01"
                name="salaryRate"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
              />
            </Field>
          )}
        </div>
        <p className="text-xs text-slate-400">
          Hours, rate, and invoice value are managed through the timesheet
          upload flow, not set manually here.
        </p>
        <StepNav onPrev={goPrev} onNext={goNext} nextLabel="Next" />
      </div>

      {/* Step 4: Skills */}
      <div className={step === 4 ? "space-y-4" : "hidden"}>
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
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            />
            <button
              type="button"
              onClick={() => addSkill(skillInput)}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              +
            </button>
          </div>
        </Field>

        {skills.length > 0 && (
          <div>
            <p className="mb-1 text-xs font-medium text-slate-500">
              Added skills:
            </p>
            <div className="flex flex-wrap gap-2">
              {skills.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSkills((arr) => arr.filter((x) => x !== s))}
                  className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200"
                >
                  {s} <span className="text-slate-400">×</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <p className="mb-1 text-xs text-slate-400">
            Common skills for construction workers:
          </p>
          <div className="flex flex-wrap gap-2">
            {COMMON_SKILLS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => addSkill(s)}
                className="text-xs text-slate-400 hover:text-slate-700 hover:underline"
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
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
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
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-60"
        >
          {nextLabel}
        </button>
      ) : (
        <button
          type="button"
          onClick={onNext}
          className="rounded-lg bg-[#0B1642] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#0B1642]/90"
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
      <span className="mb-1 block text-xs font-medium text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}
