"use client";

import { todayInUae } from "@/lib/today";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogContent, DialogFooter, DialogTrigger } from "@/components/ui/Dialog";
import { DatePicker } from "@/components/ui/DatePicker";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { createPartyEntryAction } from "./parties/actions";
import { receiveMoneyAction, type MoneyInSource } from "./actions";

type Kind = "CLIENT" | MoneyInSource;
const KINDS: { value: Kind; label: string; from: string }[] = [
  { value: "CLIENT", label: "Client payment", from: "Client" },
  { value: "OTHER_INCOME", label: "Other income (interest, commission, rent...)", from: "Received from" },
  { value: "CAPITAL", label: "Owner or partner capital", from: "Owner / partner" },
  { value: "STAFF_REPAYMENT", label: "Staff repaying an advance or loan", from: "Employee" },
  { value: "SUPPLIER_REFUND", label: "Refund from a supplier", from: "Supplier" },
  { value: "OTHER", label: "Something else (choose the account)", from: "Received from" },
];

/** Money in: a client part payment or advance, or money from any other source (income, capital, refunds, loans...). */
export function ReceivePayment({ clients, moneyAccounts, otherAccounts, minDate, foreign = {} }: { clients: { id: string; name: string }[]; moneyAccounts: { id: string; label: string }[]; otherAccounts: { id: string; label: string }[]; minDate: string; foreign?: Record<string, { currency: string; rate: number | null }> }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind>("CLIENT");
  const [client, setClient] = useState("");
  const [payer, setPayer] = useState("");
  const [credit, setCredit] = useState("");
  const [money, setMoney] = useState(moneyAccounts[0]?.id ?? "");
  const [date, setDate] = useState(() => todayInUae());
  const [amount, setAmount] = useState("");
  const [narration, setNarration] = useState("");
  const [rate, setRate] = useState(() => { const f = foreign[moneyAccounts[0]?.id ?? ""]; return f?.rate ? String(f.rate) : ""; });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const fx = foreign[money];
  const aedValue = Math.round((Number(amount.replace(/,/g, "")) || 0) * (Number(rate) || 0) * 100) / 100;
  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setError(null); }}>
      <DialogTrigger asChild><Button type="button" size="sm" variant="secondary">Money in</Button></DialogTrigger>
      <DialogContent title="Money in" description="Any money received. A client invoice marked paid posts its own receipt, so use this for part payments, advances and money from anyone else.">
        <div className="space-y-3">
          <label className="block text-sm font-medium text-primary">What kind of money<div className="mt-1"><Select value={kind} onChange={(v) => setKind(v as Kind)} options={KINDS.map((k) => ({ value: k.value, label: k.label }))} /></div></label>
          {kind === "CLIENT" ? (
            <label className="block text-sm font-medium text-primary">From<div className="mt-1"><Select value={client} onChange={setClient} options={clients.map((c) => ({ value: c.id, label: c.name }))} placeholder="Choose client" searchable searchPlaceholder="Search clients" /></div></label>
          ) : (
            <label className="block text-sm font-medium text-primary">{KINDS.find((k) => k.value === kind)?.from}<Input className="mt-1" value={payer} onChange={(e) => setPayer(e.target.value)} placeholder="Name of the person or company" /></label>
          )}
          {kind === "OTHER" && <label className="block text-sm font-medium text-primary">Credit to<div className="mt-1"><Select value={credit} onChange={setCredit} options={otherAccounts.map((a) => ({ value: a.id, label: a.label }))} placeholder="Choose account (e.g. a loan or deposit)" searchable searchPlaceholder="Search accounts" /></div></label>}
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm font-medium text-primary">Date<div className="mt-1"><DatePicker value={date} onChange={setDate} ariaLabel="Date" min={minDate} /></div></label>
            <label className="text-sm font-medium text-primary">{fx ? `Amount in ${fx.currency}` : "Amount"}<Input className="mt-1 text-right" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" /></label>
          </div>
          <label className="block text-sm font-medium text-primary">Paid in to<div className="mt-1"><Select value={money} onChange={(v) => { setMoney(v); setRate(foreign[v]?.rate ? String(foreign[v].rate) : ""); }} options={moneyAccounts.map((a) => ({ value: a.id, label: a.label }))} placeholder="Choose account" /></div></label>
          {fx && (
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm font-medium text-primary">Exchange rate<Input className="mt-1 text-right" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} placeholder={`AED for 1 ${fx.currency}`} /></label>
              <p className="self-end pb-2 text-sm text-muted">= AED <span className="tabular font-medium text-primary">{aedValue.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></p>
            </div>
          )}
          <label className="block text-sm font-medium text-primary">What it is for<Input className="mt-1" value={narration} onChange={(e) => setNarration(e.target.value)} placeholder={kind === "CLIENT" ? "e.g. Part payment for INV-0042" : "e.g. Bank interest for September"} /></label>
          {kind === "CLIENT" && fx && <p className="text-sm text-warning">Client payments are in dirhams. Pick an AED account, or choose another kind of money for a {fx.currency} receipt.</p>}
          {error && <p role="alert" className="text-sm text-error">{error}</p>}
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button type="button" disabled={pending || (kind === "CLIENT" ? !client || !!fx : !payer.trim())} onClick={() => start(async () => {
            const value = Number(amount.replace(/,/g, "")) || 0;
            const r = kind === "CLIENT"
              ? await createPartyEntryAction({ type: "CLIENT", partyId: client, kind: "MONEY", date, amount: value, narration, moneyAccountId: money })
              : await receiveMoneyAction({ source: kind, from: payer, date, amount: fx ? 0 : value, narration, moneyAccountId: money, creditAccountId: credit, ...(fx ? { foreign: { amount: value, rate: Number(rate) || 0 } } : {}) });
            if (r.error) { setError(r.error); return; }
            setOpen(false); setAmount(""); setNarration(""); setClient(""); setPayer(""); setCredit("");
          })}>{pending ? "Saving…" : "Post"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
