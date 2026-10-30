"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Select } from "@/components/ui/Select";
import { DatePicker } from "@/components/ui/DatePicker";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/Badge";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from "@/lib/constants";
import { shrinkImage } from "@/lib/compressImage";
import { SHARE_OPTIONS } from "@/lib/ownership";
import { PARTY_ROLES } from "@/lib/documentTypes";
import { similarPeople } from "@/lib/people";
import { uploadAttachmentAction } from "@/lib/attachments";
import type { ExtractedDocumentFields } from "@/app/api/documents/extract/route";
import { UploadSlot, type UploadStatus } from "@/app/(platform)/(app)/employees/new/upload-slot";
import { savePersonAction } from "../../people-actions";

type DocType = { key: string; label: string; hasExpiry: boolean; required: boolean };
type Slot = { file: File; expiry: string; noExpiry: boolean; status: "idle" | "reading" | "read" | "failed" };
type Line = { id: number; supplierId: string; role: string; percent: number | null };

const STEPS = ["Who & documents", "Companies & save"] as const;

/** Two steps: who they are with their documents, then which companies and roles. Companies are optional. */
export function PersonWizard({ docTypes, companies, people, existing, canAddDocs }: {
  docTypes: DocType[];
  companies: { id: string; name: string }[];
  people: { id: string; name: string }[];
  existing: { id: string; name: string } | null;
  canAddDocs: boolean;
}) {
  const router = useRouter();
  const [step, setStep] = useState(existing ? 1 : 0);
  const [person, setPerson] = useState({ name: "", nationality: "", phone: "", email: "" });
  const [docs, setDocs] = useState<Record<string, Slot>>({});
  const [lines, setLines] = useState<Line[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const next = useRef(1);

  const first = docTypes.filter((t) => t.required || t.key === "PASSPORT" || t.key === "EMIRATES_ID");
  const more = docTypes.filter((t) => !first.includes(t));
  const same = person.name.trim() ? similarPeople(person.name.trim(), people) : [];

  async function pick(type: string, picked: File | null) {
    if (!picked) return;
    if (picked.size > MAX_UPLOAD_BYTES) return setError(`${picked.name} is over the ${MAX_UPLOAD_LABEL} limit for one file.`);
    setError(null);
    const file = picked.type.startsWith("image/") ? await shrinkImage(picked) : picked;
    const readable = type === "PASSPORT" || type === "EMIRATES_ID";
    setDocs((d) => ({ ...d, [type]: { file, expiry: "", noExpiry: false, status: readable ? "reading" : "idle" } }));
    if (!readable) return;
    // A passport or Emirates ID is read: the expiry fills in, and the name and nationality while still blank.
    const body = new FormData();
    body.append("file", file);
    body.append("docType", type);
    try {
      const res = await fetch("/api/documents/extract", { method: "POST", body });
      const d = (await res.json().catch(() => null)) as (ExtractedDocumentFields & { error?: string }) | null;
      if (!res.ok || !d) throw new Error(d?.error || "Couldn't read this document.");
      const expiry = (type === "PASSPORT" ? d.passportExpiry : d.emiratesIdExpiry) ?? "";
      setPerson((p) => ({ ...p, name: p.name || d.name || "", nationality: p.nationality || d.nationality || "" }));
      setDocs((s) => ({ ...s, [type]: { file, expiry, noExpiry: false, status: expiry ? "read" : "failed" } }));
    } catch {
      setDocs((s) => ({ ...s, [type]: { file, expiry: "", noExpiry: false, status: "failed" } }));
    }
  }
  const clear = (type: string) => setDocs((d) => { const rest = { ...d }; delete rest[type]; return rest; });
  const patch = (type: string, p: Partial<Slot>) => setDocs((d) => ({ ...d, [type]: { ...d[type], ...p } }));

  function slot(t: DocType) {
    const d = docs[t.key];
    const status: UploadStatus = !d ? { kind: "idle" } : d.status === "reading" ? { kind: "reading" } : d.status === "failed" ? { kind: "error", message: t.hasExpiry ? "Couldn't read a date. Enter it below." : "Added." } : d.status === "read" ? { kind: "filled", message: "Expiry read from the file. Check it." } : { kind: "idle" };
    return (
      <div key={t.key}>
        <UploadSlot id={`doc-${t.key}`} label={`${t.label}${t.required ? " *" : ""}`} file={d?.file ?? null} status={status} onSelect={(f) => void pick(t.key, f)} onClear={() => clear(t.key)} />
        {d && t.hasExpiry && d.status !== "reading" && (
          <div className="mt-1.5 space-y-1">
            <DatePicker value={d.expiry} onChange={(v) => patch(t.key, { expiry: v, noExpiry: v ? false : d.noExpiry })} className="w-full" />
            {!d.expiry && (
              <label className="flex items-center gap-1.5 text-xs text-muted">
                <input type="checkbox" checked={d.noExpiry} onChange={(e) => patch(t.key, { noExpiry: e.target.checked })} />
                This document has no expiry
              </label>
            )}
          </div>
        )}
      </div>
    );
  }

  function goNext() {
    setError(null);
    if (!person.name.trim()) return setError("Enter the person's name, or upload a passport to read it from.");
    const missing = docTypes.find((t) => t.hasExpiry && docs[t.key] && docs[t.key].status !== "reading" && !docs[t.key].expiry && !docs[t.key].noExpiry);
    if (missing) return setError(`Enter the expiry date for ${missing.label.toLowerCase()}, or tick that it has none.`);
    if (Object.values(docs).some((d) => d.status === "reading")) return setError("Wait for the documents to finish reading.");
    setStep(1);
  }

  const addLine = () => setLines((l) => [...l, { id: next.current++, supplierId: "", role: "OWNER", percent: null }]);
  const setLine = (id: number, p: Partial<Line>) => setLines((l) => l.map((x) => (x.id === id ? { ...x, ...p } : x)));

  async function save() {
    setError(null);
    if (lines.some((l) => !l.supplierId)) return setError("Choose a company for each line, or remove the line.");
    setSaving(true);
    const res = await savePersonAction({ partyId: existing?.id, person: existing ? undefined : person, links: lines.map((l) => ({ supplierId: l.supplierId, role: l.role, percent: l.role === "OWNER" ? l.percent : null })) });
    if (res.error || !res.partyId) { setSaving(false); return setError(res.error ?? "Couldn't save."); }
    // Documents go one at a time, so a few scans can't push one request over the size limit.
    const failed: string[] = [];
    for (const [type, d] of Object.entries(docs)) {
      const fd = new FormData();
      fd.set("entityType", "SUPPLIER_PARTY");
      fd.set("entityId", res.partyId);
      fd.set("docType", type);
      fd.set("revalidate", "/my-companies/people");
      fd.set("file", d.file);
      if (d.expiry) fd.set("expiryDate", d.expiry);
      if (d.noExpiry) fd.set("noExpiry", "1");
      const r = await uploadAttachmentAction(fd);
      if (r && "error" in r && r.error) failed.push(`${docTypes.find((t) => t.key === type)?.label ?? type}: ${r.error}`);
    }
    if (failed.length) { setSaving(false); return setError(`${person.name} was saved, but some documents weren't: ${failed.join("; ")}. Add them from the person's card.`); }
    router.push("/my-companies/people");
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <ol className="flex flex-wrap gap-2 border-b border-default pb-4 text-sm" aria-label="Steps">
        {STEPS.map((label, i) => (
          <li key={label} className={`rounded-full px-3 py-1 ${i === step ? "bg-[var(--brand-primary)] font-semibold text-white" : i < step ? "text-[var(--success)]" : "text-muted"}`}>{i + 1} {label}{i < step ? " ✓" : ""}</li>
        ))}
      </ol>

      {step === 0 && (
        <div className="space-y-5">
          {canAddDocs ? (
            <div className="rounded-card border border-default bg-surface-sunken p-4">
              <h3 className="text-sm font-semibold text-primary">Their documents</h3>
              <p className="mb-3 text-xs text-muted">A passport or Emirates ID is read for you: name, nationality and expiry fill in. Documents are kept once on the person, whatever companies they belong to.</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{first.map(slot)}</div>
              {more.length > 0 && (
                <details className="mt-3 rounded-card border border-default">
                  <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-secondary">More documents ({more.map((t) => t.label.toLowerCase()).join(", ")})</summary>
                  <div className="grid grid-cols-1 gap-4 border-t border-default p-3 sm:grid-cols-2">{more.map(slot)}</div>
                </details>
              )}
            </div>
          ) : (
            <p className="rounded-lg border border-default bg-surface-sunken px-3 py-2 text-sm text-muted">You can add the person now, but their documents need the &ldquo;Sensitive documents&rdquo; permission from an administrator.</p>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block"><span className="mb-1 block text-xs font-medium text-muted">Full name *</span><input className="input w-full" value={person.name} onChange={(e) => setPerson({ ...person, name: e.target.value })} /></label>
            <label className="block"><span className="mb-1 block text-xs font-medium text-muted">Nationality</span><input className="input w-full" value={person.nationality} onChange={(e) => setPerson({ ...person, nationality: e.target.value })} /></label>
            <label className="block"><span className="mb-1 block text-xs font-medium text-muted">Phone</span><input className="input w-full" value={person.phone} onChange={(e) => setPerson({ ...person, phone: e.target.value })} /></label>
            <label className="block"><span className="mb-1 block text-xs font-medium text-muted">Email</span><input type="email" className="input w-full" value={person.email} onChange={(e) => setPerson({ ...person, email: e.target.value })} /></label>
          </div>
          {same.map((m) => (
            <p key={m.id} role="status" className="rounded-lg border border-[var(--warning-border)] bg-[var(--warning-soft)] px-3 py-2 text-sm text-[var(--warning)]">
              <span className="font-medium">{m.name}</span> is already on the list. <Link href={`/my-companies/people/new?person=${m.id}`} className="font-medium underline">Assign companies to them instead</Link> so there is no duplicate.
            </p>
          ))}
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <p className="text-sm text-secondary">{existing ? `${existing.name}: ` : ""}Which of your companies, and what is this person to each? A person can be an owner of one company, a sponsor of another, or both of the same. You can skip this and assign companies later.</p>
          {lines.map((l) => (
            <div key={l.id} className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[1.6fr_1fr_6rem_auto]">
              <Select value={l.supplierId} onChange={(v) => setLine(l.id, { supplierId: v })} placeholder="Company…" options={companies.map((c) => ({ value: c.id, label: c.name }))} />
              <Select value={l.role} onChange={(v) => setLine(l.id, { role: v, percent: v === "OWNER" ? l.percent : null })} searchable={false} options={PARTY_ROLES.map((r) => ({ value: r.value, label: r.label }))} />
              {l.role === "OWNER" ? <Select value={l.percent === null ? "" : String(l.percent)} onChange={(v) => setLine(l.id, { percent: v ? Number(v) : null })} placeholder="Share" options={SHARE_OPTIONS.map((n) => ({ value: String(n), label: `${n}%` }))} /> : <span className="text-center text-muted">–</span>}
              <button type="button" aria-label="Remove this line" className="py-2 text-muted hover:text-[var(--error)]" onClick={() => setLines((x) => x.filter((y) => y.id !== l.id))}><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
          {companies.length === 0 && <p className="text-sm text-muted">You have no own companies yet. Save the person now and assign them once a company exists.</p>}
          {companies.length > 0 && <button type="button" className="btn btn-secondary gap-1.5" onClick={addLine}><Plus className="h-3.5 w-3.5" aria-hidden />Add a company and role</button>}
          {lines.some((l) => l.role === "OWNER") && <p className="text-xs text-muted">A company&rsquo;s owner shares can&rsquo;t pass 100%. If they are short of 100% afterwards, finish them from the company&rsquo;s page.</p>}
          {Object.keys(docs).length > 0 && <p className="text-xs text-muted">Documents to file: {Object.keys(docs).map((k) => docTypes.find((t) => t.key === k)?.label ?? k).join(", ")}. <Badge color="green">Expiries tracked</Badge></p>}
        </div>
      )}

      {error && <p role="alert" className="text-sm text-[var(--error)]">{error}</p>}
      <div className="flex items-center justify-between border-t border-default pt-4">
        {step === 1 && !existing ? <button type="button" className="btn btn-secondary" disabled={saving} onClick={() => setStep(0)}>Previous</button> : <Link href="/my-companies/people" className="btn btn-secondary">Cancel</Link>}
        {step === 0 ? <Button type="button" onClick={goNext}>Next</Button> : <Button type="button" loading={saving} onClick={() => void save()}>{lines.length === 0 ? "Save without a company" : existing ? "Assign" : "Save"}</Button>}
      </div>
    </div>
  );
}
