"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check } from "lucide-react";
import { MaskedInput } from "@/components/ui/MaskedInput";
import { Hint } from "@/components/Hint";
import { fixBankDetailsAction } from "../actions";

import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/Alert";
export type BankGapRow = { employeeId: string; name: string; idNo: string; gaps: string[]; defaults: { personCode: string; routingCode: string; iban: string; bankName: string } };

/**
 * Workers whose bank details are incomplete, fixed one after another: the list on top, and "Fix" (or Start) opens only
 * that worker's missing fields with Save and next, so 24 workers are 24 short forms instead of a long page of lists.
 * Where it stands is kept here, so the list behind it changing as each one is saved does not move you.
 */
export function BankFixQueue({ runId, canEdit, rows }: { runId: string; canEdit: boolean; rows: BankGapRow[] }) {
  const router = useRouter();
  const [queue, setQueue] = useState<BankGapRow[] | null>(null);
  const [pos, setPos] = useState(0);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const form = useRef<HTMLFormElement>(null);

  const remaining = (q: BankGapRow[], d: Set<string>) => q.filter((r) => !d.has(r.employeeId));

  function begin(at?: string) {
    const snapshot = rows;
    setQueue(snapshot);
    setDone(new Set());
    setError(null);
    setPos(Math.max(0, at ? snapshot.findIndex((r) => r.employeeId === at) : 0));
  }
  function advance(q: BankGapRow[], d: Set<string>, from: number) {
    // The next worker after this one that is not done yet; none left means the queue is finished.
    for (let i = 1; i <= q.length; i++) {
      const j = (from + i) % q.length;
      if (!d.has(q[j].employeeId)) { setPos(j); return; }
    }
    setPos(-1);
    router.refresh();
  }
  function save(mode: "BANK" | "CASH") {
    if (!queue || !form.current) return;
    const cur = queue[pos];
    const fd = new FormData(form.current);
    fd.set("runId", runId);
    fd.set("employeeId", cur.employeeId);
    fd.set("mode", mode);
    setError(null);
    start(async () => {
      const r = await fixBankDetailsAction(fd);
      if (r.error) { setError(r.error); return; }
      const next = new Set(done).add(cur.employeeId);
      setDone(next);
      advance(queue, next, pos);
    });
  }
  function skip() {
    if (!queue) return;
    // Skipping leaves the worker not done, so Start picks them up again; move on to the next one.
    const j = (pos + 1) % queue.length;
    setPos(j);
    setError(null);
  }

  // Finished.
  if (queue && pos === -1) {
    return (
      <div className="space-y-3">
        <p className="flex items-center gap-2 rounded-md border border-[var(--success-border)] bg-[var(--success-soft)] px-3 py-3 text-sm font-medium text-[var(--success)]"><Check className="h-4 w-4" aria-hidden /> All {queue.length} are done. The run has been worked out again.</p>
        <button type="button" className="btn btn-secondary" onClick={() => setQueue(null)}>Back to the list</button>
      </div>
    );
  }

  // One worker's form.
  if (queue && queue[pos]) {
    const cur = queue[pos];
    const left = remaining(queue, done).length;
    return (
      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between text-xs text-muted">
            <span>{queue.length - left} of {queue.length} done · {left} left</span>
            <button type="button" className="font-medium text-[var(--brand-primary)] hover:underline" onClick={() => { setQueue(null); router.refresh(); }}>Back to the list</button>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--surface-sunken)]"><div className="h-full rounded-full bg-[var(--brand-primary)] transition-all" style={{ width: `${((queue.length - left) / queue.length) * 100}%` }} /></div>
        </div>
        <div>
          <p className="text-base font-semibold text-primary">{cur.name}</p>
          <p className="text-xs text-muted">{cur.idNo} · missing {cur.gaps.join(", ")} · <Link href={`/employees/${cur.employeeId}`} target="_blank" rel="noopener noreferrer" className="text-[var(--brand-primary)] hover:underline">open profile</Link></p>
        </div>
        <form key={cur.employeeId} ref={form} onSubmit={(e) => { e.preventDefault(); save("BANK"); }} className="grid gap-3 sm:grid-cols-2" aria-label={`Bank details for ${cur.name}`}>
          <label className="block text-xs text-muted">MOL person code <Hint term="MOL_PERSON_CODE" />
            <input name="personCode" defaultValue={cur.defaults.personCode} className="input mt-1 h-10 w-full text-sm" inputMode="numeric" autoFocus />
          </label>
          <label className="block text-xs text-muted">Bank routing code (9 digits) <Hint term="ROUTING_CODE" />
            <input name="routingCode" defaultValue={cur.defaults.routingCode} className="input mt-1 h-10 w-full text-sm" inputMode="numeric" maxLength={9} />
          </label>
          <label className="block text-xs text-muted sm:col-span-2">IBAN <Hint term="IBAN" />
            <MaskedInput kind="iban" name="wpsIban" defaultValue={cur.defaults.iban} className="input mt-1 h-10 w-full text-sm" />
          </label>
          <label className="block text-xs text-muted sm:col-span-2">Bank name (optional)
            <input name="bankName" defaultValue={cur.defaults.bankName} className="input mt-1 h-10 w-full text-sm" />
          </label>
          <div className="flex flex-wrap items-center gap-2 border-t border-default pt-3 sm:col-span-2">
            <Button size="btn" type="submit" disabled={pending || !canEdit} loading={pending}>{left > 1 ? "Save and next ›" : "Save and finish"}</Button>
            <button type="button" disabled={pending || !canEdit} className="btn btn-secondary" onClick={() => save("CASH")}>Paid in cash</button>
            <button type="button" disabled={pending || left <= 1} className="btn btn-secondary" onClick={skip}>Skip</button>
            {error && <Alert inline className="w-full">{error}</Alert>}
          </div>
        </form>
      </div>
    );
  }

  // The list.
  return (
    <div className="space-y-3">
      <p className="text-sm text-secondary">This does not stop approval; the WPS bank file needs them. Fix them one after another, or mark a worker as paid in cash.</p>
      {canEdit && <button type="button" className="btn btn-primary" onClick={() => begin()}>Start fixing ({rows.length})</button>}
      <ul className="divide-y divide-[var(--border)] rounded-md border border-default">
        {rows.map((r) => (
          <li key={r.employeeId} className="flex items-center gap-3 px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-primary">{r.name} <span className="text-xs font-normal text-subtle">{r.idNo}</span></p>
              <p className="mt-0.5 flex flex-wrap gap-1">{r.gaps.map((g) => <span key={g} className="rounded border border-default bg-surface-subtle px-1.5 py-0.5 text-[11px] text-secondary">{g}</span>)}</p>
            </div>
            {canEdit && <button type="button" className="btn btn-secondary btn-sm shrink-0" onClick={() => begin(r.employeeId)}>Fix</button>}
          </li>
        ))}
      </ul>
    </div>
  );
}
