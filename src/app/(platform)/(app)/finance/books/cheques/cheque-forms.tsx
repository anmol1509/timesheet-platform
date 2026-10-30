"use client";

import { todayInUae } from "@/lib/today";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogContent, DialogFooter, DialogTrigger } from "@/components/ui/Dialog";
import { DatePicker } from "@/components/ui/DatePicker";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { deleteChequeAction, saveChequeAction, setChequeStatusAction } from "./actions";
import { Alert } from "@/components/Alert";

type Opt = { id: string; label: string };
const today = () => todayInUae();
const num = (s: string) => Number(s.replace(/,/g, "")) || 0;

export function AddCheque({ clients, suppliers, banks, accounts }: { clients: Opt[]; suppliers: Opt[]; banks: Opt[]; accounts: Opt[] }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ direction: "RECEIVED", number: "", date: today(), amount: "", partyType: "CLIENT", party: "", name: "", bank: "", counter: "", narration: "" });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (k: keyof typeof f) => (v: string) => setF((c) => ({ ...c, [k]: v }));
  const parties = f.partyType === "CLIENT" ? clients : suppliers;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button type="button" size="sm">Add cheque</Button></DialogTrigger>
      <DialogContent title="Add a cheque" description="Post-dated cheques wait here. They reach the books on the day you mark them cleared.">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm font-medium text-primary">Cheque is<div className="mt-1"><Select value={f.direction} onChange={set("direction")} searchable={false} options={[{ value: "RECEIVED", label: "Received (we deposit it)" }, { value: "ISSUED", label: "Issued (we paid with it)" }]} /></div></label>
            <label className="text-sm font-medium text-primary">Cheque number<Input className="mt-1" value={f.number} onChange={(e) => set("number")(e.target.value)} /></label>
            <label className="text-sm font-medium text-primary">Date on the cheque<div className="mt-1"><DatePicker value={f.date} onChange={set("date")} ariaLabel="Cheque date" /></div></label>
            <label className="text-sm font-medium text-primary">Amount (AED)<Input className="mt-1 text-right" inputMode="decimal" value={f.amount} onChange={(e) => set("amount")(e.target.value)} /></label>
            <label className="text-sm font-medium text-primary">With a<div className="mt-1"><Select value={f.partyType} onChange={(v) => setF((c) => ({ ...c, partyType: v, party: "" }))} searchable={false} options={[{ value: "CLIENT", label: "Client" }, { value: "SUPPLIER", label: "Supplier" }, { value: "OTHER", label: "Someone else" }]} /></div></label>
            {f.partyType === "OTHER" ? (
              <label className="text-sm font-medium text-primary">Name<Input className="mt-1" value={f.name} onChange={(e) => set("name")(e.target.value)} /></label>
            ) : (
              <label className="text-sm font-medium text-primary">{f.partyType === "CLIENT" ? "Client" : "Supplier"}<div className="mt-1"><Select value={f.party} onChange={set("party")} options={parties.map((p) => ({ value: p.id, label: p.label }))} placeholder="Choose" searchable searchPlaceholder="Search" /></div></label>
            )}
          </div>
          {f.partyType === "OTHER" && <label className="block text-sm font-medium text-primary">Belongs to account<div className="mt-1"><Select value={f.counter} onChange={set("counter")} options={accounts.map((a) => ({ value: a.id, label: a.label }))} placeholder="Choose account (e.g. rent, loan, capital)" searchable searchPlaceholder="Search accounts" /></div></label>}
          <label className="block text-sm font-medium text-primary">{f.direction === "RECEIVED" ? "To be deposited in" : "Drawn on"}<div className="mt-1"><Select value={f.bank} onChange={set("bank")} searchable={false} options={[{ value: "", label: "Default bank" }, ...banks.map((b) => ({ value: b.id, label: b.label }))]} /></div></label>
          <label className="block text-sm font-medium text-primary">Note<Input className="mt-1" value={f.narration} onChange={(e) => set("narration")(e.target.value)} placeholder="e.g. September invoices" /></label>
          {error && <Alert>{error}</Alert>}
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button type="button" disabled={pending} onClick={() => start(async () => {
            const r = await saveChequeAction({ direction: f.direction, number: f.number, chequeDate: f.date, amount: num(f.amount), partyType: f.partyType, partyId: f.party || undefined, partyName: f.name, bankId: f.bank || undefined, counterAccountId: f.counter || undefined, narration: f.narration });
            if (r.error) { setError(r.error); return; }
            setOpen(false); setError(null); setF((c) => ({ ...c, number: "", amount: "", narration: "", name: "" }));
          })} loading={pending}>Add</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ChequeActions({ id, number, status }: { id: string; number: string; status: string }) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(today());
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (s: string, d?: string) => start(async () => { const r = await setChequeStatusAction({ id, status: s, clearedOn: d }); if (r.error) { setError(r.error); window.alert(r.error); } else setOpen(false); });
  return (
    <div className="flex justify-end gap-1.5">
      {status === "PENDING" && (
        <>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button type="button" size="sm" variant="secondary">Cleared</Button></DialogTrigger>
            <DialogContent title={`Cheque ${number} cleared`} description="The day the bank paid it or took it. The books record the money on this day.">
              <label className="mt-4 block text-sm font-medium text-primary">Cleared on<div className="mt-1"><DatePicker value={date} onChange={setDate} ariaLabel="Cleared on" /></div></label>
              {error && <Alert className="mt-2">{error}</Alert>}
              <DialogFooter><Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button type="button" disabled={pending} onClick={() => set("CLEARED", date)} loading={pending}>Mark cleared</Button></DialogFooter>
            </DialogContent>
          </Dialog>
          <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => set("BOUNCED")}>Bounced</Button>
          <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => set("CANCELLED")}>Cancel</Button>
        </>
      )}
      {status === "CLEARED" && <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => { if (window.confirm("Mark it pending again? Its entry leaves the books.")) set("PENDING"); }}>Undo</Button>}
      {status !== "CLEARED" && <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => { if (window.confirm(`Remove cheque ${number}?`)) start(async () => { const r = await deleteChequeAction(id); if (r.error) window.alert(r.error); }); }}>Remove</Button>}
    </div>
  );
}
