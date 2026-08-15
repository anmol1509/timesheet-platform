"use client";

import {
  startTransition,
  useActionState,
  useEffect,
  useMemo,
  useState,
} from "react";
import { AlertTriangle, Check, Loader2, Sparkles, Wand2 } from "lucide-react";
import {
  checkEmployeeIdAction,
  createEmployeeAction,
  generateEmployeeIdAction,
} from "./actions";
import { MultiUploadSlot, PhotoSlot, UploadSlot, type UploadStatus } from "./upload-slot";
import { DocumentChecklist, type ChecklistItem } from "./document-checklist";
import type { ExtractedDocumentFields } from "@/app/api/documents/extract/route";
import { Select } from "@/components/ui/Select";
import { CountrySelect } from "@/components/ui/CountrySelect";
import { PhoneInput } from "@/components/ui/PhoneInput";
import { pdfPageToImage } from "@/lib/pdfPageToImage";
import { cn } from "@/lib/cn";

type Project = { id: string; name: string; code: string };
type SponsorshipCompany = { id: string; name: string };
type Supplier = { id: string; name: string };

const STEPS = [
  { key: "documents", label: "Documents" },
  { key: "company", label: "Company" },
  { key: "identity", label: "Identity" },
  { key: "expiry", label: "Numbers & expiry" },
  { key: "deployment", label: "Deployment" },
  { key: "extras", label: "Skills & notes" },
  { key: "review", label: "Review" },
] as const;

type StepKey = (typeof STEPS)[number]["key"];

const COMMON_SKILLS = [
  "Welding",
  "Carpentry",
  "Masonry",
  "Electrical Work",
  "Plumbing",
  "Heavy Machinery",
  "Safety Protocols",
];

const ADDITIONAL_DOC_TYPES = [
  { value: "VISA", label: "Visa" },
  { value: "RESIDENCY_ISSUANCE", label: "Residency & Identity Issuance" },
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
  RESIDENCY_ISSUANCE: "Residency issuance",
  PHOTO: "Photo",
};

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
  visaNumber: string;
  visaExpiry: string;
  unifiedNo: string;
  sponsorName: string;
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
  visaNumber: "",
  visaExpiry: "",
  unifiedNo: "",
  sponsorName: "",
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

/** Checklist fields that live on the Identity step; the rest are on Numbers & expiry. */
const IDENTITY_FIELDS = new Set(["name", "dateOfBirth", "nationality", "position"]);

type DocSlot =
  | "PASSPORT"
  | "EMIRATES_ID"
  | "LABOR_CARD"
  | "RESIDENCY_ISSUANCE"
  | "ADDITIONAL";

/** ICP forms print numbers as 00971556885010; store them in +971 form. */
function normalizePhone(value: string | null | undefined) {
  if (!value) return value;
  const digits = value.replace(/[^\d+]/g, "");
  return digits.startsWith("00") ? `+${digits.slice(2)}` : digits;
}

function isPast(iso: string) {
  if (!iso) return false;
  const d = new Date(iso);
  return !Number.isNaN(d.getTime()) && d.getTime() < Date.now();
}

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
  const [stepError, setStepError] = useState<string | null>(null);

  // Files live in state, not in the DOM, so a re-render can never discard them.
  const [packFiles, setPackFiles] = useState<File[]>([]);
  const [packStatus, setPackStatus] = useState<UploadStatus>({ kind: "idle" });
  const [docFiles, setDocFiles] = useState<Partial<Record<DocSlot, File>>>({});
  const [docStatus, setDocStatus] = useState<Partial<Record<DocSlot, UploadStatus>>>({});
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const [found, setFound] = useState<string[]>([]);
  const [autofilled, setAutofilled] = useState<string[]>([]);
  const [establishment, setEstablishment] = useState<string | null>(null);

  const [idBusy, setIdBusy] = useState(false);
  const [idNote, setIdNote] = useState<string | null>(null);
  const [idTaken, setIdTaken] = useState<{ taken: boolean; name: string | null }>({
    taken: false,
    name: null,
  });

  function set<K extends keyof Fields>(key: K, value: Fields[K]) {
    setFields((f) => ({ ...f, [key]: value }));
  }

  // A pack upload plus a round of corrections is real work, and the wizard
  // holds all of it in memory — a stray refresh or back-click used to bin it
  // silently, including the cost of re-reading the documents.
  const hasWork =
    packFiles.length > 0 ||
    Object.keys(docFiles).length > 0 ||
    !!photo ||
    fields.name !== "" ||
    fields.employeeIdNo !== "";
  useEffect(() => {
    if (!hasWork || pending) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasWork, pending]);

  // Flag a clashing employee ID while it's being typed, not on save.
  useEffect(() => {
    const id = fields.employeeIdNo.trim();
    if (!id) {
      setIdTaken({ taken: false, name: null });
      return;
    }
    const timer = setTimeout(async () => {
      try {
        setIdTaken(await checkEmployeeIdAction(id));
      } catch {
        // A failed check must never block the form.
      }
    }, 450);
    return () => clearTimeout(timer);
  }, [fields.employeeIdNo]);

  /** Writes extracted values into any field the user hasn't already filled. */
  function applyExtractedFields(data: ExtractedDocumentFields) {
    const filled: string[] = [];
    setFields((prev) => {
      const next = { ...prev };
      const put = (key: keyof Fields, value: string | null | undefined, label: string) => {
        if (!value) return;
        if (next[key]) return; // never clobber something already there
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
      put("visaNumber", data.visaNumber, "Residency file no.");
      put("visaExpiry", data.visaExpiry, "Residency expiry");
      put("unifiedNo", data.unifiedNo, "Unified no.");
      put("sponsorName", data.sponsorName ?? data.establishment, "Sponsor");
      put("mobileNumber", normalizePhone(data.mobileNumber), "Mobile number");
      return next;
    });
    if (data.establishment) setEstablishment(data.establishment);
    if (data.documentsFound?.length) {
      setFound((prev) => [...new Set([...prev, ...data.documentsFound!])]);
    }
    setAutofilled((prev) => [...new Set([...prev, ...filled])]);
    return filled.length;
  }

  async function extract(file: File, docType: string) {
    const body = new FormData();
    body.append("file", file);
    body.append("docType", docType);
    const res = await fetch("/api/documents/extract", { method: "POST", body });
    const payload = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(
        (payload && typeof payload.error === "string" && payload.error) ||
          `Couldn't read this document (${res.status}).`
      );
    }
    return payload as ExtractedDocumentFields;
  }

  /**
   * Lifts the worker's photo out of a pack that contains one, so registering
   * doesn't silently leave the profile picture empty. Never overrides a photo
   * the user picked themselves.
   */
  async function adoptPackPhoto(file: File, photoPage: string | null | undefined) {
    const page = Number(photoPage);
    if (!photoPage || !Number.isFinite(page) || page < 1) return;
    if (photo) return;
    try {
      const image = await pdfPageToImage(file, page);
      if (!image) return;
      setPhoto(image);
      setPhotoPreview(URL.createObjectURL(image));
      setFound((prev) => [...new Set([...prev, "PHOTO"])]);
    } catch {
      // A failed render just leaves the photo slot empty for a manual upload.
    }
  }

  async function readPack(files: File[]) {
    const readable = files.filter(
      (f) => f.type.startsWith("image/") || f.type === "application/pdf"
    );
    if (readable.length === 0) return;

    setPackStatus({ kind: "reading" });
    let total = 0;
    try {
      for (const file of readable) {
        const data = await extract(file, "COMBINED");
        total += applyExtractedFields(data);
        await adoptPackPhoto(file, data.photoPage);
      }
      setPackStatus({
        kind: "filled",
        message:
          total > 0
            ? `Read ${readable.length} file${readable.length === 1 ? "" : "s"} and filled ${total} field${total === 1 ? "" : "s"}.`
            : `Read ${readable.length} file${readable.length === 1 ? "" : "s"} — nothing new to add.`,
      });
    } catch (e) {
      setPackStatus({
        kind: "error",
        message: e instanceof Error ? e.message : "Couldn't read these documents.",
      });
    }
  }

  async function readSingle(slot: DocSlot, file: File) {
    if (!file.type.startsWith("image/") && file.type !== "application/pdf") return;
    setDocStatus((s) => ({ ...s, [slot]: { kind: "reading" } }));
    try {
      const data = await extract(file, slot === "ADDITIONAL" ? "" : slot);
      const count = applyExtractedFields(data);
      setDocStatus((s) => ({
        ...s,
        [slot]: {
          kind: "filled",
          message:
            count > 0
              ? `Filled ${count} field${count === 1 ? "" : "s"}.`
              : "Nothing new to add — existing values kept.",
        },
      }));
    } catch (e) {
      setDocStatus((s) => ({
        ...s,
        [slot]: {
          kind: "error",
          message: e instanceof Error ? e.message : "Couldn't read this document.",
        },
      }));
    }
  }

  async function generateId() {
    setIdBusy(true);
    setIdNote(null);
    try {
      const res = await generateEmployeeIdAction(
        fields.supplierId || null,
        fields.sponsorshipCompanyId || null
      );
      if (res.error || !res.id) {
        setIdNote(res.error ?? "Couldn't generate an ID.");
        return;
      }
      set("employeeIdNo", res.id);
      setIdNote(`Generated from ${res.source}.`);
    } finally {
      setIdBusy(false);
    }
  }

  function addSkill(name: string) {
    const trimmed = name.trim();
    if (!trimmed || skills.includes(trimmed)) return;
    setSkills((s) => [...s, trimmed]);
    setSkillInput("");
  }

  function validate(index: number): string | null {
    if (STEPS[index].key === "identity") {
      if (!fields.employeeIdNo.trim()) return "Employee ID is required.";
      if (!fields.name.trim()) return "Full name is required.";
      if (idTaken.taken) {
        return `Employee ID ${fields.employeeIdNo} already belongs to ${idTaken.name}.`;
      }
    }
    return null;
  }

  function goTo(index: number) {
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
    setStep(Math.max(0, Math.min(index, STEPS.length - 1)));
  }

  function goToKey(key: StepKey) {
    goTo(STEPS.findIndex((s) => s.key === key));
  }

  /** Jumps to whichever step owns a checklist field and puts the cursor in it. */
  function focusField(field: string) {
    goToKey(IDENTITY_FIELDS.has(field) ? "identity" : "expiry");
    // The step renders on this tick; focus once it's in the DOM.
    requestAnimationFrame(() => {
      const input = document.querySelector<HTMLElement>(`[data-field="${field}"]`);
      input?.scrollIntoView({ behavior: "smooth", block: "center" });
      input?.focus();
    });
  }

  // Checklist of the documents a complete file is expected to contain.
  const documentItems: ChecklistItem[] = useMemo(() => {
    const has = (type: string, file?: File) => found.includes(type) || !!file;
    return [
      {
        key: "PASSPORT",
        label: "Passport",
        done: has("PASSPORT", docFiles.PASSPORT),
        detail: fields.passportNumber || null,
      },
      // The residency issuance notice is what a worker has *before* the
      // Emirates ID card is printed, so either one satisfies this row —
      // demanding both would flag every newly-sponsored worker as incomplete.
      {
        key: "EMIRATES_ID",
        label: "Emirates ID or residency issuance",
        done:
          has("EMIRATES_ID", docFiles.EMIRATES_ID) ||
          has("RESIDENCY_ISSUANCE", docFiles.RESIDENCY_ISSUANCE),
        detail: fields.emiratesId
          ? fields.emiratesId
          : has("RESIDENCY_ISSUANCE", docFiles.RESIDENCY_ISSUANCE)
            ? fields.visaNumber
              ? `Residency issuance — file ${fields.visaNumber}`
              : "Residency issuance — card not issued yet"
            : null,
      },
      {
        key: "LABOR_CARD",
        label: "Labour card",
        done: has("LABOR_CARD", docFiles.LABOR_CARD),
        detail: fields.laborCardNumber || null,
      },
      {
        key: "PHOTO",
        label: "Profile photo",
        // Only a real file counts. The pack reporting that it *contains* a
        // photograph isn't the same as having one saved against the employee,
        // and ticking on that basis hid the fact that no photo was stored.
        done: !!photo,
        detail: photo
          ? photo.name
          : found.includes("PHOTO")
            ? "Found in the pack — extracting…"
            : null,
      },
    ];
  }, [found, docFiles, photo, fields]);

  // Checklist of the values that matter downstream (compliance, invoicing).
  const fieldItems: ChecklistItem[] = useMemo(() => {
    // Before the card is printed the residency file number and its expiry are
    // what stand in for the Emirates ID pair, so those rows follow whichever
    // document this worker actually has.
    const onResidency = !fields.emiratesId && !!fields.visaNumber;
    return (
      [
        { key: "name", label: "Full name", value: fields.name },
        { key: "dateOfBirth", label: "Date of birth", value: fields.dateOfBirth },
        { key: "nationality", label: "Nationality", value: fields.nationality },
        { key: "position", label: "Position / trade", value: fields.position },
        { key: "passportNumber", label: "Passport number", value: fields.passportNumber },
        {
          key: "passportExpiry",
          label: "Passport expiry",
          value: fields.passportExpiry,
          expiry: true,
        },
        {
          key: "emiratesId",
          label: onResidency ? "Residency file no." : "Emirates ID",
          value: onResidency ? fields.visaNumber : fields.emiratesId,
        },
        {
          key: "emiratesIdExpiry",
          label: onResidency ? "Residency expiry" : "Emirates ID expiry",
          value: onResidency ? fields.visaExpiry : fields.emiratesIdExpiry,
          expiry: true,
        },
        { key: "laborCardNumber", label: "Labour card no.", value: fields.laborCardNumber },
        {
          key: "laborCardExpiry",
          label: "Labour card expiry",
          value: fields.laborCardExpiry,
          expiry: true,
        },
      ].map((f) => ({
        key: f.key,
        label: f.label,
        done: !!f.value,
        detail: f.value || null,
        warning:
          f.expiry && f.value && isPast(f.value)
            ? `Expired ${new Date(f.value).toLocaleDateString("en-GB")}`
            : null,
        editValue: (f.value as string) || "",
      }))
    );
  }, [fields]);

  /**
   * Maps a checklist row back to the field it came from. The Emirates ID rows
   * switch targets depending on whether this worker has a card or the
   * residency form, so the mapping can't just be the key.
   */
  function checklistFieldFor(key: string): keyof Fields {
    const onResidency = !fields.emiratesId && !!fields.visaNumber;
    if (key === "emiratesId") return onResidency ? "visaNumber" : "emiratesId";
    if (key === "emiratesIdExpiry") return onResidency ? "visaExpiry" : "emiratesIdExpiry";
    return key as keyof Fields;
  }

  const completed = useMemo(() => {
    const done = new Set<number>();
    STEPS.forEach((s, i) => {
      if (s.key === "company" && (fields.supplierId || fields.sponsorshipCompanyId)) done.add(i);
      if (s.key === "documents" && (packFiles.length > 0 || Object.keys(docFiles).length > 0))
        done.add(i);
      if (s.key === "identity" && fields.employeeIdNo && fields.name && !idTaken.taken)
        done.add(i);
      if (s.key === "expiry" && (fields.passportNumber || fields.emiratesId)) done.add(i);
      if (s.key === "deployment" && (fields.projectId || fields.joinDate)) done.add(i);
      if (s.key === "extras" && (skills.length > 0 || fields.notes)) done.add(i);
    });
    return done;
  }, [fields, packFiles, docFiles, skills, idTaken]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const identityIndex = STEPS.findIndex((s) => s.key === "identity");
    const error = validate(identityIndex);
    if (error) {
      setStep(identityIndex);
      setStepError(error);
      return;
    }

    const body = new FormData();
    for (const [key, value] of Object.entries(fields)) {
      if (value) body.set(key, value);
    }
    body.set("skills", skills.join(","));
    // Residency granted but no card number yet — record that explicitly rather
    // than leaving the Emirates ID silently blank.
    const hasResidency =
      found.includes("RESIDENCY_ISSUANCE") || !!docFiles.RESIDENCY_ISSUANCE;
    if (hasResidency && !fields.emiratesId) body.set("eidStatus", "APPLIED");
    if (photo) body.set("photo", photo);
    packFiles.forEach((file, i) => {
      body.append("docFile_PACK", file);
      // Label the first pack file with whatever the pack resolved to.
      body.set(`packType_${i}`, i === 0 ? (found[0] ?? "OTHER") : "OTHER");
    });
    for (const [slot, file] of Object.entries(docFiles)) {
      if (file) body.set(`docFile_${slot}`, file);
    }
    startTransition(() => formAction(body));
  }

  // Advancing mid-read shows empty fields that then fill in behind you.
  const reading =
    packStatus.kind === "reading" ||
    Object.values(docStatus).some((st) => st?.kind === "reading");
  const isLast = step === STEPS.length - 1;
  const stepKey = STEPS[step].key;

  const supplierName = suppliers.find((s) => s.id === fields.supplierId)?.name;
  const establishmentUnmatched =
    establishment &&
    !suppliers.some(
      (s) => s.name.toLowerCase().replace(/\s+/g, "") === establishment.toLowerCase().replace(/\s+/g, "")
    );

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
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
                        ? "bg-[var(--success-soft)] text-[var(--success)] hover:brightness-95"
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

      {/* ---------------- Company ---------------- */}
      {stepKey === "company" && (
        <div className="space-y-4">
          <p className="text-sm text-muted">
            The employee ID on the next step is generated from this
            company&rsquo;s initials. The supplier employs the worker; the
            sponsorship company holds their visa.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                options={sponsorshipCompanies.map((s) => ({ value: s.id, label: s.name }))}
              />
            </Field>
          </div>

          {establishmentUnmatched && (
            <div className="flex items-start gap-2.5 rounded-control border border-[var(--warning-border)] bg-[var(--warning-soft)] px-3 py-2.5">
              <AlertTriangle
                className="mt-0.5 h-4 w-4 shrink-0 text-[var(--warning)]"
                aria-hidden
              />
              <p className="text-sm text-secondary">
                The labour card lists{" "}
                <span className="font-medium text-primary">{establishment}</span> as
                the employer, but there&rsquo;s no matching supplier. Add it under
                Business Partners first, or pick the closest match above.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ---------------- Documents ---------------- */}
      {stepKey === "documents" && (
        <div className="space-y-4">
          <div className="rounded-card border border-[var(--brand-primary-border)] bg-brand-soft p-4">
            <div className="flex items-start gap-2.5">
              <Sparkles
                className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand-primary)]"
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-primary">
                  Upload the document pack
                </p>
                <p className="mt-0.5 text-xs text-secondary">
                  Passport, Emirates ID and labour card — as one PDF or as
                  several files. Everything readable is filled in for you.
                </p>
                <div className="mt-3">
                  <MultiUploadSlot
                    id="doc-pack"
                    label="Document pack"
                    files={packFiles}
                    status={packStatus}
                    onAdd={(picked) => {
                      setPackFiles((prev) => [...prev, ...picked]);
                      void readPack(picked);
                    }}
                    onRemove={(i) =>
                      setPackFiles((prev) => prev.filter((_, idx) => idx !== i))
                    }
                  />
                </div>
              </div>
            </div>
          </div>

          <DocumentChecklist
            title="Documents found"
            items={documentItems}
            fixLabel="Upload"
            onFix={() => {
              const details = document.getElementById("separate-uploads");
              if (details instanceof HTMLDetailsElement) details.open = true;
              details?.scrollIntoView({ behavior: "smooth", block: "center" });
            }}
          />

          <details id="separate-uploads" className="rounded-card border border-default">
            <summary className="cursor-pointer px-4 py-2.5 text-sm font-medium text-secondary">
              Upload documents individually
            </summary>
            <div className="grid grid-cols-1 gap-4 border-t border-default p-4 sm:grid-cols-2">
              <UploadSlot
                id="doc-passport"
                label="Passport"
                file={docFiles.PASSPORT ?? null}
                status={docStatus.PASSPORT ?? { kind: "idle" }}
                onSelect={(f) => {
                  if (!f) return;
                  setDocFiles((d) => ({ ...d, PASSPORT: f }));
                  void readSingle("PASSPORT", f);
                }}
                onClear={() =>
                  setDocFiles((d) => {
                    const n = { ...d };
                    delete n.PASSPORT;
                    return n;
                  })
                }
              />
              <UploadSlot
                id="doc-eid"
                label="Emirates ID"
                file={docFiles.EMIRATES_ID ?? null}
                status={docStatus.EMIRATES_ID ?? { kind: "idle" }}
                onSelect={(f) => {
                  if (!f) return;
                  setDocFiles((d) => ({ ...d, EMIRATES_ID: f }));
                  void readSingle("EMIRATES_ID", f);
                }}
                onClear={() =>
                  setDocFiles((d) => {
                    const n = { ...d };
                    delete n.EMIRATES_ID;
                    return n;
                  })
                }
              />
              <UploadSlot
                id="doc-labour"
                label="Labour card"
                file={docFiles.LABOR_CARD ?? null}
                status={docStatus.LABOR_CARD ?? { kind: "idle" }}
                onSelect={(f) => {
                  if (!f) return;
                  setDocFiles((d) => ({ ...d, LABOR_CARD: f }));
                  void readSingle("LABOR_CARD", f);
                }}
                onClear={() =>
                  setDocFiles((d) => {
                    const n = { ...d };
                    delete n.LABOR_CARD;
                    return n;
                  })
                }
              />
              <UploadSlot
                id="doc-residency"
                label="Residency & identity issuance"
                hint="Use this when the Emirates ID card hasn't been printed yet."
                file={docFiles.RESIDENCY_ISSUANCE ?? null}
                status={docStatus.RESIDENCY_ISSUANCE ?? { kind: "idle" }}
                onSelect={(f) => {
                  if (!f) return;
                  setDocFiles((d) => ({ ...d, RESIDENCY_ISSUANCE: f }));
                  void readSingle("RESIDENCY_ISSUANCE", f);
                }}
                onClear={() =>
                  setDocFiles((d) => {
                    const n = { ...d };
                    delete n.RESIDENCY_ISSUANCE;
                    return n;
                  })
                }
              />
              <PhotoSlot
                id="doc-photo"
                file={photo}
                preview={photoPreview}
                onSelect={(f) => {
                  setPhoto(f);
                  setPhotoPreview(f ? URL.createObjectURL(f) : null);
                }}
                onClear={() => {
                  setPhoto(null);
                  setPhotoPreview(null);
                }}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 border-t border-default p-4 sm:grid-cols-3">
              <UploadSlot
                id="doc-additional"
                label="Another document"
                hint="Visa, medical, CICPA, insurance…"
                file={docFiles.ADDITIONAL ?? null}
                status={docStatus.ADDITIONAL ?? { kind: "idle" }}
                onSelect={(f) => {
                  if (!f) return;
                  setDocFiles((d) => ({ ...d, ADDITIONAL: f }));
                  void readSingle("ADDITIONAL", f);
                }}
                onClear={() =>
                  setDocFiles((d) => {
                    const n = { ...d };
                    delete n.ADDITIONAL;
                    return n;
                  })
                }
              />
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
          </details>

          {autofilled.length > 0 && (
            <p className="text-xs text-muted">
              <span className="font-medium text-[var(--success)]">Auto-filled:</span>{" "}
              {autofilled.join(", ")}
            </p>
          )}
        </div>
      )}

      {/* ---------------- Identity ---------------- */}
      {stepKey === "identity" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Employee ID No" required>
              <div className="flex gap-2">
                <input
                  value={fields.employeeIdNo}
                  onChange={(e) => set("employeeIdNo", e.target.value)}
                  placeholder="e.g. PTTFC112"
                  aria-invalid={idTaken.taken || undefined}
                  className="input w-full"
                />
                <button
                  type="button"
                  onClick={generateId}
                  disabled={idBusy}
                  title="Generate from the selected company"
                  className="btn btn-secondary shrink-0"
                >
                  {idBusy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  ) : (
                    <Wand2 className="h-3.5 w-3.5" aria-hidden />
                  )}
                  Generate
                </button>
              </div>
              {idTaken.taken ? (
                <span className="field-error block">
                  Already used by {idTaken.name}. Pick another or generate one.
                </span>
              ) : idNote ? (
                <span className="field-help block">{idNote}</span>
              ) : (
                <span className="field-help block">
                  {supplierName
                    ? `Generate builds it from “${supplierName}”.`
                    : "Pick a company on the first step to generate this."}
                </span>
              )}
            </Field>

            <Field label="Full name" required>
              <input
                data-field="name"
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
                data-field="dateOfBirth"
                value={fields.dateOfBirth}
                onChange={(e) => set("dateOfBirth", e.target.value)}
                className="input w-full"
              />
            </Field>
            <Field label="Mobile number">
              <PhoneInput
                value={fields.mobileNumber}
                onChange={(v) => set("mobileNumber", v)}
              />
            </Field>
          </div>
        </div>
      )}

      {/* ---------------- Numbers & expiry ---------------- */}
      {stepKey === "expiry" && (
        <div className="space-y-5">
          <DocumentChecklist
            title="Details read from documents"
            items={fieldItems}
            onEdit={(key, value) => set(checklistFieldFor(key), value)}
            editType={(key) => (key.toLowerCase().includes("expiry") || key === "dateOfBirth" ? "date" : "text")}
          />

          <Group title="Passport">
            <Field label="Passport number">
              <input
                data-field="passportNumber"
                value={fields.passportNumber}
                onChange={(e) => set("passportNumber", e.target.value)}
                className="input w-full"
              />
            </Field>
            <Field label="Passport expiry">
              <input
                type="date"
                data-field="passportExpiry"
                value={fields.passportExpiry}
                onChange={(e) => set("passportExpiry", e.target.value)}
                className="input w-full"
              />
            </Field>
          </Group>

          <Group title="Emirates ID">
            <Field label="Emirates ID number">
              <input
                data-field="emiratesId"
                value={fields.emiratesId}
                onChange={(e) => set("emiratesId", e.target.value)}
                className="input w-full"
              />
            </Field>
            <Field label="Emirates ID expiry">
              <input
                type="date"
                data-field="emiratesIdExpiry"
                value={fields.emiratesIdExpiry}
                onChange={(e) => set("emiratesIdExpiry", e.target.value)}
                className="input w-full"
              />
            </Field>
          </Group>

          <Group title="Labour card">
            <Field label="Labour card number">
              <input
                data-field="laborCardNumber"
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
                data-field="laborCardExpiry"
                value={fields.laborCardExpiry}
                onChange={(e) => set("laborCardExpiry", e.target.value)}
                className="input w-full"
              />
            </Field>
          </Group>

          <Group
            title="Residency / visa"
            description="Filled from the residency issuance notice when the Emirates ID card hasn't been printed yet."
          >
            <Field label="Residency file number">
              <input
                value={fields.visaNumber}
                onChange={(e) => set("visaNumber", e.target.value)}
                className="input w-full"
              />
            </Field>
            <Field label="Unified number">
              <input
                value={fields.unifiedNo}
                onChange={(e) => set("unifiedNo", e.target.value)}
                className="input w-full"
              />
            </Field>
            <Field label="Residency / visa expiry">
              <input
                type="date"
                value={fields.visaExpiry}
                onChange={(e) => set("visaExpiry", e.target.value)}
                className="input w-full"
              />
            </Field>
            <Field label="Sponsor">
              <input
                value={fields.sponsorName}
                onChange={(e) => set("sponsorName", e.target.value)}
                className="input w-full"
              />
            </Field>
          </Group>

          <Group title="Other expiry dates">
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

      {/* ---------------- Deployment ---------------- */}
      {stepKey === "deployment" && (
        <div className="space-y-5">
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

      {/* ---------------- Skills & notes ---------------- */}
      {stepKey === "extras" && (
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

      {/* ---------------- Review ---------------- */}
      {stepKey === "review" && (
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Check the details before saving. Anything blank can be filled in
            later from the employee&rsquo;s page.
          </p>

          <DocumentChecklist
            title="Documents"
            items={documentItems}
            columns={2}
            fixLabel="Upload"
            onFix={() => goToKey("documents")}
          />
          <DocumentChecklist
            title="Details"
            items={fieldItems}
            columns={2}
            fixLabel="Fill"
            onFix={focusField}
          />

          {/* Editable rather than a read-only recap: this is the last place to
              catch a wrong supplier or project, and walking back through the
              wizard to change one is friction nobody needs. */}
          <div className="card divide-y divide-[var(--border)]">
            <ReviewRow label="Employee ID">
              <input
                value={fields.employeeIdNo}
                onChange={(e) => set("employeeIdNo", e.target.value)}
                aria-invalid={idTaken.taken || undefined}
                className="input w-full"
              />
              {idTaken.taken && (
                <span className="field-error block">
                  Already used by {idTaken.name}.
                </span>
              )}
            </ReviewRow>

            <ReviewRow label="Supplier">
              <Select
                value={fields.supplierId}
                onChange={(v) => set("supplierId", v)}
                placeholder="No supplier assigned"
                options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
              />
            </ReviewRow>

            <ReviewRow label="Sponsorship company">
              <Select
                value={fields.sponsorshipCompanyId}
                onChange={(v) => set("sponsorshipCompanyId", v)}
                placeholder="Not set"
                options={sponsorshipCompanies.map((s) => ({ value: s.id, label: s.name }))}
              />
            </ReviewRow>

            <ReviewRow label="Project">
              <Select
                value={fields.projectId}
                onChange={(v) => set("projectId", v)}
                placeholder="Not deployed yet"
                options={projects.map((p) => ({
                  value: p.id,
                  label: `${p.code} — ${p.name}`,
                }))}
              />
            </ReviewRow>

            <ReviewRow label="Skills">
              <div className="flex flex-wrap items-center gap-1.5">
                {skills.map((skill) => (
                  <button
                    key={skill}
                    type="button"
                    onClick={() => setSkills((arr) => arr.filter((x) => x !== skill))}
                    aria-label={`Remove ${skill}`}
                    className="inline-flex items-center gap-1.5 rounded-control bg-surface-sunken px-2.5 py-1 text-xs font-medium text-secondary transition hover:bg-[var(--border)]"
                  >
                    {skill} <span className="text-subtle">×</span>
                  </button>
                ))}
                <input
                  value={skillInput}
                  onChange={(e) => setSkillInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addSkill(skillInput);
                    }
                  }}
                  placeholder={skills.length ? "Add another…" : "Add a skill and press Enter"}
                  className="input h-8 flex-1 py-1 text-xs"
                />
              </div>
            </ReviewRow>
          </div>

          <div className="card card-padded">
            <h3 className="text-sm font-semibold text-primary">Files to attach</h3>
            {packFiles.length === 0 && Object.keys(docFiles).length === 0 && !photo ? (
              <p className="mt-2 text-sm text-subtle">No files attached.</p>
            ) : (
              <ul className="mt-2 space-y-1 text-sm text-secondary">
                {photo && <li>Profile photo — {photo.name}</li>}
                {packFiles.map((f, i) => (
                  <li key={`pack-${i}`}>Document pack — {f.name}</li>
                ))}
                {Object.entries(docFiles).map(([slot, f]) => (
                  <li key={slot}>
                    {DOC_LABEL[slot] ?? slot} — {f.name}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

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
            disabled={reading}
            title={reading ? "Still reading the documents…" : undefined}
            className="btn btn-primary"
          >
            {reading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Reading…
              </>
            ) : (
              "Next"
            )}
          </button>
        )}
      </div>
    </form>
  );
}

function ReviewRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 px-4 py-2.5 sm:flex-row sm:items-center sm:gap-4">
      <span className="w-40 shrink-0 text-xs text-muted">{label}</span>
      <div className="min-w-0 flex-1">{children}</div>
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
