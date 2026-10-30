"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import { DatePicker } from "@/components/ui/DatePicker";
import { CountrySelect } from "@/components/ui/CountrySelect";
import { Select } from "@/components/ui/Select";
import { MaskedInput } from "@/components/ui/MaskedInput";
import { PhoneField } from "@/components/ui/PhoneField";
import { cn } from "@/lib/cn";
import { Alert } from "@/components/Alert";

/**
 * Field pieces shared by the quick-view panels (employees, suppliers, demand): a value that edits in place,
 * dropdowns and dates that save on choice, and the notice that asks before saving something that looks wrong.
 * A save returns `{ ok: true }`, or `{ error }`, or `{ warnings }` for the person to confirm.
 */
export type SaveResult = { ok: true; value: string | null; previous: string | null } | { ok?: false; error?: string; warnings?: string[] };
export type Kind = "text" | "phone" | "passport" | "eid" | "trn";

/** Runs a save, holding on to the busy flag and any message that needs the person's attention. */
export function useFieldFlow(onSave: (value: string | null, confirm?: boolean) => Promise<SaveResult>) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ error?: string; warnings?: string[]; value?: string | null } | null>(null);
  async function run(value: string | null, confirm = false) {
    setBusy(true);
    setMsg(null);
    try {
      const r = await onSave(value, confirm);
      if (r.ok) return true;
      setMsg({ error: r.error, warnings: r.warnings, value });
      return false;
    } catch {
      setMsg({ error: "That didn't save. Please try again." });
      return false;
    } finally {
      setBusy(false);
    }
  }
  return { busy, msg, run, clear: () => setMsg(null) };
}

export function Notice({ msg, onConfirm, onDismiss }: { msg: { error?: string; warnings?: string[] } | null; onConfirm: () => void; onDismiss: () => void }) {
  if (!msg) return null;
  if (msg.error) return <Alert inline className="mt-1">{msg.error}</Alert>;
  if (!msg.warnings?.length) return null;
  return (
    <div role="alert" className="mt-1.5 rounded-lg border border-[var(--warning-border)] bg-[var(--warning-soft)] p-2 text-xs text-primary">
      <ul className="list-disc space-y-0.5 pl-4">{msg.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
      <div className="mt-1.5 flex gap-3 font-medium">
        <button type="button" className="text-[var(--brand-primary)] hover:underline" onClick={onConfirm}>Save anyway</button>
        <button type="button" className="text-secondary hover:underline" onClick={onDismiss}>Change it</button>
      </div>
    </div>
  );
}

export function TextEditor({ kind, value, onChange, autoFocus }: { kind: Kind; value: string; onChange: (v: string) => void; autoFocus?: boolean }) {
  if (kind === "phone") return <PhoneField value={value} onChange={onChange} />;
  if (kind === "passport" || kind === "eid" || kind === "trn") return <MaskedInput kind={kind} value={value} onChange={(e) => onChange(e.target.value)} autoFocus={autoFocus} className="input w-full" />;
  return <input value={value} onChange={(e) => onChange(e.target.value)} autoFocus={autoFocus} className="input w-full" />;
}

/** A value that turns into an input when clicked: Enter saves, Esc cancels. */
export function ClickToEdit({ label, value, kind = "text", placeholder = "Add", onSave }: { label: string; value: string | null; kind?: Kind; placeholder?: string; onSave: (v: string | null, confirm?: boolean) => Promise<SaveResult> }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const flow = useFieldFlow(onSave);
  // The panel's own Esc handler stands down while a field is open; this closes the field instead.
  useEffect(() => {
    if (!editing) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") { setEditing(false); flow.clear(); } };
    document.addEventListener("keydown", esc, true);
    return () => document.removeEventListener("keydown", esc, true);
  }, [editing, flow]);
  async function commit(confirm = false) {
    if (draft.trim() === (value ?? "")) return setEditing(false);
    if (await flow.run(draft.trim() || null, confirm)) setEditing(false);
  }
  if (!editing) {
    return (
      <button type="button" aria-label={`Edit ${label}`} onClick={() => { setDraft(value ?? ""); setEditing(true); }} className="-ml-2 max-w-full truncate rounded-lg border border-transparent px-2 py-1 text-left font-medium text-primary hover:border-default hover:bg-surface-hover">
        {value || <span className="font-normal text-subtle">{placeholder}</span>}
      </button>
    );
  }
  return (
    <form data-editing onSubmit={(e) => { e.preventDefault(); void commit(); }} >
      <div className="flex items-center gap-1.5">
        <div className="min-w-0 flex-1"><TextEditor kind={kind} value={draft} onChange={setDraft} autoFocus /></div>
        <button type="submit" disabled={flow.busy} aria-label={`Save ${label}`} className="btn btn-primary btn-sm px-2"><Check className="h-3.5 w-3.5" aria-hidden /></button>
        <button type="button" aria-label="Cancel" onClick={() => { setEditing(false); flow.clear(); }} className="btn btn-secondary btn-sm px-2"><X className="h-3.5 w-3.5" aria-hidden /></button>
      </div>
      <p className="mt-0.5 text-[10.5px] text-subtle">Enter to save · Esc to cancel</p>
      <Notice msg={flow.msg} onConfirm={() => void commit(true)} onDismiss={flow.clear} />
    </form>
  );
}

/** Dropdowns, countries and dates save the moment a choice is made. */
export function ChoiceField({ kind, value, options, onSave, placeholder }: { kind: "select" | "country" | "date" | "project"; value: string | null; options?: { value: string; label: string }[]; onSave: (v: string | null, confirm?: boolean) => Promise<SaveResult>; placeholder?: string }) {
  const flow = useFieldFlow(onSave);
  // A date typed over an existing one passes through half-typed states: an empty box, or a year like 0002. Neither
  // is saved; clearing a date is done on the full page. The picker restarts when the saved value changes from
  // outside (a scan, an undo), so it shows what is actually stored.
  const change = (v: string) => { if (kind === "date" && !v) return; if (v !== (value ?? "")) void flow.run(v || null); };
  return (
    <div className="min-w-0">
      {kind === "country" && <CountrySelect value={value ?? ""} onChange={change} />}
      {(kind === "select" || kind === "project") && <Select value={value ?? ""} onChange={change} options={[{ value: "", label: placeholder ?? "Not set" }, ...(options ?? [])]} searchable={kind === "project"} placeholder={placeholder ?? "Not set"} />}
      {kind === "date" && <DatePicker key={value ?? ""} value={value ?? ""} onChange={change} fromYear={1940} toYear={new Date().getFullYear() + 12} min="1900-01-01" max={`${new Date().getFullYear() + 30}-12-31`} />}
      <Notice msg={flow.msg} onConfirm={() => void flow.run(flow.msg?.value ?? null, true)} onDismiss={flow.clear} />
    </div>
  );
}

export function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[96px_minmax(0,1fr)] items-start gap-3 border-b border-default px-3 py-2 text-sm last:border-b-0">
      <dt className="pt-1.5 text-muted">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

export function ReadOnly({ value, href }: { value: string | null; href: string }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1">
      <span className={cn("truncate font-medium", value ? "text-primary" : "text-subtle")}>{value ?? "Not set"}</span>
      <Link href={href} className="shrink-0 text-xs text-[var(--brand-primary)] hover:underline">Change in profile</Link>
    </div>
  );
}

export function Pill({ tone, children }: { tone: "ok" | "warn" | "err" | "mute"; children: React.ReactNode }) {
  const c = { ok: "bg-[var(--success-soft)] text-[var(--success)]", warn: "bg-[var(--warning-soft)] text-[var(--warning)]", err: "bg-[var(--error-soft)] text-[var(--error)]", mute: "bg-surface-sunken text-muted" }[tone];
  return <span className={cn("inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10.5px] font-semibold", c)}>{children}</span>;
}

