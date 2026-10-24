"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, FileText, Loader2, Plus, Sparkles, Trash2, X } from "lucide-react";
import { Select } from "@/components/ui/Select";
import { DatePicker } from "@/components/ui/DatePicker";
import { CountrySelect } from "@/components/ui/CountrySelect";
import { CitySelect } from "@/components/ui/CitySelect";
import { PhoneField } from "@/components/ui/PhoneField";
import { cn } from "@/lib/cn";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from "@/lib/constants";
import { shrinkImage } from "@/lib/compressImage";
import { firstInvalidContact } from "@/lib/validators";
import { PARTY_ROLES } from "@/lib/documentTypes";
import type { ExtractedCompanyFields } from "@/app/api/documents/extract-company/route";
import type { ExtractedDocumentFields } from "@/app/api/documents/extract/route";
import { MultiUploadSlot, UploadSlot, type UploadStatus } from "@/app/(platform)/(app)/employees/new/upload-slot";
import { DocumentChecklist, type ChecklistItem } from "@/app/(platform)/(app)/employees/new/document-checklist";
import { suggestSupplierCodeAction } from "../../suppliers/actions";
import { attachCompanyFileAction, createOwnCompanyWizardAction } from "./actions";

type DocType = { key: string; label: string; hasExpiry: boolean };
const STEPS = ["Documents", "Details", "Owners & sponsors", "Review"] as const;

type Values = {
  name: string; code: string; fullName: string; parentSupplierId: string; trn: string; activeFrom: string; tradeLicenseNumber: string; tradeLicenseExpiry: string; mohrePermitNumber: string;
  country: string; emirate: string; location: string; poBox: string; phone: string; contactEmail: string; contactPerson: string; contactPhone: string;
};
const EMPTY: Values = {
  name: "", code: "", fullName: "", parentSupplierId: "", trn: "", activeFrom: "", tradeLicenseNumber: "", tradeLicenseExpiry: "", mohrePermitNumber: "",
  country: "United Arab Emirates", emirate: "", location: "", poBox: "", phone: "", contactEmail: "", contactPerson: "", contactPhone: "",
};
type Doc = { id: number; file: File; docType: string; expiry: string; status: "reading" | "read" | "failed"; error?: string; fixedType?: boolean };
type PartyDoc = { file: File; expiry: string; status: "idle" | "reading" | "read" | "failed" };
type Party = { uid: number; role: string; name: string; nationality: string; phone: string; email: string; docs: Record<string, PartyDoc> };

const FIELD_LABEL: Record<string, string> = { contactPhone: "Contact phone", phone: "Phone", contactEmail: "Email", trn: "TRN" };
const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1)}MB`;

function Field({ label, children, className, hint }: { label: string; children: React.ReactNode; className?: string; hint?: string }) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-subtle">{hint}</span>}
    </label>
  );
}

function detailsProblem(v: Values): string | null {
  if (!v.name.trim()) return "Enter the company name.";
  if (v.trn && !/^\d{15}$/.test(v.trn.replace(/\s|-/g, ""))) return "A TRN is 15 digits.";
  const bad = firstInvalidContact(Object.entries(v));
  return bad ? `${FIELD_LABEL[bad.field] ?? bad.field}: ${bad.message}` : null;
}

export function CompanyWizard({ companyTypes, requiredCompanyTypes, partyTypes, requiredPartyTypes, parents, canAddPersonalDocs }: {
  companyTypes: DocType[]; requiredCompanyTypes: string[]; partyTypes: DocType[]; requiredPartyTypes: string[]; parents: { id: string; name: string }[]; canAddPersonalDocs: boolean;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [v, setV] = useState<Values>(EMPTY);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [logo, setLogo] = useState<File | null>(null);
  const [parties, setParties] = useState<Party[]>([]);
  const [read, setRead] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [leftOver, setLeftOver] = useState<{ id: string; failed: string[] } | null>(null);
  const [pending, start] = useTransition();
  const nextId = useRef(1);
  const nextParty = useRef(1);
  const set = (k: keyof Values) => (val: string) => setV((p) => ({ ...p, [k]: val }));
  const typeLabel = (key: string) => companyTypes.find((t) => t.key === key)?.label ?? "Other";
  const partyLabel = (key: string) => partyTypes.find((t) => t.key === key)?.label ?? key;
  const hasType = (key: string) => companyTypes.some((t) => t.key === key);

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
      put("phone", d.phone, "Phone");
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
      const known = d.docType && hasType(d.docType) ? d.docType : "OTHER";
      setDocs((p) => p.map((x) => (x.id === doc.id ? { ...x, status: "read", docType: x.fixedType ? x.docType : known, expiry: d.documentExpiry || (known === "TRADE_LICENSE" ? d.tradeLicenseExpiry || "" : "") } : x)));
      const filled = fill(d);
      if (filled.length) setRead((p) => [...new Set([...p, ...filled])]);
    } catch (e) {
      setDocs((p) => p.map((x) => (x.id === doc.id ? { ...x, status: "failed", error: e instanceof Error ? e.message : "Couldn't read this document." } : x)));
    }
  }

  /** Every file chosen anywhere on this page, as one running total, since each is sent on its own but the page should stay light. */
  const totalBytes = () => docs.reduce((n, d) => n + d.file.size, 0) + parties.reduce((n, p) => n + Object.values(p.docs).reduce((m, d) => m + d.file.size, 0), 0) + (logo?.size ?? 0);

  async function addFiles(list: File[] | FileList | null, fixedType?: string) {
    if (!list) return;
    const added: Doc[] = [];
    for (const picked of Array.from(list)) {
      if (picked.size > MAX_UPLOAD_BYTES) { setError(`${picked.name} is ${mb(picked.size)}, over the ${MAX_UPLOAD_LABEL} limit for one file.`); continue; }
      const file = picked.type.startsWith("image/") ? await shrinkImage(picked) : picked;
      added.push({ id: nextId.current++, file, docType: fixedType ?? "OTHER", expiry: "", status: "reading", fixedType: !!fixedType });
    }
    if (!added.length) return;
    setError(null);
    setDocs((p) => [...(fixedType ? p.filter((x) => x.docType !== fixedType) : p), ...added]);
    for (const d of added) await readDoc(d);
  }

  const slotDoc = (type: string) => docs.find((d) => d.docType === type) ?? null;
  const slotStatus = (type: string): UploadStatus => {
    const d = slotDoc(type);
    if (!d) return { kind: "idle" };
    return d.status === "reading" ? { kind: "reading" } : d.status === "failed" ? { kind: "error", message: d.error ?? "Couldn't read this document." } : { kind: "filled", message: "Read" };
  };
  const checklist: ChecklistItem[] = requiredCompanyTypes.map((key) => ({
    key,
    label: typeLabel(key),
    done: docs.some((d) => d.docType === key && d.status !== "reading"),
    detail: key === "TRADE_LICENSE" ? v.tradeLicenseNumber || null : key === "MOHRE_PERMIT" ? v.mohrePermitNumber || null : key === "TRN_CERTIFICATE" ? v.trn || null : null,
  }));

  // ---- owners & sponsors ----
  const updateParty = (uid: number, patch: Partial<Party>) => setParties((p) => p.map((x) => (x.uid === uid ? { ...x, ...patch } : x)));
  const addParty = (role: string) => setParties((p) => [...p, { uid: nextParty.current++, role, name: "", nationality: "", phone: "", email: "", docs: {} }]);

  async function pickPartyDoc(uid: number, type: string, picked: File | null) {
    if (!picked) return;
    if (picked.size > MAX_UPLOAD_BYTES) return setError(`${picked.name} is ${mb(picked.size)}, over the ${MAX_UPLOAD_LABEL} limit for one file.`);
    setError(null);
    const file = picked.type.startsWith("image/") ? await shrinkImage(picked) : picked;
    const readable = type === "PASSPORT" || type === "EMIRATES_ID";
    setParties((ps) => ps.map((x) => (x.uid === uid ? { ...x, docs: { ...x.docs, [type]: { file, expiry: "", status: readable ? "reading" : "idle" } } } : x)));
    if (!readable) return;
    // A passport or Emirates ID can be read: the expiry fills in, and the name and nationality when still blank.
    const body = new FormData();
    body.append("file", file);
    body.append("docType", type);
    try {
      const res = await fetch("/api/documents/extract", { method: "POST", body });
      const d = (await res.json().catch(() => null)) as (ExtractedDocumentFields & { error?: string }) | null;
      if (!res.ok || !d) throw new Error(d?.error || "Couldn't read this document.");
      const expiry = (type === "PASSPORT" ? d.passportExpiry : d.emiratesIdExpiry) ?? "";
      setParties((ps) => ps.map((x) => (x.uid === uid ? { ...x, name: x.name || d.name || "", nationality: x.nationality || d.nationality || "", docs: { ...x.docs, [type]: { file, expiry: expiry || "", status: "read" } } } : x)));
    } catch {
      setParties((ps) => ps.map((x) => (x.uid === uid ? { ...x, docs: { ...x.docs, [type]: { file, expiry: "", status: "failed" } } } : x)));
    }
  }
  const clearPartyDoc = (uid: number, type: string) => setParties((ps) => ps.map((x) => { if (x.uid !== uid) return x; const rest = { ...x.docs }; delete rest[type]; return { ...x, docs: rest }; }));

  const namedParties = parties.filter((p) => p.name.trim());

  function next() {
    setError(null);
    if (step === 1) {
      const problem = detailsProblem(v);
      if (problem) return setError(problem);
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  async function create() {
    setError(null);
    const problem = detailsProblem(v);
    if (problem) { setStep(1); return setError(problem); }
    const fd = new FormData();
    (Object.keys(v) as (keyof Values)[]).forEach((k) => fd.append(k, v[k]));
    fd.append("parties", JSON.stringify(namedParties.map((p) => ({ role: p.role, name: p.name, nationality: p.nationality, phone: p.phone, email: p.email }))));
    if (logo) fd.append("logo", logo);
    start(async () => {
      try {
        setProgress("Saving the company…");
        const res = await createOwnCompanyWizardAction(fd);
        if (res.error || !res.id) { setProgress(null); return setError(res.error ?? "The company couldn't be saved."); }
        const queue: { label: string; fd: FormData }[] = [];
        for (const d of docs) {
          if (d.status === "reading") continue;
          const f = new FormData();
          f.append("companyId", res.id); f.append("docType", d.docType); f.append("expiry", d.expiry); f.append("file", d.file);
          queue.push({ label: `${typeLabel(d.docType)} (${d.file.name})`, fd: f });
        }
        namedParties.forEach((p, i) => {
          for (const [type, pd] of Object.entries(p.docs)) {
            const f = new FormData();
            f.append("companyId", res.id!); f.append("partyId", res.partyIds?.[i] ?? ""); f.append("docType", type); f.append("expiry", pd.expiry); f.append("file", pd.file);
            queue.push({ label: `${p.name}: ${partyLabel(type)}`, fd: f });
          }
        });
        const failed: string[] = [];
        for (let i = 0; i < queue.length; i++) {
          setProgress(`Uploading documents… ${i + 1} of ${queue.length}`);
          try {
            const r = await attachCompanyFileAction(queue[i].fd);
            if (r.error) failed.push(`${queue[i].label} — ${r.error}`);
          } catch {
            failed.push(`${queue[i].label} — the upload failed`);
          }
        }
        setProgress(null);
        if (failed.length) return setLeftOver({ id: res.id, failed });
        router.push(`/suppliers/${res.id}`);
      } catch {
        setProgress(null);
        setError("The company couldn't be saved. Check your connection and try again.");
      }
    });
  }

  const reading = docs.some((d) => d.status === "reading") || parties.some((p) => Object.values(p.docs).some((d) => d.status === "reading"));
  const filesTotal = totalBytes();

  if (leftOver) {
    return (
      <div className="space-y-4">
        <p className="rounded-lg border border-[var(--warning-border)] bg-[var(--warning-soft)] px-4 py-3 text-sm text-secondary">
          <strong className="text-primary">The company was added</strong>, but {leftOver.failed.length === 1 ? "one document" : `${leftOver.failed.length} documents`} couldn&rsquo;t be uploaded. You can add {leftOver.failed.length === 1 ? "it" : "them"} from the company&rsquo;s page.
        </p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-secondary">{leftOver.failed.map((f) => <li key={f}>{f}</li>)}</ul>
        <button type="button" className="btn btn-primary" onClick={() => router.push(`/suppliers/${leftOver.id}`)}>Open the company</button>
      </div>
    );
  }

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
                  onClick={() => i <= step && !pending && setStep(i)}
                  aria-current={active ? "step" : undefined}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-control px-2.5 py-1.5 text-xs font-medium transition",
                    active ? "bg-[var(--brand-primary)] text-white" : done ? "bg-[var(--success-soft)] text-[var(--success)] hover:brightness-95" : "text-muted hover:bg-surface-hover hover:text-primary",
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
                <p className="text-sm font-medium text-primary">Upload the company&rsquo;s documents</p>
                <p className="mt-0.5 text-xs text-secondary">
                  Trade licence, establishment card, VAT certificate, tenancy agreement and anything else you have — as one PDF or several files. Everything readable is filled in for you, and each file is sorted by what it is.
                </p>
                <div className="mt-3">
                  <MultiUploadSlot
                    id="company-doc-pack"
                    label="Document pack"
                    files={[]}
                    status={reading ? { kind: "reading" } : { kind: "idle" }}
                    hint={`PDF or images, up to ${MAX_UPLOAD_LABEL} each. You can select several files at once.`}
                    onAdd={(picked) => void addFiles(picked)}
                    onRemove={() => undefined}
                  />
                  {filesTotal > 0 && <p className="mt-2 text-xs text-muted">{mb(filesTotal)} of documents chosen so far. They are saved one by one, so there is no overall size limit.</p>}
                </div>
              </div>
            </div>
          </div>

          <DocumentChecklist
            title="Required documents"
            items={checklist}
            fixLabel="Upload"
            onFix={() => {
              const details = document.getElementById("company-separate-uploads");
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
                    <>
                      <div className="w-56">
                        <Select value={d.docType} onChange={(t) => setDocs((p) => p.map((x) => (x.id === d.id ? { ...x, docType: t } : x)))} searchable={false} options={companyTypes.map((t) => ({ value: t.key, label: t.label }))} />
                      </div>
                      {companyTypes.find((t) => t.key === d.docType)?.hasExpiry && (
                        <div className="w-40"><DatePicker value={d.expiry} onChange={(val) => setDocs((p) => p.map((x) => (x.id === d.id ? { ...x, expiry: val } : x)))} className="w-full" /></div>
                      )}
                    </>
                  )}
                  <button type="button" aria-label={`Remove ${d.file.name}`} className="text-muted hover:text-primary" onClick={() => setDocs((p) => p.filter((x) => x.id !== d.id))}>
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <details id="company-separate-uploads" className="rounded-card border border-default">
            <summary className="cursor-pointer px-4 py-2.5 text-sm font-medium text-secondary">Upload documents individually</summary>
            <div className="grid grid-cols-1 gap-4 border-t border-default p-4 sm:grid-cols-2">
              {companyTypes.filter((t) => t.key !== "OTHER" && t.key !== "LETTERHEAD").map((t) => (
                <UploadSlot
                  key={t.key}
                  id={`company-doc-${t.key}`}
                  label={t.label}
                  file={slotDoc(t.key)?.file ?? null}
                  status={slotStatus(t.key)}
                  onSelect={(f) => { if (f) void addFiles([f], t.key); }}
                  onClear={() => setDocs((p) => p.filter((x) => x.docType !== t.key))}
                />
              ))}
            </div>
          </details>

          {read.length > 0 && (
            <p className="text-xs text-muted">
              <span className="font-medium text-[var(--success)]">Auto-filled:</span> {read.join(", ")}. You can check and change everything on the next step.
            </p>
          )}
          <p className="text-xs text-muted">No documents to hand? You can skip this step and type the details in; documents can be added later from the company&rsquo;s page.</p>
        </div>
      )}

      {step === 1 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Company name *"><input className="input w-full" value={v.name} onChange={(e) => set("name")(e.target.value)} placeholder="e.g. Gulf Skills" /></Field>
          <Field label="Full legal name" hint="Printed on timesheets and letters issued by this company."><input className="input w-full" value={v.fullName} onChange={(e) => set("fullName")(e.target.value)} placeholder="e.g. GULF SKILLS GENERAL CONTRACTING LLC" /></Field>
          <Field label="Company code">
            <div className="flex gap-2">
              <input className="input w-full" value={v.code} onChange={(e) => set("code")(e.target.value.toUpperCase())} placeholder="Leave blank to generate" />
              <button type="button" className="btn btn-secondary shrink-0" onClick={async () => { if (v.name.trim()) set("code")(await suggestSupplierCodeAction(v.name)); }}>Auto</button>
            </div>
          </Field>
          {parents.length > 0 ? (
            <Field label="Part of (optional)" hint="Choose a company if this is one of its subsidiaries.">
              <Select value={v.parentSupplierId} onChange={set("parentSupplierId")} placeholder="Stands alone" options={[{ value: "", label: "Stands alone" }, ...parents.map((p) => ({ value: p.id, label: p.name }))]} />
            </Field>
          ) : <div />}
          <Field label="TRN (tax registration number)"><input className="input w-full" inputMode="numeric" value={v.trn} onChange={(e) => set("trn")(e.target.value)} /></Field>
          <Field label="Active from"><DatePicker value={v.activeFrom} onChange={set("activeFrom")} className="w-full" /></Field>
          <Field label="Trade licence number"><input className="input w-full" value={v.tradeLicenseNumber} onChange={(e) => set("tradeLicenseNumber")(e.target.value)} /></Field>
          <Field label="Trade licence expiry"><DatePicker value={v.tradeLicenseExpiry} onChange={set("tradeLicenseExpiry")} className="w-full" /></Field>
          <Field label="MOHRE permit number"><input className="input w-full" value={v.mohrePermitNumber} onChange={(e) => set("mohrePermitNumber")(e.target.value)} /></Field>
          <div className="sm:col-span-2 border-t border-default pt-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">Address and contact — printed at the top of timesheets issued by this company</p>
          </div>
          <Field label="Country"><CountrySelect value={v.country} onChange={(c) => setV((p) => ({ ...p, country: c, emirate: "" }))} /></Field>
          <Field label="Emirate"><CitySelect country={v.country} value={v.emirate} onChange={set("emirate")} /></Field>
          <Field label="Address" className="sm:col-span-2"><input className="input w-full" value={v.location} onChange={(e) => set("location")(e.target.value)} placeholder="Office, building, area" /></Field>
          <Field label="P.O. Box"><input className="input w-full" value={v.poBox} onChange={(e) => set("poBox")(e.target.value)} /></Field>
          <Field label="Phone"><PhoneField value={v.phone} onChange={set("phone")} country={v.country} /></Field>
          <Field label="Email" className="sm:col-span-2"><input type="email" className="input w-full" value={v.contactEmail} onChange={(e) => set("contactEmail")(e.target.value)} /></Field>
          <Field label="Contact person (optional)"><input className="input w-full" value={v.contactPerson} onChange={(e) => set("contactPerson")(e.target.value)} /></Field>
          <Field label="Contact phone (optional)"><PhoneField value={v.contactPhone} onChange={set("contactPhone")} country={v.country} /></Field>
          <div className="sm:col-span-2 border-t border-default pt-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Logo (optional)</p>
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-default bg-surface-sunken">
                {logo ? (
                  // eslint-disable-next-line @next/next/no-img-element -- local preview of the chosen file
                  <img src={URL.createObjectURL(logo)} alt="" className="h-full w-full object-contain" />
                ) : (
                  <span className="text-[10px] text-subtle">No logo</span>
                )}
              </div>
              <div className="space-y-1">
                <input type="file" accept="image/png,image/jpeg,image/webp" className="file-input" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) setLogo(f.size > 600 * 1024 ? await shrinkImage(f, 600 * 1024) : f); }} />
                <p className="text-xs text-subtle">PNG or JPEG. Printed at the top of this company&rsquo;s timesheets.</p>
                {logo && <button type="button" className="text-xs text-muted underline" onClick={() => setLogo(null)}>Remove</button>}
              </div>
            </div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <p className="text-sm text-secondary">
            The licence owner (often a local national) and the sponsor who runs the company day to day. Add each with their passport, Emirates ID, visa and other documents. You can skip this and add them later.
          </p>
          {!canAddPersonalDocs && (
            <p className="rounded-lg border border-default bg-surface-sunken px-3 py-2 text-sm text-muted">
              You can add the people now, but their documents are restricted. Adding them needs the &ldquo;Sensitive documents&rdquo; permission from an administrator.
            </p>
          )}
          {parties.map((p, idx) => {
            const first = partyTypes.filter((t) => requiredPartyTypes.includes(t.key));
            const more = partyTypes.filter((t) => !requiredPartyTypes.includes(t.key) && t.key !== "OTHER");
            const slot = (t: DocType) => {
              const d = p.docs[t.key];
              return (
                <div key={t.key}>
                  <UploadSlot
                    id={`party-${p.uid}-${t.key}`}
                    label={t.label}
                    file={d?.file ?? null}
                    status={d?.status === "reading" ? { kind: "reading" } : d?.status === "failed" ? { kind: "error", message: "Couldn't read it — fill the expiry in below." } : d ? { kind: "filled", message: d.status === "read" ? "Read" : "Added" } : { kind: "idle" }}
                    onSelect={(f) => void pickPartyDoc(p.uid, t.key, f)}
                    onClear={() => clearPartyDoc(p.uid, t.key)}
                  />
                  {d && t.hasExpiry && d.status !== "reading" && (
                    <div className="mt-1.5"><DatePicker value={d.expiry} onChange={(val) => setParties((ps) => ps.map((x) => (x.uid === p.uid ? { ...x, docs: { ...x.docs, [t.key]: { ...d, expiry: val } } } : x)))} className="w-full" /></div>
                  )}
                </div>
              );
            };
            return (
              <div key={p.uid} className="space-y-3 rounded-card border border-default p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-primary">{PARTY_ROLES.find((r) => r.value === p.role)?.label ?? "Person"} {parties.filter((x, i) => x.role === p.role && i <= idx).length}</p>
                  <button type="button" aria-label="Remove this person" className="text-muted hover:text-[var(--error)]" onClick={() => setParties((ps) => ps.filter((x) => x.uid !== p.uid))}><Trash2 className="h-4 w-4" /></button>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Role"><Select value={p.role} onChange={(r) => updateParty(p.uid, { role: r })} searchable={false} options={PARTY_ROLES.map((r) => ({ value: r.value, label: r.label }))} /></Field>
                  <Field label="Name *"><input className="input w-full" value={p.name} onChange={(e) => updateParty(p.uid, { name: e.target.value })} /></Field>
                  <Field label="Nationality"><input className="input w-full" value={p.nationality} onChange={(e) => updateParty(p.uid, { nationality: e.target.value })} /></Field>
                  <Field label="Phone"><PhoneField value={p.phone} onChange={(val) => updateParty(p.uid, { phone: val })} country={v.country} /></Field>
                  <Field label="Email" className="sm:col-span-2"><input type="email" className="input w-full" value={p.email} onChange={(e) => updateParty(p.uid, { email: e.target.value })} /></Field>
                </div>
                {canAddPersonalDocs && (
                  <>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{first.map(slot)}</div>
                    {more.length > 0 && (
                      <details className="rounded-card border border-default">
                        <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-secondary">More documents ({more.map((t) => t.label.toLowerCase()).join(", ")})</summary>
                        <div className="grid grid-cols-1 gap-4 border-t border-default p-3 sm:grid-cols-2">{more.map(slot)}</div>
                      </details>
                    )}
                  </>
                )}
              </div>
            );
          })}
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-secondary gap-1.5" onClick={() => addParty("OWNER")}><Plus className="h-3.5 w-3.5" aria-hidden />Add owner</button>
            <button type="button" className="btn btn-secondary gap-1.5" onClick={() => addParty("SPONSOR")}><Plus className="h-3.5 w-3.5" aria-hidden />Add sponsor</button>
            <button type="button" className="btn btn-secondary gap-1.5" onClick={() => addParty("PARTNER")}><Plus className="h-3.5 w-3.5" aria-hidden />Add partner or manager</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            {([
              ["Name", v.name], ["Full legal name", v.fullName], ["Code", v.code || "Generated on save"], ["Part of", parents.find((x) => x.id === v.parentSupplierId)?.name ?? ""], ["TRN", v.trn], ["Active from", v.activeFrom],
              ["Trade licence", v.tradeLicenseNumber], ["Licence expiry", v.tradeLicenseExpiry], ["MOHRE permit", v.mohrePermitNumber], ["Address", [v.location, v.emirate, v.country].filter(Boolean).join(", ")],
              ["P.O. Box", v.poBox], ["Phone", v.phone], ["Email", v.contactEmail], ["Logo", logo ? logo.name : ""],
            ] as [string, string][]).map(([k, val]) => (
              <div key={k} className="flex justify-between gap-3 border-b border-[var(--border)] py-1.5">
                <dt className="text-muted">{k}</dt>
                <dd className={cn("text-right", val ? "text-primary" : "text-muted")}>{val || "—"}</dd>
              </div>
            ))}
          </dl>
          <p className="text-sm text-secondary">
            {docs.length === 0 ? "No company documents attached." : `${docs.length} company document${docs.length === 1 ? "" : "s"}: ${docs.map((d) => typeLabel(d.docType)).join(", ")}.`}
          </p>
          {requiredCompanyTypes.filter((k) => !docs.some((d) => d.docType === k)).length > 0 && (
            <p className="text-sm text-[var(--warning)]">Still missing: {requiredCompanyTypes.filter((k) => !docs.some((d) => d.docType === k)).map(typeLabel).join(", ")}. You can add them after saving.</p>
          )}
          <p className="text-sm text-secondary">
            {namedParties.length === 0 ? "No owners or sponsors added." : `${namedParties.length} owner${namedParties.length === 1 ? "" : "s"} and sponsor${namedParties.length === 1 ? "" : "s"}: ${namedParties.map((p) => `${p.name} (${Object.keys(p.docs).length} document${Object.keys(p.docs).length === 1 ? "" : "s"})`).join(", ")}.`}
          </p>
        </div>
      )}

      {error && <p role="alert" className="rounded-lg border border-[var(--error-border)] bg-[var(--error-soft)] px-4 py-2 text-sm text-[var(--error)]">{error}</p>}
      {progress && <p role="status" className="flex items-center gap-2 text-sm text-secondary"><Loader2 className="h-4 w-4 animate-spin" aria-hidden />{progress}</p>}

      <div className="flex items-center justify-between border-t border-[var(--border)] pt-4">
        <button type="button" className="btn btn-secondary" disabled={step === 0 || pending} onClick={() => setStep((s) => Math.max(0, s - 1))}>Previous</button>
        {step < STEPS.length - 1 ? (
          <button type="button" className="btn btn-primary" disabled={reading} onClick={next}>{reading ? "Reading documents…" : "Next"}</button>
        ) : (
          <button type="button" className="btn btn-primary" disabled={pending || reading} onClick={create}>{pending ? "Creating…" : "Create company"}</button>
        )}
      </div>
    </div>
  );
}
