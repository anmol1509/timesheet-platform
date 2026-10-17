"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { savePartyOpeningAction } from "../../actions";

/** What they owed on the day the books start. Splits the account's opening balance; it does not add to it. */
export function PartyOpening({ type, partyId, amount, openingDate, canWrite }: { type: "CLIENT" | "SUPPLIER"; partyId: string; amount: number; openingDate: string; canWrite: boolean }) {
  const [value, setValue] = useState(amount ? String(amount) : "");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  if (!canWrite && !amount) return null;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-[var(--radius-card)] border border-border bg-surface px-4 py-3 text-sm">
      <label htmlFor="party-opening" className="text-secondary">{type === "CLIENT" ? "Owed to you" : "You owed"} on {openingDate}</label>
      <input id="party-opening" inputMode="decimal" disabled={!canWrite} value={value} onChange={(e) => setValue(e.target.value)} className="input h-8 w-36 text-right" placeholder="0.00" />
      {canWrite && <Button type="button" size="sm" variant="secondary" disabled={pending} onClick={() => start(async () => { const r = await savePartyOpeningAction(type, partyId, Number(value.replace(/,/g, "")) || 0); setMsg(r.error ? { ok: false, text: r.error } : { ok: true, text: "Saved." }); })}>{pending ? "Saving…" : "Save"}</Button>}
      {msg && <span role={msg.ok ? "status" : "alert"} className={msg.ok ? "text-success" : "text-error"}>{msg.text}</span>}
    </div>
  );
}
