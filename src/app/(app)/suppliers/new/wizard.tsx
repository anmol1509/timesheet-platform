"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, FileText, Loader2, Sparkles, X } from "lucide-react";
import { Select } from "@/components/ui/Select";
import { ComboSelect } from "@/components/ui/ComboSelect";
import { DatePicker } from "@/components/ui/DatePicker";
import { CountrySelect } from "@/components/ui/CountrySelect";
import { CitySelect } from "@/components/ui/CitySelect";
import { PhoneField } from "@/components/ui/PhoneField";
import { SUPPLIER_CATEGORIES } from "@/lib/formLists";
import { cn } from "@/lib/cn";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from "@/lib/constants";
import { MAX_REQUEST_BYTES, shrinkImage } from "@/lib/compressImage";
import type { ExtractedCompanyFields } from "@/app/api/documents/extract-company/route";
import { MultiUploadSlot, UploadSlot, type UploadStatus } from "@/app/(app)/employees/new/upload-slot";
import { DocumentChecklist, type ChecklistItem } from "@/app/(app)/employees/new/document-checklist";
import { createSupplierWizardAction } from "./actions";
import { suggestSupplierCodeAction } from "../actions";

const STEPS = ["Documents", "Details", "Review"] as const;
const DOC_TYPES = [
  { value: "TRADE_LICENSE", label: "Trade licence" },
  { value: "MOHRE_PERMIT", label: "MOHRE permit" },
  { value: "ESTABLISHMENT_CARD", label: "MOHRE establishment card" },
  { value: "TRN_CERTIFICATE", label: "TRN / VAT certificate" },
  { value: "WORKMEN_COMPENSATION_INSURANCE", label: "Workmen compensation insurance" },
  { value: "EJARI_TENANCY", label: "Ejari / tenancy contract" },
  { value: "CHAMBER_OF_COMMERCE", label: "Chamber of commerce" },
  { value: "OTHER", label: "Other" },
];
const typeLabel = (v: string) => DOC_TYPES.find((d) => d.value === v)?.label ?? "Other";

type Values = {
  name: string; code: string; fullName: string; category: string; trn: string; activeFrom: string; mohrePermitNumber: string;
  tradeLicenseNumber: string; tradeLicenseExpiry: string; country: string; emirate: string; contactPerson: string; contactPhone: string; contactEmail: string;
};
const EMPTY: Values = {
  name: "", code: "", fullName: "", category: "", trn: "", activeFrom: "", mohrePermitNumber: "", tradeLicenseNumber: "", tradeLicenseExpiry: "",
  country: "United Arab Emirates", emirate: "", contactPerson: "", contactPhone: "", contactEmail: "",
};
type Doc = { id: number; file: File; docType: string; expiry: string; status: "reading" | "read" | "failed"; error?: string; /** Picked in its own slot, so reading must not change the type. */ fixedType?: boolean };

/** What a complete supplier file is expected to contain; each row ticks when a document of that type has been read or added. */
const EXPECTED = [
  { type: "TRADE_LICENSE", label: "Trade licence" },
  { type: "MOHRE_PERMIT", label: "MOHRE manpower supply permit" },
  { type: "TRN_CERTIFICATE", label: "TRN / VAT certificate" },
  { type: "ESTABLISHMENT_CARD", label: "MOHRE establishment card" },
] as const;

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
      {children}
    </label>
  );
}

export function SupplierWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [v, setV] = useState<Values>(EMPTY);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [read, setRead] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const nextId = useRef(1);
  const set = (k: keyof Values) => (val: string) => setV((p) => ({ ...p, [k]: val }));

  /** Fills only what is still empty, so a value someone typed is never overwritten by a misread. */
  function fill(d: ExtractedCompanyFields) {
    const filled: string[] = [];
    setV((p) => {
      const next = { ...p };
      const put = (k: keyof Values, val: string | undefined, label: string) => {
        const t = (val ?? "").trim();
        if (t && !next[k]) { next[k] = t; filled.push(label); }
      };
      put("name", d.companyName, "Name");
      put("fullName", d.companyName?.toUpperCase(), "Full name");
      put("trn", d.trn?.replace(/\D/g, ""), "TRN");
      put("tradeLicenseNumber", d.tradeLicenseNumber, "Licence no.");
      put("tradeLicenseExpiry", d.tradeLicenseExpiry || (d.docType === "TRADE_LICENSE" ? d.documentExpiry : ""), "Licence expiry");
      put("activeFrom", d.issueDate, "Active from");
      put("mohrePermitNumber", d.mohrePermitNumber, "MOHRE permit");
      put("emirate", d.emirate, "Emirate");
      put("contactPhone", d.phone, "Phone");
      put("contactEmail", d.email, "Email");
      return next;
    });
    return filled;
  }

  async function readDoc(doc: Doc) {
    const body = new FormData();
    body.append("file", doc.file);
    try {
      const res = await fetch("/api/documents/extract-company", { method: "POST", body });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error((payload && typeof payload.error === "string" && payload.error) || `Couldn't read this document (${res.status}).`);
      const d = payload as ExtractedCompanyFields;
      const known = DOC_TYPES.some((t) => t.value === d.docType) ? d.docType! : "OTHER";
      setDocs((p) => p.map((x) => (x.id === doc.id ? { ...x, status: "read", docType: x.fixedType ? x.docType : known, expiry: d.documentExpiry || (known === "TRADE_LICENSE" ? d.tradeLicenseExpiry || "" : "") } : x)));
      const filled = fill(d);
      if (filled.length) setRead((p) => [...new Set([...p, ...filled])]);
    } catch (e) {
      setDocs((p) => p.map((x) => (x.id === doc.id ? { ...x, status: "failed", error: e instanceof Error ? e.message : "Couldn't read this document." } : x)));
    }
  }

  async function addFiles(list: File[] | FileList | null, fixedType?: string) {
    if (!list) return;
    const added: Doc[] = [];
    for (const file of Array.from(list)) {
      if (file.size > MAX_UPLOAD_BYTES) { setError(`${file.name} is over ${MAX_UPLOAD_LABEL}.`); continue; }
      added.push({ id: nextId.current++, file, docType: fixedType ?? "OTHER", expiry: "", status: "reading", fixedType: !!fixedType });
    }
    if (!added.length) return;
    setError(null);
    // A slot holds one file: picking again replaces what was there.
    setDocs((p) => [...(fixedType ? p.filter((x) => x.docType !== fixedType) : p), ...added]);
    for (const d of added) await readDoc(d);
  }

  const slotDoc = (type: string) => docs.find((d) => d.docType === type) ?? null;
  const slotStatus = (type: string): UploadStatus => {
    const d = slotDoc(type);
    if (!d) return { kind: "idle" };
    return d.status === "reading" ? { kind: "reading" } : d.status === "failed" ? { kind: "error", message: d.error ?? "Couldn't read this document." } : { kind: "filled", message: "Read" };
  };
  const checklist: ChecklistItem[] = EXPECTED.map((e) => ({
    key: e.type,
    label: e.label,
    done: docs.some((d) => d.docType === e.type && d.status !== "failed"),
    detail: e.type === "TRADE_LICENSE" ? v.tradeLicenseNumber || null : e.type === "MOHRE_PERMIT" ? v.mohrePermitNumber || null : e.type === "TRN_CERTIFICATE" ? v.trn || null : null,
  }));

  function next() {
    setError(null);
    if (step === 1) {
      if (!v.name.trim()) return setError("Enter the supplier name.");
      if (v.trn && !/^\d{15}$/.test(v.trn.replace(/\s|-/g, ""))) return setError("A TRN is 15 digits.");
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  async function create() {
    setError(null);
    // The documents travel together in one request, so their total has to fit, not just each file.
    const sized = await Promise.all(docs.map(async (d) => (d.file.type.startsWith("image/") ? { ...d, file: await shrinkImage(d.file) } : d)));
    const total = sized.reduce((n, d) => n + d.file.size, 0);
    if (total > MAX_REQUEST_BYTES) {
      return setError(`The documents add up to ${(total / 1024 / 1024).toFixed(1)}MB; ${(MAX_REQUEST_BYTES / 1024 / 1024).toFixed(1)}MB is the most that can be saved at once. Remove or compress a document, then add the rest from the supplier's page after saving.`);
    }
    const fd = new FormData();
    (Object.keys(v) as (keyof Values)[]).forEach((k) => fd.append(k, v[k]));
    sized.forEach((d) => { fd.append("files", d.file); fd.append("docTypes", d.docType); fd.append("docExpiries", d.expiry); });
    start(async () => {
      try {
        const res = await createSupplierWizardAction(fd);
        if (res.error) setError(res.error);
        else router.push(`/suppliers/${res.id}`);
      } catch {
        setError("The supplier couldn't be saved. Check your connection and try again.");
      }
    });
  }

  const reading = docs.some((d) => d.status === "reading");

  return (
    <div className="space-y-6">
      <nav aria-label="Progress" className="border-b border-default pb-3">
        <ol className="flex flex-wrap gap-1.5">
          {STEPS.map((label, i) => {
            const active = i === step;
            const done = i < step;
            return (
              <li key={label}>
                <button
                  type="button"
                  onClick={() => i <= step && setStep(i)}
                  aria-current={active ? "step" : undefined}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-control px-2.5 py-1.5 text-xs font-medium transition",
                    active ? "bg-[var(--brand-primary)] text-white" : done ? "bg-[var(--success-soft)] text-[var(--success)] hover:brightness-95" : "text-muted hover:bg-surface-hover hover:text-primary"
                  )}
                >
                  {done ? <Check className="h-3 w-3" aria-hidden /> : <span className="tabular text-[10px] opacity-70">{i + 1}</span>}
                  {label}
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      {step === 0 && (
        <div className="space-y-4">
          <div className="rounded-card border border-[var(--brand-primary-border)] bg-brand-soft p-4">
            <div className="flex items-start gap-2.5">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand-primary)]" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-primary">Upload the document pack</p>
                <p className="mt-0.5 text-xs text-secondary">
                  Trade licence, MOHRE permit, TRN certificate and anything else you have — as one PDF or as several files. Everything readable is filled in for you.
                </p>
                <div className="mt-3">
                  <MultiUploadSlot
                    id="supplier-doc-pack"
                    label="Document pack"
                    files={[]}
                    status={reading ? { kind: "reading" } : { kind: "idle" }}
                    hint={`PDF or images, up to ${MAX_UPLOAD_LABEL} each. You can select several files at once.`}
                    onAdd={(picked) => void addFiles(picked)}
                    onRemove={() => undefined}
                  />
                </div>
              </div>
            </div>
          </div>

          <DocumentChecklist
            title="Documents found"
            items={checklist}
            fixLabel="Upload"
            onFix={() => {
              const details = document.getElementById("supplier-separate-uploads");
              if (details instanceof HTMLDetailsElement) details.open = true;
              details?.scrollIntoView({ behavior: "smooth", block: "center" });
            }}
          />

          {docs.length > 0 && (
            <ul className="divide-y divide-[var(--border)] rounded-card border border-default">
              {docs.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <FileText className="h-4 w-4 shrink-0 text-muted" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-primary">{d.file.name}</p>
                    <p className={cn("text-xs", d.status === "failed" ? "text-[var(--error)]" : "text-muted")}>
                      {d.status === "reading" ? "Reading…" : d.status === "failed" ? d.error : `Read as ${typeLabel(d.docType)}`}
                    </p>
                  </div>
                  {d.status === "reading" ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted" aria-label="Reading" />
                  ) : (
                    <div className="w-56">
                      <Select value={d.docType} onChange={(t) => setDocs((p) => p.map((x) => (x.id === d.id ? { ...x, docType: t } : x)))} searchable={false} options={DOC_TYPES} />
                    </div>
                  )}
                  <button type="button" aria-label={`Remove ${d.file.name}`} className="text-muted hover:text-primary" onClick={() => setDocs((p) => p.filter((x) => x.id !== d.id))}>
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <details id="supplier-separate-uploads" className="rounded-card border border-default">
            <summary className="cursor-pointer px-4 py-2.5 text-sm font-medium text-secondary">Upload documents individually</summary>
            <div className="grid grid-cols-1 gap-4 border-t border-default p-4 sm:grid-cols-2">
              {DOC_TYPES.filter((t) => t.value !== "OTHER").map((t) => (
                <UploadSlot
                  key={t.value}
                  id={`supplier-doc-${t.value}`}
                  label={t.label}
                  file={slotDoc(t.value)?.file ?? null}
                  status={slotStatus(t.value)}
                  onSelect={(f) => { if (f) void addFiles([f], t.value); }}
                  onClear={() => setDocs((p) => p.filter((x) => x.docType !== t.value))}
                />
              ))}
            </div>
          </details>

          {read.length > 0 && (
            <p className="text-xs text-muted">
              <span className="font-medium text-[var(--success)]">Auto-filled:</span> {read.join(", ")}. You can check and change everything on the next step.
            </p>
          )}
          <p className="text-xs text-muted">No documents to hand? You can skip this step and type the details in.</p>
        </div>
      )}

      {step === 1 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Supplier name *"><input className="input w-full" value={v.name} onChange={(e) => set("name")(e.target.value)} placeholder="e.g. ABCD" /></Field>
          <Field label="Full name (for letterhead)"><input className="input w-full" value={v.fullName} onChange={(e) => set("fullName")(e.target.value)} placeholder="e.g. GULF SKILLS GENERAL CONTRACTING" /></Field>
          <Field label="Supplier code">
            <div className="flex gap-2">
              <input className="input w-full" value={v.code} onChange={(e) => set("code")(e.target.value.toUpperCase())} placeholder="Leave blank to generate" />
              <button type="button" className="btn btn-secondary shrink-0" onClick={async () => { if (v.name.trim()) set("code")(await suggestSupplierCodeAction(v.name)); }}>Auto</button>
            </div>
          </Field>
          <Field label="Category"><ComboSelect value={v.category} onChange={set("category")} options={SUPPLIER_CATEGORIES} /></Field>
          <Field label="TRN (tax registration number)"><input className="input w-full" inputMode="numeric" value={v.trn} onChange={(e) => set("trn")(e.target.value)} /></Field>
          <Field label="Active from"><DatePicker value={v.activeFrom} onChange={set("activeFrom")} className="w-full" /></Field>
          <Field label="Trade licence number"><input className="input w-full" value={v.tradeLicenseNumber} onChange={(e) => set("tradeLicenseNumber")(e.target.value)} /></Field>
          <Field label="Trade licence expiry"><DatePicker value={v.tradeLicenseExpiry} onChange={set("tradeLicenseExpiry")} className="w-full" /></Field>
          <Field label="MOHRE manpower supply permit #"><input className="input w-full" value={v.mohrePermitNumber} onChange={(e) => set("mohrePermitNumber")(e.target.value)} /></Field>
          <Field label="Country"><CountrySelect value={v.country} onChange={(c) => setV((p) => ({ ...p, country: c, emirate: "" }))} /></Field>
          <Field label="Emirate"><CitySelect country={v.country} value={v.emirate} onChange={set("emirate")} /></Field>
          <div className="sm:col-span-2"><p className="text-xs font-medium uppercase tracking-wide text-muted">Contact (optional)</p></div>
          <Field label="Contact person"><input className="input w-full" value={v.contactPerson} onChange={(e) => set("contactPerson")(e.target.value)} /></Field>
          <Field label="Contact phone"><PhoneField value={v.contactPhone} onChange={set("contactPhone")} country={v.country} /></Field>
          <Field label="Contact email" className="sm:col-span-2"><input type="email" className="input w-full" value={v.contactEmail} onChange={(e) => set("contactEmail")(e.target.value)} /></Field>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            {([
              ["Name", v.name], ["Full name", v.fullName], ["Code", v.code || "Generated on save"], ["Category", v.category], ["TRN", v.trn], ["Active from", v.activeFrom],
              ["Trade licence", v.tradeLicenseNumber], ["Licence expiry", v.tradeLicenseExpiry], ["MOHRE permit", v.mohrePermitNumber], ["Location", [v.emirate, v.country].filter(Boolean).join(", ")],
              ["Contact", [v.contactPerson, v.contactPhone, v.contactEmail].filter(Boolean).join(" · ")],
            ] as [string, string][]).map(([k, val]) => (
              <div key={k} className="flex justify-between gap-3 border-b border-[var(--border)] py-1.5">
                <dt className="text-muted">{k}</dt>
                <dd className={cn("text-right", val ? "text-primary" : "text-muted")}>{val || "—"}</dd>
              </div>
            ))}
          </dl>
          <p className="text-sm text-secondary">{docs.length === 0 ? "No documents attached." : `${docs.length} document${docs.length === 1 ? "" : "s"} will be filed on the supplier: ${docs.map((d) => typeLabel(d.docType)).join(", ")}.`}</p>
        </div>
      )}

      {error && <p role="alert" className="rounded-lg border border-[var(--error-border)] bg-[var(--error-soft)] px-4 py-2 text-sm text-[var(--error)]">{error}</p>}

      <div className="flex items-center justify-between border-t border-[var(--border)] pt-4">
        <button type="button" className="btn btn-secondary" disabled={step === 0 || pending} onClick={() => setStep((s) => Math.max(0, s - 1))}>Previous</button>
        {step < STEPS.length - 1 ? (
          <button type="button" className="btn btn-primary" disabled={reading} onClick={next}>{reading ? "Reading documents…" : "Next"}</button>
        ) : (
          <button type="button" className="btn btn-primary" disabled={pending} onClick={create}>{pending ? "Creating…" : "Create supplier"}</button>
        )}
      </div>
    </div>
  );
}
