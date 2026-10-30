"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { DatePicker } from "@/components/ui/DatePicker";
import { MaskedInput } from "@/components/ui/MaskedInput";
import { Select } from "@/components/ui/Select";
import { setRenewalExpiryAction } from "../renewals/actions";
import { ScanUpload } from "../scan-upload";
import { setEmployeeBankAction, setEmployeePayAction } from "./fix-actions";

import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/Alert";
type Structure = "FLAT" | "ITEMISED" | "HOURLY";
export type ReadinessRow = { key: string; label: string; ok: boolean; problem?: string; blocking: boolean };
export type PayDefaults = { structures: Structure[]; structure: string; rate: string; housing: string; food: string; transport: string; other: string };
export type BankDefaults = { personCode: string; routingCode: string; iban: string; bankName: string };
const LABEL: Record<Structure, string> = { FLAT: "Flat monthly salary", ITEMISED: "Basic plus allowances", HOURLY: "Hourly rate" };
const RATE: Record<Structure, string> = { FLAT: "Monthly salary", ITEMISED: "Basic salary", HOURLY: "Rate per hour" };
const num = (s: string) => (s.trim() === "" ? null : Number(s));
const FIELD_OF: Record<string, string> = { labour: "laborCardExpiry", eid: "emiratesIdExpiry", visa: "visaExpiry" };

function useSave() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  function run(fn: () => Promise<{ error?: string | null } | { ok: true } | void>) {
    setError(null);
    start(async () => {
      const r = (await fn()) as { error?: string | null } | undefined;
      if (r && r.error) { setError(r.error); return; }
      router.refresh();
    });
  }
  return { pending, error, run };
}

function PayFix({ employeeId, d }: { employeeId: string; d: PayDefaults }) {
  const { pending, error, run } = useSave();
  const [v, setV] = useState({ structure: (d.structures.includes(d.structure as Structure) ? d.structure : d.structures.length === 1 ? d.structures[0] : "") as Structure | "", rate: d.rate, housing: d.housing, food: d.food, transport: d.transport, other: d.other });
  return (
    <div className="mt-2 space-y-2 rounded-md bg-surface-subtle p-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className="block w-56"><span className="mb-1 block text-xs font-medium text-muted">How are they paid?</span>
          <Select value={v.structure} onChange={(s) => setV((p) => ({ ...p, structure: s as Structure }))} searchable={false} placeholder="Choose" options={d.structures.map((s) => ({ value: s, label: LABEL[s] }))} /></label>
        {v.structure && <label className="block w-36"><span className="mb-1 block text-xs font-medium text-muted">{RATE[v.structure]} (AED)</span>
          <input type="number" min={0} step="0.01" value={v.rate} onChange={(e) => setV((p) => ({ ...p, rate: e.target.value }))} className="input h-9 w-full" /></label>}
        {v.structure === "ITEMISED" && (["housing", "food", "transport", "other"] as const).map((k) => (
          <label key={k} className="block w-24"><span className="mb-1 block text-xs font-medium text-muted">{k[0].toUpperCase() + k.slice(1)}</span>
            <input type="number" min={0} step="0.01" value={v[k]} onChange={(e) => setV((p) => ({ ...p, [k]: e.target.value }))} className="input h-9 w-full" /></label>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <Button size="btn-sm" type="button" disabled={pending || !v.structure} onClick={() => run(() => setEmployeePayAction(employeeId, { structure: v.structure as Structure, rate: num(v.rate), housing: num(v.housing), food: num(v.food), transport: num(v.transport), other: num(v.other) }))} loading={pending}>Save pay</Button>
        {error && <Alert inline>{error}</Alert>}
      </div>
    </div>
  );
}

function BankFix({ employeeId, d }: { employeeId: string; d: BankDefaults }) {
  const { pending, error, run } = useSave();
  const submit = (e: React.FormEvent<HTMLFormElement> | React.MouseEvent<HTMLButtonElement>, mode: "BANK" | "CASH") => {
    e.preventDefault();
    const form = (e.currentTarget as HTMLElement).closest("form") as HTMLFormElement;
    const fd = new FormData(form);
    fd.set("mode", mode);
    run(() => setEmployeeBankAction(employeeId, fd));
  };
  return (
    <form onSubmit={(e) => submit(e, "BANK")} className="mt-2 grid gap-2 rounded-md bg-surface-subtle p-3 sm:grid-cols-2" aria-label="Bank details">
      <label className="block text-xs text-muted">MOL person code<input name="personCode" defaultValue={d.personCode} className="input mt-1 h-9 w-full text-sm" inputMode="numeric" /></label>
      <label className="block text-xs text-muted">Bank routing code (9 digits)<input name="routingCode" defaultValue={d.routingCode} className="input mt-1 h-9 w-full text-sm" inputMode="numeric" maxLength={9} /></label>
      <label className="block text-xs text-muted sm:col-span-2">IBAN<MaskedInput kind="iban" name="wpsIban" defaultValue={d.iban} className="input mt-1 h-9 w-full text-sm" /></label>
      <label className="block text-xs text-muted sm:col-span-2">Bank name (optional)<input name="bankName" defaultValue={d.bankName} className="input mt-1 h-9 w-full text-sm" /></label>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <Button size="btn-sm" type="submit" disabled={pending} loading={pending}>Save bank details</Button>
        <button type="button" disabled={pending} className="btn btn-secondary btn-sm" onClick={(e) => submit(e, "CASH")}>Paid in cash instead</button>
        {error && <Alert inline className="w-full">{error}</Alert>}
      </div>
    </form>
  );
}

/** The document type a renewable date belongs to, for the ones a scan can be read for. */
const DOC_OF: Record<string, string> = { passportExpiry: "PASSPORT", emiratesIdExpiry: "EMIRATES_ID", laborCardExpiry: "LABOR_CARD", visaExpiry: "VISA" };

/** A renewed document: upload the new scan and its expiry is read and put on the record, or just type the new date. */
export function ExpiryFix({ employeeId, field, current }: { employeeId: string; field: string; current: string }) {
  const { pending, error, run } = useSave();
  const router = useRouter();
  const [date, setDate] = useState(current);
  const [msg, setMsg] = useState<{ tone: "ok" | "warn"; text: string } | null>(null);
  const docType = DOC_OF[field];
  return (
    <div className="mt-2 space-y-2">
      {docType && (
        <ScanUpload
          employeeId={employeeId}
          docType={docType}
          hasPhoto
          compact
          title="Upload the new document"
          hint="The new expiry is read from it and saved."
          onDone={(o) => {
            if (o.applied.length > 0) { setMsg({ tone: "ok", text: `Saved. ${o.applied.map((a) => `${a.label}: ${/^\d{4}-\d{2}-\d{2}/.test(a.value) ? new Date(a.value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }) : a.value}`).join(", ")}.` }); setTimeout(() => router.refresh(), 1200); }
            else setMsg({ tone: "warn", text: o.unread > 0 || o.conflicts.length === 0 ? "The file is saved, but no newer expiry could be read from it. Enter the new date below." : "The file is saved. Its date differs from the record; check it below." });
          }}
        />
      )}
      <div className="flex flex-wrap items-end gap-2">
        <label className="block w-44"><span className="mb-1 block text-xs font-medium text-muted">{docType ? "Or type the new expiry date" : "New expiry date"}</span><DatePicker value={date} onChange={setDate} /></label>
        <Button size="btn-sm" type="button" disabled={pending || !date} onClick={() => run(() => setRenewalExpiryAction({ employeeId, field, expiry: date }))} loading={pending}>Save date</Button>
      </div>
      {msg && <p role="status" className={msg.tone === "ok" ? "text-xs text-[var(--success)]" : "text-xs text-[var(--warning)]"}>{msg.text}</p>}
      {error && <Alert inline className="w-full">{error}</Alert>}
    </div>
  );
}

/** The payroll-readiness checklist with a fix under each item that is wrong: pay, bank and WPS details, expired documents. */
export function ReadinessFixes({ employeeId, rows, pay, bank, expiries }: { employeeId: string; rows: ReadinessRow[]; pay: PayDefaults; bank: BankDefaults; expiries: Record<string, string> }) {
  return (
    <ul className="space-y-4 text-sm">
      {rows.map((i) => (
        <li key={i.key}>
          <p className="flex items-start gap-2">
            {i.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--success)]" aria-hidden /> : <AlertTriangle className={`mt-0.5 h-4 w-4 shrink-0 ${i.blocking ? "text-[var(--error)]" : "text-[var(--warning)]"}`} aria-hidden />}
            <span className={i.ok ? "text-muted" : "text-primary"}><span className="font-medium">{i.label}</span>{!i.ok && <>: {i.problem}</>}</span>
          </p>
          {!i.ok && i.key === "pay" && <PayFix employeeId={employeeId} d={pay} />}
          {!i.ok && i.key === "bank" && <BankFix employeeId={employeeId} d={bank} />}
          {!i.ok && FIELD_OF[i.key] && <ExpiryFix employeeId={employeeId} field={FIELD_OF[i.key]} current="" />}
        </li>
      ))}
    </ul>
  );
}

/** Documents that need attention, each with its date to set right here. */
export function DocumentFixes({ employeeId, docs }: { employeeId: string; docs: { field: string; label: string; state: "valid" | "expiring" | "expired" | "not_set"; days: number | null; current: string }[] }) {
  return (
    <ul className="divide-y divide-[var(--border)] rounded-md border border-default text-sm">
      {docs.map((d) => (
        <li key={d.field} className="px-3 py-2">
          <div className="flex items-center justify-between gap-3">
            <span className="text-primary">{d.label}</span>
            <span className={d.state === "expired" ? "font-medium text-[var(--error)]" : d.state === "expiring" ? "font-medium text-[var(--warning)]" : d.state === "not_set" ? "text-muted" : "text-[var(--success)]"}>
              {d.state === "not_set" ? "Not set" : d.state === "expired" ? `${-(d.days ?? 0)} days overdue` : d.state === "expiring" ? `${d.days} days left` : "Valid"}
            </span>
          </div>
          {d.state !== "valid" && <ExpiryFix employeeId={employeeId} field={d.field} current={d.current} />}
        </li>
      ))}
    </ul>
  );
}
