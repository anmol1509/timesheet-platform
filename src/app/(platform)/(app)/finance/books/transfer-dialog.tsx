"use client";

import { todayInUae } from "@/lib/today";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogContent, DialogFooter, DialogTrigger } from "@/components/ui/Dialog";
import { DatePicker } from "@/components/ui/DatePicker";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { createTransferAction } from "./actions";

/** Money moved between the company's own bank and cash accounts. */
export function TransferDialog({ accounts, minDate, foreign = {} }: { accounts: { id: string; label: string }[]; minDate: string; foreign?: Record<string, { currency: string; rate: number | null }> }) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(accounts[0]?.id ?? "");
  const [to, setTo] = useState(accounts[1]?.id ?? "");
  const [date, setDate] = useState(() => todayInUae());
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [fromF, setFromF] = useState("");
  const [toF, setToF] = useState("");
  const fxFrom = foreign[from], fxTo = foreign[to];
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const opts = accounts.map((a) => ({ value: a.id, label: a.label }));
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button type="button" size="sm" variant="secondary">Transfer</Button></DialogTrigger>
      <DialogContent title="Transfer between accounts" description="Moving your own money from one bank or cash account to another, such as cash deposited at the bank.">
        <div className="space-y-3">
          <label className="block text-sm font-medium text-primary">From<div className="mt-1"><Select value={from} onChange={setFrom} options={opts} placeholder="Choose account" /></div></label>
          <label className="block text-sm font-medium text-primary">To<div className="mt-1"><Select value={to} onChange={setTo} options={opts} placeholder="Choose account" /></div></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm font-medium text-primary">Date<div className="mt-1"><DatePicker value={date} onChange={setDate} ariaLabel="Date" min={minDate} /></div></label>
            <label className="text-sm font-medium text-primary">Amount<Input className="mt-1 text-right" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" /></label>
          </div>
          {(fxFrom || fxTo) && (
            <div className="grid grid-cols-2 gap-3">
              {fxFrom && <label className="text-sm font-medium text-primary">Sent in {fxFrom.currency}<Input className="mt-1 text-right" inputMode="decimal" value={fromF} onChange={(e) => setFromF(e.target.value)} /></label>}
              {fxTo && <label className="text-sm font-medium text-primary">Received in {fxTo.currency}<Input className="mt-1 text-right" inputMode="decimal" value={toF} onChange={(e) => setToF(e.target.value)} /></label>}
              <p className="col-span-2 text-xs text-muted">The amount above is the dirham value of the transfer. The books keep both amounts so the account can be revalued.</p>
            </div>
          )}
          <label className="block text-sm font-medium text-primary">Note (optional)<Input className="mt-1" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Cash deposited" /></label>
          {error && <p role="alert" className="text-sm text-error">{error}</p>}
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button type="button" disabled={pending} onClick={() => start(async () => {
            const r = await createTransferAction({ from, to, date, amount: Number(amount.replace(/,/g, "")) || 0, narration: note, fromForeign: Number(fromF.replace(/,/g, "")) || undefined, toForeign: Number(toF.replace(/,/g, "")) || undefined });
            if (r.error) { setError(r.error); return; }
            setOpen(false); setError(null); setAmount(""); setNote(""); setFromF(""); setToF("");
          })}>{pending ? "Saving…" : "Transfer"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
