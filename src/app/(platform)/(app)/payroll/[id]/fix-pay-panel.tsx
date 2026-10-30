"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Checkbox } from "@/components/ui/Checkbox";
import { Select } from "@/components/ui/Select";
import { DatePicker } from "@/components/ui/DatePicker";
import { structuresFor } from "@/lib/payFields";
import { fixInactiveFromRunAction, setPayFromRunAction, type FixPayEntry } from "./fix-pay-actions";

import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/Alert";
type Structure = "FLAT" | "ITEMISED" | "HOURLY";
export type FixRow = {
  id: string; name: string; idNo: string; trade: string; reason: string; kind: "PAY" | "INACTIVE";
  structure: string; rate: string; housing: string; food: string; transport: string; other: string;
};
type Draft = { structure: Structure | ""; rate: string; housing: string; food: string; transport: string; other: string };

const LABEL: Record<Structure, string> = { FLAT: "Flat monthly salary", ITEMISED: "Basic plus allowances", HOURLY: "Hourly rate" };
const RATE_LABEL: Record<Structure, string> = { FLAT: "Monthly salary", ITEMISED: "Basic salary", HOURLY: "Rate per hour" };
const num = (s: string) => (s.trim() === "" ? null : Number(s));

function toEntry(employeeId: string, d: Draft): FixPayEntry | null {
  if (!d.structure) return null;
  return { employeeId, structure: d.structure, rate: num(d.rate), housing: num(d.housing), food: num(d.food), transport: num(d.transport), other: num(d.other) };
}

function Inputs({ d, set, structures, disabled }: { d: Draft; set: (p: Partial<Draft>) => void; structures: Structure[]; disabled: boolean }) {
  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="block w-56">
        <span className="mb-1 block text-xs font-medium text-muted">How are they paid?</span>
        <Select value={d.structure} onChange={(v) => set({ structure: v as Structure })} searchable={false} disabled={disabled} placeholder="Choose" options={structures.map((s) => ({ value: s, label: LABEL[s] }))} />
      </label>
      {d.structure && (
        <label className="block w-32">
          <span className="mb-1 block text-xs font-medium text-muted">{RATE_LABEL[d.structure]} (AED)</span>
          <input type="number" min={0} step="0.01" value={d.rate} disabled={disabled} onChange={(e) => set({ rate: e.target.value })} className="input h-9 w-full" />
        </label>
      )}
      {d.structure === "ITEMISED" && (
        (["housing", "food", "transport", "other"] as const).map((k) => (
          <label key={k} className="block w-24">
            <span className="mb-1 block text-xs font-medium text-muted">{k[0].toUpperCase() + k.slice(1)}</span>
            <input type="number" min={0} step="0.01" value={d[k]} disabled={disabled} onChange={(e) => set({ [k]: e.target.value })} className="input h-9 w-full" />
          </label>
        ))
      )}
    </div>
  );
}

/** Workers left out of a draft run because their pay isn't set up, with the fix right here, one at a time or for many. */
export function FixPayPanel({ runId, payType, canEdit, rows }: { runId: string; payType: string | null; canEdit: boolean; rows: FixRow[] }) {
  const router = useRouter();
  const structures = structuresFor(payType);
  const firstOk = (s: string): Structure | "" => (structures.includes(s as Structure) ? (s as Structure) : structures.length === 1 ? structures[0] : "");
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() => Object.fromEntries(rows.map((r) => [r.id, { structure: firstOk(r.structure), rate: r.rate, housing: r.housing, food: r.food, transport: r.transport, other: r.other }])));
  const [bulk, setBulk] = useState<Draft>({ structure: structures.length === 1 ? structures[0] : "", rate: "", housing: "", food: "", transport: "", other: "" });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [exit, setExit] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<Record<string, string>>({});
  const [note, setNote] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const payRows = rows.filter((r) => r.kind === "PAY");
  const set = (id: string, p: Partial<Draft>) => setDrafts((d) => ({ ...d, [id]: { ...d[id], ...p } }));

  function run(entries: FixPayEntry[]) {
    setNote(null);
    start(async () => {
      const res = await setPayFromRunAction(runId, entries);
      if (res.error) { setNote(res.error); return; }
      setMsg(Object.fromEntries(res.failed.map((f) => [f.employeeId, f.message])));
      setNote(res.fixed > 0 ? `Pay set for ${res.fixed} worker${res.fixed === 1 ? "" : "s"}. They are now in the run.${res.failed.length ? ` ${res.failed.length} couldn't be set; see the rows below.` : ""}` : res.failed.length ? "Nothing was saved; see the messages on the rows." : null);
      setSelected(new Set());
      router.refresh();
    });
  }

  function saveOne(id: string) {
    const entry = toEntry(id, drafts[id]);
    if (!entry) { setMsg((m) => ({ ...m, [id]: "Choose how they are paid." })); return; }
    run([entry]);
  }

  function applyToSelected() {
    if (selected.size === 0) return;
    const entries = [...selected].map((id) => toEntry(id, bulk)).filter((e): e is FixPayEntry => !!e);
    if (entries.length === 0) { setNote("Choose how they are paid and the rate first."); return; }
    run(entries);
  }

  function fixInactive(id: string, mode: "ACTIVE" | "EXIT") {
    setNote(null);
    start(async () => {
      const res = await fixInactiveFromRunAction(runId, id, mode, exit[id] ?? null);
      if (res.error) setMsg((m) => ({ ...m, [id]: res.error! }));
      else router.refresh();
    });
  }

  const allPaySelected = payRows.length > 0 && payRows.every((r) => selected.has(r.id));

  return (
    <section aria-label="Fix pay setup" className="card border-[var(--warning-border)] p-5">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--warning)]" aria-hidden />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-primary">Fix pay setup: {rows.length} worker{rows.length === 1 ? "" : "s"} can&rsquo;t be paid yet</h2>
          <p className="mt-0.5 text-xs text-muted">They are left out of this run until their pay is set. Set it here and they join the run straight away. Every change is kept in their pay history.</p>
        </div>
      </div>

      {canEdit && payRows.length > 1 && (
        <div className="mt-4 rounded-md border border-default bg-surface-subtle p-3">
          <p className="mb-2 text-xs font-medium text-primary">Same pay for several workers: tick them below, set the pay once, and apply.</p>
          <div className="flex flex-wrap items-end gap-3">
            <Inputs d={bulk} set={(p) => setBulk((b) => ({ ...b, ...p }))} structures={structures} disabled={pending} />
            <Button size="btn" type="button" disabled={pending || selected.size === 0} onClick={applyToSelected} loading={pending}>{`Apply to ${selected.size} selected`}</Button>
          </div>
        </div>
      )}

      {note && <p role="status" className="mt-3 text-sm text-secondary">{note}</p>}

      <ul className="mt-4 divide-y divide-[var(--border)]">
        {canEdit && payRows.length > 1 && (
          <li className="flex items-center gap-2 pb-2 text-xs text-muted">
            <Checkbox checked={allPaySelected} onCheckedChange={() => setSelected(allPaySelected ? new Set() : new Set(payRows.map((r) => r.id)))} />
            <span>Select all {payRows.length} workers with no pay</span>
          </li>
        )}
        {rows.map((r) => (
          <li key={r.id} className="space-y-2 py-3">
            <div className="flex flex-wrap items-center gap-3">
              {canEdit && r.kind === "PAY" && payRows.length > 1 && <Checkbox checked={selected.has(r.id)} onCheckedChange={() => setSelected((s) => { const n = new Set(s); if (n.has(r.id)) n.delete(r.id); else n.add(r.id); return n; })} />}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-primary">{r.name} <span className="font-normal text-subtle">{r.idNo}{r.trade ? ` · ${r.trade}` : ""}</span></p>
                <p className="text-xs text-[var(--warning-text,#92400e)]">{r.reason}</p>
              </div>
            </div>
            {r.kind === "PAY" ? (
              <div className="flex flex-wrap items-end gap-3 pl-0 sm:pl-7">
                <Inputs d={drafts[r.id]} set={(p) => set(r.id, p)} structures={structures} disabled={!canEdit || pending} />
                {canEdit && <button type="button" className="btn btn-secondary" disabled={pending} onClick={() => saveOne(r.id)}>Save</button>}
              </div>
            ) : (
              <div className="flex flex-wrap items-end gap-3 pl-0 sm:pl-7">
                {canEdit ? (
                  <>
                    <button type="button" className="btn btn-secondary" disabled={pending} onClick={() => fixInactive(r.id, "ACTIVE")}>Mark active</button>
                    <span className="pb-2 text-xs text-muted">or the day they left:</span>
                    <label className="block w-44"><span className="sr-only">Last working day</span><DatePicker value={exit[r.id] ?? ""} onChange={(v) => setExit((e) => ({ ...e, [r.id]: v }))} className="w-full" /></label>
                    <button type="button" className="btn btn-secondary" disabled={pending || !exit[r.id]} onClick={() => fixInactive(r.id, "EXIT")}>Set last working day</button>
                  </>
                ) : <p className="text-xs text-muted">Someone with payroll access can fix this.</p>}
              </div>
            )}
            {msg[r.id] && <Alert inline>{msg[r.id]}</Alert>}
          </li>
        ))}
      </ul>
      {!canEdit && <p className="mt-3 text-xs text-muted">You can see who is missing, but setting pay needs payroll edit access.</p>}
    </section>
  );
}
