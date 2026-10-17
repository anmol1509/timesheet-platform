"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { DatePicker } from "@/components/ui/DatePicker";
import { lockBooksAction, refreshPostingsAction, saveOpeningBalancesAction } from "../actions";

const aed = (n: number) => n.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = (s: string) => Math.round((Number(s.replace(/,/g, "")) || 0) * 100) / 100;

type Row = { id: string; code: string; name: string; type: string; debit: number; credit: number };

/** Opening balances typed by hand: any difference goes to Opening balance equity so the books open balanced. */
export function OpeningBalancesEditor({ rows, canEdit, openingDate }: { rows: Row[]; canEdit: boolean; openingDate: string }) {
  const [vals, setVals] = useState(() => Object.fromEntries(rows.map((r) => [r.id, { debit: r.debit ? String(r.debit) : "", credit: r.credit ? String(r.credit) : "" }])));
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const set = (id: string, side: "debit" | "credit", v: string) => setVals((c) => ({ ...c, [id]: side === "debit" ? { debit: v, credit: v ? "" : (c[id]?.credit ?? "") } : { credit: v, debit: v ? "" : (c[id]?.debit ?? "") } }));
  const at = (id: string) => vals[id] ?? { debit: "", credit: "" };
  const debit = Object.values(vals).reduce((s, v) => s + num(v.debit), 0);
  const credit = Object.values(vals).reduce((s, v) => s + num(v.credit), 0);
  const diff = Math.round((debit - credit) * 100) / 100;
  return (
    <div className="space-y-3">
      <div className="max-h-96 overflow-auto rounded-[var(--radius-card)] border border-default">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-[var(--surface-sunken)] text-left text-xs text-muted"><tr><th className="px-3 py-2 font-medium">Account</th><th className="w-32 px-3 py-2 text-right font-medium">Debit</th><th className="w-32 px-3 py-2 text-right font-medium">Credit</th></tr></thead>
          <tbody className="divide-y divide-default">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-3 py-1.5"><span className="mr-2 font-mono text-xs text-muted">{r.code}</span>{r.name}</td>
                {(["debit", "credit"] as const).map((side) => (
                  <td key={side} className="px-3 py-1">
                    <input inputMode="decimal" disabled={!canEdit} aria-label={`${side} ${r.name}`} value={at(r.id)[side]} onChange={(e) => set(r.id, side, e.target.value)} className="input h-8 w-full text-right" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <span className="text-muted">Debit <span className="tabular font-medium text-primary">{aed(debit)}</span> · Credit <span className="tabular font-medium text-primary">{aed(credit)}</span>{diff !== 0 && <span className="ml-2 text-warning">{aed(Math.abs(diff))} difference goes to Opening balance equity</span>}</span>
        {canEdit && (
          <Button type="button" size="sm" disabled={pending} onClick={() => start(async () => {
            const r = await saveOpeningBalancesAction(rows.map((x) => ({ accountId: x.id, debit: num(at(x.id).debit), credit: num(at(x.id).credit) })));
            setMsg(r.error ? { ok: false, text: r.error } : { ok: true, text: `Saved as at ${openingDate}.` });
          })}>{pending ? "Saving…" : "Save opening balances"}</Button>
        )}
      </div>
      {msg && <p role={msg.ok ? "status" : "alert"} className={`text-sm ${msg.ok ? "text-success" : "text-error"}`}>{msg.text}</p>}
    </div>
  );
}

/** Closing a period: nothing on or before the date can be added, changed or voided. */
export function LockControl({ lockedUntil, minDate }: { lockedUntil: string | null; minDate: string }) {
  const [date, setDate] = useState(lockedUntil ?? "");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const run = (d: string | null) => start(async () => { const r = await lockBooksAction(d); setMsg(r.error ? { ok: false, text: r.error } : { ok: true, text: d ? `Locked up to ${d}.` : "Unlocked." }); });
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <DatePicker value={date} onChange={setDate} ariaLabel="Lock books up to" min={minDate} />
        <Button type="button" size="sm" disabled={pending || !date} onClick={() => run(date)}>Lock up to this date</Button>
        {lockedUntil && <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => { setDate(""); run(null); }}>Unlock</Button>}
      </div>
      {msg && <p role={msg.ok ? "status" : "alert"} className={`text-sm ${msg.ok ? "text-success" : "text-error"}`}>{msg.text}</p>}
    </div>
  );
}

/** The books refresh themselves when opened; this forces it and says what changed. */
export function RefreshControl() {
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-2">
      <Button type="button" size="sm" variant="secondary" disabled={pending} onClick={() => start(async () => {
        const r = await refreshPostingsAction();
        setMsg(r.error ? r.error : `${r.created} new, ${r.updated} updated, ${r.removed} removed.${r.unmapped?.length ? ` Not posted (no account): ${r.unmapped.join(", ")}.` : ""}`);
      })}>{pending ? "Posting…" : "Post everything now"}</Button>
      {msg && <p role="status" className="text-sm text-secondary">{msg}</p>}
    </div>
  );
}
