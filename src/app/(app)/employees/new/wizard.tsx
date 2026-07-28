"use client";

import { useActionState, useState } from "react";
import { createEmployeeAction } from "./actions";

type Project = { id: string; name: string; code: string };

const STEPS = ["Personal Details", "Compliance & Documents", "Project & Salary", "Skills"];

const COMMON_SKILLS = [
  "Welding",
  "Carpentry",
  "Electrical Work",
  "Plumbing",
  "Heavy Machinery",
  "Safety Protocols",
];

export function EmployeeWizard({ projects }: { projects: Project[] }) {
  const [state, formAction, pending] = useActionState(createEmployeeAction, {
    error: null,
  });
  const [step, setStep] = useState(0);
  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState("");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

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
              name="name"
              required
              placeholder="Enter full name"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            />
          </Field>
          <Field label="Nationality">
            <input
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
              name="passportNumber"
              placeholder="Enter passport number"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            />
          </Field>
          <Field label="Emirates ID">
            <input
              name="emiratesId"
              placeholder="Enter Emirates ID"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            />
          </Field>
        </div>
        <StepNav onNext={goNext} nextLabel="Next" />
      </div>

      {/* Step 1: Compliance & Documents */}
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

      {/* Step 2: Project & Salary */}
      <div className={step === 2 ? "space-y-4" : "hidden"}>
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
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            >
              <option value="">Select salary type</option>
              <option value="BASIC">Basic Salary</option>
              <option value="HOURLY">Hourly Rate</option>
            </select>
          </Field>
        </div>
        <p className="text-xs text-slate-400">
          Hours, rate, and invoice value are managed through the timesheet
          upload flow, not set manually here.
        </p>
        <StepNav onPrev={goPrev} onNext={goNext} nextLabel="Next" />
      </div>

      {/* Step 3: Skills */}
      <div className={step === 3 ? "space-y-4" : "hidden"}>
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
