"use client";

import { startTransition, useActionState, useMemo, useRef, useState } from "react";
import { Check, FileUp, Sparkles } from "lucide-react";
import { createEmployeeAction } from "./actions";
import { UploadSlot, type UploadStatus } from "./upload-slot";
import type { ExtractedDocumentFields } from "@/app/api/documents/extract/route";
import { Select } from "@/components/ui/Select";
import { CountrySelect } from "@/components/ui/CountrySelect";
import { cn } from "@/lib/cn";

type Project = { id: string; name: string; code: string };
type SponsorshipCompany = { id: string; name: string };
type Supplier = { id: string; name: string };

const STEPS = [
  { key: "documents", label: "Documents" },
  { key: "identity", label: "Identity" },
  { key: "expiry", label: "Numbers & expiry" },
  { key: "assignment", label: "Assignment" },
  { key: "extras", label: "Skills & notes" },
  { key: "review", label: "Review" },
] as const;

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

const DOC_LABEL: Record<string, string> = {
  PASSPORT: "Passport",
  EMIRATES_ID: "Emirates ID",
  LABOR_CARD: "Labour card",
  VISA: "Visa",
  PHOTO: "Photo",
};

/** Text fields the wizard owns, so extraction and review can both read them. */
type Fields = {
  employeeIdNo: string;
  name: string;
  category: string;
  gender: string;
  nationality: string;
  position: string;
  dateOfBirth: string;
  mobileNumber: string;
  joinDate: string;
  passportNumber: string;
  passportExpiry: string;
  emiratesId: string;
  emiratesIdExpiry: string;
  laborCardNumber: string;
  laborCardPersonalNo: string;
  laborCardExpiry: string;
  visaExpiry: string;
  medicalExpiry: string;
  supplierId: string;
  sponsorshipCompanyId: string;
  projectId: string;
  salaryType: string;
  salaryRate: string;
  notes: string;
  additionalDocType: string;
  additionalDocExpiry: string;
};

const EMPTY_FIELDS: Fields = {
  employeeIdNo: "",
  name: "",
  category: "SITE_STAFF",
  gender: "",
  nationality: "",
  position: "",
  dateOfBirth: "",
  mobileNumber: "",
  joinDate: "",
  passportNumber: "",
  passportExpiry: "",
  emiratesId: "",
  emiratesIdExpiry: "",
  laborCardNumber: "",
  laborCardPersonalNo: "",
  laborCardExpiry: "",
  visaExpiry: "",
  medicalExpiry: "",
  supplierId: "",
  sponsorshipCompanyId: "",
  projectId: "",
  salaryType: "",
  salaryRate: "",
  notes: "",
  additionalDocType: "",
  additionalDocExpiry: "",
};

type DocSlot = "PASSPORT" | "EMIRATES_ID" | "LABOR_CARD" | "ADDITIONAL" | "COMBINED";

export function EmployeeWizard({
  projects,
  suppliers,
  sponsorshipCompanies,
  lookups,
}: {
  projects: Project[];
  suppliers: Supplier[];
  sponsorshipCompanies: SponsorshipCompany[];
  lookups: Record<string, { value: string }[]>;
}) {
  const [state, formAction, pending] = useActionState(createEmployeeAction, {
    error: null,
  });

  const [step, setStep] = useState(0);
  const [fields, setFields] = useState<Fields>(EMPTY_FIELDS);
  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [stepError, setStepError] = useState<string | null>(null);

  // Files live in state, not in the DOM, and are attached to the FormData on
  // submit — a re-render can never discard them.
  const [docFiles, setDocFiles] = useState<Partial<Record<DocSlot, File>>>({});
  const [status, setStatus] = useState<Partial<Record<DocSlot, UploadStatus>>>({});
  const [autofilled, setAutofilled] = useState<string[]>([]);

  const formRef = useRef<HTMLFormElement>(null);

  function set<K extends keyof Fields>(key: K, value: Fields[K]) {
    setFields((f) => ({ ...f, [key]: value }));
  }

  const statusOf = (slot: DocSlot): UploadStatus => status[slot] ?? { kind: "idle" };

  /** Writes extracted values into any field the user hasn't already filled. */
  function applyExtractedFields(data: ExtractedDocumentFields) {
    const filled: string[] = [];
    setFields((prev) => {
      const next = { ...prev };
      const put = (key: keyof Fields, value: string | null | undefined, label: string) => {
        if (!value) return;
        // Never clobber something the user typed themselves.
        if (next[key]) return;
        next[key] = value;
        filled.push(label);
      };
      put("name", data.name, "Name");
      put("dateOfBirth", data.dateOfBirth, "Date of birth");
      put("nationality", data.nationality, "Nationality");
      put("gender", data.gender?.toUpperCase(), "Gender");
      put("position", data.position, "Position");
      put("passportNumber", data.passportNumber, "Passport no.");
      put("passportExpiry", data.passportExpiry, "Passport expiry");
      put("emiratesId", data.emiratesId, "Emirates ID");
      put("emiratesIdExpiry", data.emiratesIdExpiry, "Emirates ID expiry");
      put("laborCardNumber", data.laborCardNumber, "Labour card no.");
      put("laborCardPersonalNo", data.laborCardPersonalNo, "Personal no.");
      put("laborCardExpiry", data.laborCardExpiry, "Labour card expiry");
      return next;
    });
    setAutofilled((prev) => [...new Set([...prev, ...filled])]);
    return filled.length;
  }

  async function readDocument(slot: DocSlot, file: File) {
    const readable =
      file.type.startsWith("image/") || file.type === "application/pdf";
    if (!readable) {
      setStatus((s) => ({ ...s, [slot]: { kind: "idle" } }));
      return;
    }

    setStatus((s) => ({ ...s, [slot]: { kind: "reading" } }));
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("docType", slot === "ADDITIONAL" ? "" : slot);
      const res = await fetch("/api/documents/extract", { method: "POST", body });
      const payload = await res.json().catch(() => null);

      if (!res.ok) {
        // Surfaced, not swallowed — a silent failure is why this looked broken.
        const message =
          (payload && typeof payload.error === "string" && payload.error) ||
          `Couldn't read this document (${res.status}).`;
        setStatus((s) => ({ ...s, [slot]: { kind: "error", message } }));
        return;
      }

      const count = applyExtractedFields(payload as ExtractedDocumentFields);
      const found = (payload as ExtractedDocumentFields).documentsFound ?? [];
      const foundLabel = found.length
        ? ` Found ${found.map((f) => DOC_LABEL[f] ?? f).join(", ")}.`
        : "";
      setStatus((s) => ({
        ...s,
        [slot]: {
          kind: "filled",
          message: count
            ? `Filled ${count} field${count === 1 ? "" : "s"}.${foundLabel} Review before saving.`
            : `Nothing new to fill — existing values kept.${foundLabel}`,
        },
      }));
    } catch {
      setStatus((s) => ({
        ...s,
        [slot]: { kind: "error", message: "Couldn't reach the extraction service." },
      }));
    }
  }

  function selectDoc(slot: DocSlot, file: File | null) {
    if (!file) return;
    setDocFiles((d) => ({ ...d, [slot]: file }));
    setStatus((s) => ({ ...s, [slot]: { kind: "idle" } }));
    void readDocument(slot, file);
  }

  function clearDoc(slot: DocSlot) {
    setDocFiles((d) => {
      const next = { ...d };
      delete next[slot];
      return next;
    });
    setStatus((s) => ({ ...s, [slot]: { kind: "idle" } }));
  }

  function addSkill(name: string) {
    const trimmed = name.trim();
    if (!trimmed || skills.includes(trimmed)) return;
    setSkills((s) => [...s, trimmed]);
    setSkillInput("");
  }

  /** Blocks Next only on things the server would reject anyway. */
  function validate(index: number): string | null {
    if (STEPS[index].key === "identity") {
      if (!fields.employeeIdNo.trim()) return "Employee ID is required.";
      if (!fields.name.trim()) return "Full name is required.";
    }
    return null;
  }

  function goTo(index: number) {
    // Moving forward validates every step in between; going back never does.
    if (index > step) {
      for (let i = step; i < index; i++) {
        const error = validate(i);
        if (error) {
          setStep(i);
          setStepError(error);
          return;
        }
      }
    }
    setStepError(null);
    setStep(index);
  }

  const completed = useMemo(() => {
    const done = new Set<number>();
    STEPS.forEach((s, i) => {
      if (s.key === "identity" && fields.employeeIdNo && fields.name) done.add(i);
      if (s.key === "documents" && Object.keys(docFiles).length > 0) done.add(i);
      if (s.key === "expiry" && (fields.passportNumber || fields.emiratesId)) done.add(i);
      if (s.key === "assignment" && (fields.supplierId || fields.projectId)) done.add(i);
      if (s.key === "extras" && (skills.length > 0 || fields.notes)) done.add(i);
    });
    return done;
  }, [fields, docFiles, skills]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const error = validate(STEPS.findIndex((s) => s.key === "identity"));
    if (error) {
      setStep(STEPS.findIndex((s) => s.key === "identity"));
      setStepError(error);
      return;
    }

    const body = new FormData();
    for (const [key, value] of Object.entries(fields)) {
      if (value) body.set(key, value);
    }
    body.set("skills", skills.join(","));
    if (photo) body.set("photo", photo);
    for (const [slot, file] of Object.entries(docFiles)) {
      if (!file) continue;
      // The combined pack is filed under the first document type it contains.
      body.set(slot === "COMBINED" ? "docFile_PASSPORT" : `docFile_${slot}`, file);
    }
    // Must run inside a transition: dispatching a useActionState action
    // directly outside one leaves `pending` stale and React warns.
    startTransition(() => formAction(body));
  }

  const isLast = step === STEPS.length - 1;

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-5">
      {/* Step rail */}
      <nav aria-label="Progress" className="border-b border-default pb-3">
        <ol className="flex flex-wrap gap-1.5">
          {STEPS.map((s, i) => {
            const active = i === step;
            const done = completed.has(i) && !active;
            return (
              <li key={s.key}>
                <button
                  type="button"
                  onClick={() => goTo(i)}
                  aria-current={active ? "step" : undefined}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-control px-2.5 py-1.5 text-xs font-medium transition",
                    active
                      ? "bg-[var(--brand-primary)] text-white"
                      : done
                        ? "bg-[var(--success-soft)] text-[var(--success)] hover:bg-surface-hover"
                        : "text-muted hover:bg-surface-hover hover:text-primary"
                  )}
                >
                  {done ? (
                    <Check className="h-3 w-3" aria-hidden />
                  ) : (
                    <span className="tabular text-[10px] opacity-70">{i + 1}</span>
                  )}
                  {s.label}
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      {(state.error || stepError) && (
        <p className="rounded-control border border-[var(--error-border)] bg-[var(--error-soft)] px-3 py-2 text-sm text-[var(--error)]">
          {state.error ?? stepError}
        </p>
      )}

      {/* ---------------------------------------------------------------- */}
      {STEPS[step].key === "documents" && (
        <div className="space-y-4">
          <div className="rounded-card border border-[var(--brand-primary-border)] bg-brand-soft p-4">
            <div className="flex items-start gap-2.5">
              <Sparkles
                className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand-primary)]"
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-primary">
                  Upload the whole document pack
                </p>
                <p className="mt-0.5 text-xs text-secondary">
                  One PDF or image containing the passport, Emirates ID and
                  labour card together. Every field it can read is filled in for
                  you — you review it on the next steps.
                </p>
                <div className="mt-3">
                  <UploadSlot
                    id="doc-combined"
                    label="Combined document pack"
                    file={docFiles.COMBINED ?? null}
                    status={statusOf("COMBINED")}
                    onSelect={(f) => selectDoc("COMBINED", f)}
                    onClear={() => clearDoc("COMBINED")}
                  />
                </div>
              </div>
            </div>
          </div>

          <details className="rounded-card border border-default">
            <summary className="cursor-pointer px-4 py-2.5 text-sm font-medium text-secondary">
              Or upload documents separately
            </summary>
            <div className="grid grid-cols-1 gap-4 border-t border-default p-4 sm:grid-cols-2">
              <UploadSlot
                id="doc-passport"
                label="Passport"
                file={docFiles.PASSPORT ?? null}
                status={statusOf("PASSPORT")}
                onSelect={(f) => selectDoc("PASSPORT", f)}
                onClear={() => clearDoc("PASSPORT")}
              />
              <UploadSlot
                id="doc-eid"
                label="Emirates ID"
                file={docFiles.EMIRATES_ID ?? null}
                status={statusOf("EMIRATES_ID")}
                onSelect={(f) => selectDoc("EMIRATES_ID", f)}
                onClear={() => clearDoc("EMIRATES_ID")}
              />
              <UploadSlot
                id="doc-labour"
                label="Labour card"
                file={docFiles.LABOR_CARD ?? null}
                status={statusOf("LABOR_CARD")}
                onSelect={(f) => selectDoc("LABOR_CARD", f)}
                onClear={() => clearDoc("LABOR_CARD")}
              />
              <div className="space-y-3">
                <UploadSlot
                  id="doc-additional"
                  label="Another document"
                  hint="Visa, medical, CICPA, insurance…"
                  file={docFiles.ADDITIONAL ?? null}
                  status={statusOf("ADDITIONAL")}
                  onSelect={(f) => selectDoc("ADDITIONAL", f)}
                  onClear={() => clearDoc("ADDITIONAL")}
                />
                {docFiles.ADDITIONAL && (
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Type">
                      <Select
                        value={fields.additionalDocType}
                        onChange={(v) => set("additionalDocType", v)}
                        searchable={false}
                        placeholder="Select type"
                        options={ADDITIONAL_DOC_TYPES}
                      />
                    </Field>
                    <Field label="Expiry">
                      <input
                        type="date"
                        value={fields.additionalDocExpiry}
                        onChange={(e) => set("additionalDocExpiry", e.target.value)}
                        className="input w-full"
                      />
                    </Field>
                  </div>
                )}
              </div>
            </div>
          </details>

          {autofilled.length > 0 && (
            <p className="text-xs text-muted">
              <span className="font-medium text-[var(--success)]">
                Auto-filled:
              </span>{" "}
              {autofilled.join(", ")}
            </p>
          )}
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      {STEPS[step].key === "identity" && (
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="h-20 w-20 shrink-0 overflow-hidden rounded-full border border-default bg-surface-sunken">
              {photoPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photoPreview}
                  alt="Employee photo preview"
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-subtle">
                  <FileUp className="h-5 w-5" aria-hidden />
                </span>
              )}
            </div>
            <label className="btn btn-secondary btn-sm cursor-pointer">
              {photo ? "Change photo" : "Upload photo"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  setPhoto(file);
                  setPhotoPreview(file ? URL.createObjectURL(file) : null);
                }}
              />
            </label>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Employee ID No" required>
              <input
                value={fields.employeeIdNo}
                onChange={(e) => set("employeeIdNo", e.target.value)}
                placeholder="e.g. PTTFC112"
                className="input w-full"
              />
            </Field>
            <Field label="Full name" required>
              <input
                value={fields.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="Enter full name"
                className="input w-full"
              />
            </Field>
            <Field label="Category">
              <Select
                value={fields.category}
                onChange={(v) => set("category", v)}
                searchable={false}
                options={[
                  { value: "SITE_STAFF", label: "Site Staff" },
                  { value: "STAFF", label: "Staff" },
                ]}
              />
            </Field>
            <Field label="Position / Trade">
              <Select
                value={fields.position}
                onChange={(v) => set("position", v)}
                placeholder="Select position"
                options={(lookups.POSITION ?? []).map((o) => ({
                  value: o.value,
                  label: o.value,
                }))}
              />
            </Field>
            <Field label="Nationality">
              <CountrySelect
                value={fields.nationality}
                onChange={(v) => set("nationality", v)}
                placeholder="Select nationality"
              />
            </Field>
            <Field label="Gender">
              <Select
                value={fields.gender}
                onChange={(v) => set("gender", v)}
                searchable={false}
                placeholder="Not set"
                options={[
                  { value: "MALE", label: "Male" },
                  { value: "FEMALE", label: "Female" },
                ]}
              />
            </Field>
            <Field label="Date of birth">
              <input
                type="date"
                value={fields.dateOfBirth}
                onChange={(e) => set("dateOfBirth", e.target.value)}
                className="input w-full"
              />
            </Field>
            <Field label="Mobile number">
              <input
                value={fields.mobileNumber}
                onChange={(e) => set("mobileNumber", e.target.value)}
                placeholder="+9715…"
                className="input w-full"
              />
            </Field>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      {STEPS[step].key === "expiry" && (
        <div className="space-y-5">
          <Group title="Passport">
            <Field label="Passport number">
              <input
                value={fields.passportNumber}
                onChange={(e) => set("passportNumber", e.target.value)}
                className="input w-full"
              />
            </Field>
            <Field label="Passport expiry">
              <input
                type="date"
                value={fields.passportExpiry}
                onChange={(e) => set("passportExpiry", e.target.value)}
                className="input w-full"
              />
            </Field>
          </Group>

          <Group title="Emirates ID">
            <Field label="Emirates ID number">
              <input
                value={fields.emiratesId}
                onChange={(e) => set("emiratesId", e.target.value)}
                className="input w-full"
              />
            </Field>
            <Field label="Emirates ID expiry">
              <input
                type="date"
                value={fields.emiratesIdExpiry}
                onChange={(e) => set("emiratesIdExpiry", e.target.value)}
                className="input w-full"
              />
            </Field>
          </Group>

          <Group title="Labour card">
            <Field label="Labour card number">
              <input
                value={fields.laborCardNumber}
                onChange={(e) => set("laborCardNumber", e.target.value)}
                className="input w-full"
              />
            </Field>
            <Field label="Personal number">
              <input
                value={fields.laborCardPersonalNo}
                onChange={(e) => set("laborCardPersonalNo", e.target.value)}
                className="input w-full"
              />
            </Field>
            <Field label="Labour card expiry">
              <input
                type="date"
                value={fields.laborCardExpiry}
                onChange={(e) => set("laborCardExpiry", e.target.value)}
                className="input w-full"
              />
            </Field>
          </Group>

          <Group title="Other expiry dates">
            <Field label="Visa expiry">
              <input
                type="date"
                value={fields.visaExpiry}
                onChange={(e) => set("visaExpiry", e.target.value)}
                className="input w-full"
              />
            </Field>
            <Field label="Medical certificate expiry">
              <input
                type="date"
                value={fields.medicalExpiry}
                onChange={(e) => set("medicalExpiry", e.target.value)}
                className="input w-full"
              />
            </Field>
          </Group>
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      {STEPS[step].key === "assignment" && (
        <div className="space-y-5">
          <Group
            title="Company"
            description="The supplier employs the worker; the sponsorship company holds their visa. They're often different entities, so both are recorded."
          >
            <Field label="Supplier">
              <Select
                value={fields.supplierId}
                onChange={(v) => set("supplierId", v)}
                placeholder="No supplier assigned"
                options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
              />
            </Field>
            <Field label="Sponsorship company">
              <Select
                value={fields.sponsorshipCompanyId}
                onChange={(v) => set("sponsorshipCompanyId", v)}
                placeholder="Not set"
                options={sponsorshipCompanies.map((s) => ({
                  value: s.id,
                  label: s.name,
                }))}
              />
            </Field>
          </Group>

          <Group title="Deployment">
            <Field label="Project">
              <Select
                value={fields.projectId}
                onChange={(v) => set("projectId", v)}
                placeholder="Not deployed yet"
                options={projects.map((p) => ({
                  value: p.id,
                  label: `${p.code} — ${p.name}`,
                }))}
              />
            </Field>
            <Field label="Join date">
              <input
                type="date"
                value={fields.joinDate}
                onChange={(e) => set("joinDate", e.target.value)}
                className="input w-full"
              />
            </Field>
          </Group>

          <Group
            title="Salary"
            description="Reference only — billing rates come from the timesheet and invoice flow."
          >
            <Field label="Salary type">
              <Select
                value={fields.salaryType}
                onChange={(v) => set("salaryType", v)}
                placeholder="Not set"
                searchable={false}
                options={[
                  { value: "BASIC", label: "Basic salary" },
                  { value: "HOURLY", label: "Hourly rate" },
                ]}
              />
            </Field>
            {fields.salaryType && (
              <Field
                label={
                  fields.salaryType === "HOURLY"
                    ? "Hourly rate (AED)"
                    : "Basic salary (AED)"
                }
              >
                <input
                  type="number"
                  step="0.01"
                  value={fields.salaryRate}
                  onChange={(e) => set("salaryRate", e.target.value)}
                  className="input w-full"
                />
              </Field>
            )}
          </Group>
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      {STEPS[step].key === "extras" && (
        <div className="space-y-4">
          <Field label="Skills">
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
                placeholder="Add a skill and press Enter"
                className="input flex-1"
              />
              <button
                type="button"
                onClick={() => addSkill(skillInput)}
                className="btn btn-secondary"
              >
                Add
              </button>
            </div>
          </Field>

          {skills.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {skills.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSkills((arr) => arr.filter((x) => x !== s))}
                  aria-label={`Remove ${s}`}
                  className="inline-flex items-center gap-1.5 rounded-control bg-surface-sunken px-2.5 py-1 text-xs font-medium text-secondary transition hover:bg-[var(--border)]"
                >
                  {s} <span className="text-subtle">×</span>
                </button>
              ))}
            </div>
          )}

          <div>
            <p className="mb-1.5 text-xs text-subtle">Common trades:</p>
            <div className="flex flex-wrap gap-2">
              {COMMON_SKILLS.filter((s) => !skills.includes(s)).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => addSkill(s)}
                  className="text-xs text-muted transition hover:text-[var(--brand-primary)] hover:underline"
                >
                  + {s}
                </button>
              ))}
            </div>
          </div>

          <Field label="Notes">
            <textarea
              value={fields.notes}
              onChange={(e) => set("notes", e.target.value)}
              rows={3}
              placeholder="Medical conditions, special requirements, anything worth flagging…"
              className="input w-full"
            />
          </Field>
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      {STEPS[step].key === "review" && (
        <ReviewStep
          fields={fields}
          skills={skills}
          docFiles={docFiles}
          photo={photo}
          suppliers={suppliers}
          sponsorshipCompanies={sponsorshipCompanies}
          projects={projects}
          onEdit={(key) => goTo(STEPS.findIndex((s) => s.key === key))}
        />
      )}

      {/* Footer nav */}
      <div className="flex items-center justify-between border-t border-default pt-4">
        <button
          type="button"
          onClick={() => goTo(step - 1)}
          disabled={step === 0}
          className="btn btn-secondary"
        >
          Previous
        </button>
        {isLast ? (
          <button type="submit" disabled={pending} className="btn btn-primary">
            {pending ? "Registering…" : "Register employee"}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => goTo(step + 1)}
            className="btn btn-primary"
          >
            Next
          </button>
        )}
      </div>
    </form>
  );
}

function ReviewStep({
  fields,
  skills,
  docFiles,
  photo,
  suppliers,
  sponsorshipCompanies,
  projects,
  onEdit,
}: {
  fields: Fields;
  skills: string[];
  docFiles: Partial<Record<DocSlot, File>>;
  photo: File | null;
  suppliers: Supplier[];
  sponsorshipCompanies: SponsorshipCompany[];
  projects: Project[];
  onEdit: (key: (typeof STEPS)[number]["key"]) => void;
}) {
  const supplier = suppliers.find((s) => s.id === fields.supplierId);
  const sponsor = sponsorshipCompanies.find((s) => s.id === fields.sponsorshipCompanyId);
  const project = projects.find((p) => p.id === fields.projectId);
  const files = Object.entries(docFiles);

  const rows: [string, string | null][] = [
    ["Employee ID", fields.employeeIdNo],
    ["Name", fields.name],
    ["Category", fields.category === "STAFF" ? "Staff" : "Site Staff"],
    ["Position", fields.position],
    ["Nationality", fields.nationality],
    ["Date of birth", fields.dateOfBirth],
    ["Passport no.", fields.passportNumber],
    ["Emirates ID", fields.emiratesId],
    ["Labour card no.", fields.laborCardNumber],
    ["Supplier", supplier?.name ?? null],
    ["Sponsorship company", sponsor?.name ?? null],
    ["Project", project ? `${project.code} — ${project.name}` : null],
  ];

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Check the details before saving. Anything blank can be filled in later
        from the employee&rsquo;s page.
      </p>

      <div className="card divide-y divide-[var(--border)]">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-baseline gap-4 px-4 py-2">
            <span className="w-40 shrink-0 text-xs text-muted">{label}</span>
            <span
              className={cn(
                "min-w-0 flex-1 text-sm",
                value ? "text-primary" : "text-subtle"
              )}
            >
              {value || "Not set"}
            </span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="card card-padded">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-primary">Documents</h3>
            <button
              type="button"
              onClick={() => onEdit("documents")}
              className="text-xs font-medium text-[var(--brand-primary)] hover:underline"
            >
              Edit
            </button>
          </div>
          {files.length === 0 && !photo ? (
            <p className="mt-2 text-sm text-subtle">No files attached.</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm text-secondary">
              {photo && <li>Photo — {photo.name}</li>}
              {files.map(([slot, file]) => (
                <li key={slot}>
                  {slot === "COMBINED"
                    ? "Document pack"
                    : (DOC_LABEL[slot] ?? slot)}{" "}
                  — {file.name}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card card-padded">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-primary">Skills</h3>
            <button
              type="button"
              onClick={() => onEdit("extras")}
              className="text-xs font-medium text-[var(--brand-primary)] hover:underline"
            >
              Edit
            </button>
          </div>
          {skills.length === 0 ? (
            <p className="mt-2 text-sm text-subtle">None added.</p>
          ) : (
            <p className="mt-2 text-sm text-secondary">{skills.join(", ")}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function Group({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="text-sm font-semibold text-primary">{title}</h3>
      {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
      <div className="mt-2.5 grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="field-label">
        {label}
        {required && (
          <span className="ml-0.5 text-[var(--error)]" aria-hidden>
            *
          </span>
        )}
      </span>
      {children}
    </label>
  );
}
