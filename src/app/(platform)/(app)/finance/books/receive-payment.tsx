"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogContent, DialogFooter, DialogTrigger } from "@/components/ui/Dialog";
import { DatePicker } from "@/components/ui/DatePicker";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { createPartyEntryAction } from "./parties/actions";

/** Money received from a client that isn't an invoice marked paid: a part payment or an advance. */
export function ReceivePayment({ clients, moneyAccounts, minDate }: { clients: { id: string; name: string }[]; moneyAccounts: { id: string; label: string }[]; minDate: string }) {
  const [open, setOpen] = useState(false);
  const [client, setClient] = useState("");
  const [money, setMoney] = useState(moneyAccounts[0]?.id ?? "");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState("");
  const [narration, setNarration] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button type="button" size="sm" variant="secondary">Receive payment</Button></DialogTrigger>
      <DialogContent title="Receive payment" description="For part payments and advances. An invoice marked paid posts its receipt by itself.">
        <div className="space-y-3">
          <label className="block text-sm font-medium text-primary">From<div className="mt-1"><Select value={client} onChange={setClient} options={clients.map((c) => ({ value: c.id, label: c.name }))} placeholder="Choose client" searchable searchPlaceholder="Search clients" /></div></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm font-medium text-primary">Date<div className="mt-1"><DatePicker value={date} onChange={setDate} ariaLabel="Date" min={minDate} /></div></label>
            <label className="text-sm font-medium text-primary">Amount<Input className="mt-1 text-right" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" /></label>
          </div>
          <label className="block text-sm font-medium text-primary">Paid in to<div className="mt-1"><Select value={money} onChange={setMoney} options={moneyAccounts.map((a) => ({ value: a.id, label: a.label }))} placeholder="Choose account" /></div></label>
          <label className="block text-sm font-medium text-primary">What it is for<Input className="mt-1" value={narration} onChange={(e) => setNarration(e.target.value)} placeholder="e.g. Part payment for INV-0042" /></label>
          {error && <p role="alert" className="text-sm text-error">{error}</p>}
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button type="button" disabled={pending || !client} onClick={() => start(async () => {
            const r = await createPartyEntryAction({ type: "CLIENT", partyId: client, kind: "MONEY", date, amount: Number(amount.replace(/,/g, "")) || 0, narration, moneyAccountId: money });
            if (r.error) { setError(r.error); return; }
            setOpen(false); setAmount(""); setNarration(""); setClient("");
          })}>{pending ? "Saving…" : "Post"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
