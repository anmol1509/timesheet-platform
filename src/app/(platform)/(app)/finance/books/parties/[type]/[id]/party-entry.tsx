"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/Dialog";
import { DatePicker } from "@/components/ui/DatePicker";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { createPartyEntryAction } from "../../actions";

const aed = (n: number) => n.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Credit note / debit note, and part payments or advances, recorded against one client or supplier. */
export function PartyEntry({ type, partyId, moneyAccounts, minDate }: { type: "CLIENT" | "SUPPLIER"; partyId: string; moneyAccounts: { id: string; label: string }[]; minDate: string }) {
  const client = type === "CLIENT";
  const [kind, setKind] = useState<"NOTE" | "MONEY" | null>(null);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState("");
  const [vat, setVat] = useState("");
  const [narration, setNarration] = useState("");
  const [money, setMoney] = useState(moneyAccounts[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const note = kind === "NOTE";
  const names = { NOTE: client ? "Credit note" : "Debit note", MONEY: client ? "Receipt" : "Payment" };
  const num = (s: string) => Number(s.replace(/,/g, "")) || 0;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="secondary" onClick={() => { setKind("NOTE"); setError(null); setNarration(""); }}>{names.NOTE}</Button>
        <Button type="button" size="sm" variant="secondary" onClick={() => { setKind("MONEY"); setError(null); setNarration(""); }}>{client ? "Record receipt" : "Record payment"}</Button>
        {done && <span role="status" className="text-sm text-success">{done}</span>}
      </div>
      <Dialog open={!!kind} onOpenChange={(o) => !o && setKind(null)}>
        <DialogContent title={kind ? names[kind] : ""} description={note ? (client ? "Reduces what the client owes and the sales and VAT you reported." : "Reduces what you owe and the cost and VAT you claimed.") : "For part payments and advances. Invoices marked paid, and bill payments, post by themselves."}>
          <div className="space-y-3">
            <label className="block text-sm font-medium text-primary">Date<div className="mt-1"><DatePicker value={date} onChange={setDate} ariaLabel="Date" min={minDate} /></div></label>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm font-medium text-primary">{note ? "Amount before VAT" : "Amount"}<Input className="mt-1 text-right" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" /></label>
              {note && <label className="text-sm font-medium text-primary">VAT<Input className="mt-1 text-right" inputMode="decimal" value={vat} onChange={(e) => setVat(e.target.value)} placeholder="0.00" /><button type="button" className="mt-1 text-xs font-medium text-brand hover:underline" onClick={() => setVat((Math.round(num(amount) * 5) / 100).toFixed(2))}>5% of the amount</button></label>}
            </div>
            {!note && (
              <label className="block text-sm font-medium text-primary">{client ? "Paid in to" : "Paid from"}
                <div className="mt-1"><Select value={money} onChange={setMoney} options={moneyAccounts.map((a) => ({ value: a.id, label: a.label }))} placeholder="Choose account" /></div>
              </label>
            )}
            <label className="block text-sm font-medium text-primary">What it is for<Input className="mt-1" value={narration} onChange={(e) => setNarration(e.target.value)} placeholder={note ? "e.g. Credit against INV-0042, 3 workers removed" : "e.g. Advance for November"} /></label>
            {note && num(amount) > 0 && <p className="text-sm text-muted">Total {aed(num(amount) + num(vat))}</p>}
            {error && <p role="alert" className="text-sm text-error">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setKind(null)}>Cancel</Button>
            <Button type="button" disabled={pending} onClick={() => start(async () => {
              const r = await createPartyEntryAction({ type, partyId, kind: kind!, date, amount: num(amount), vat: num(vat), narration, moneyAccountId: kind === "MONEY" ? money : undefined });
              if (r.error) { setError(r.error); return; }
              setDone(`${names[kind!]} ${r.number} posted.`); setKind(null); setAmount(""); setVat("");
            })}>{pending ? "Saving…" : "Post"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
