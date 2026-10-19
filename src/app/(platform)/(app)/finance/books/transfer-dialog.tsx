"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogContent, DialogFooter, DialogTrigger } from "@/components/ui/Dialog";
import { DatePicker } from "@/components/ui/DatePicker";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { createTransferAction } from "./actions";

/** Money moved between the company's own bank and cash accounts. */
export function TransferDialog({ accounts, minDate }: { accounts: { id: string; label: string }[]; minDate: string }) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(accounts[0]?.id ?? "");
  const [to, setTo] = useState(accounts[1]?.id ?? "");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
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
          <label className="block text-sm font-medium text-primary">Note (optional)<Input className="mt-1" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Cash deposited" /></label>
          {error && <p role="alert" className="text-sm text-error">{error}</p>}
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button type="button" disabled={pending} onClick={() => start(async () => {
            const r = await createTransferAction({ from, to, date, amount: Number(amount.replace(/,/g, "")) || 0, narration: note });
            if (r.error) { setError(r.error); return; }
            setOpen(false); setError(null); setAmount(""); setNote("");
          })}>{pending ? "Saving…" : "Transfer"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
