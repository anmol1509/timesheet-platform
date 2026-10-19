"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogContent, DialogFooter, DialogTrigger } from "@/components/ui/Dialog";
import { DatePicker } from "@/components/ui/DatePicker";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { deleteRecurringAction, saveRecurringAction } from "./actions";

type Opt = { id: string; label: string };
export type RecurringRow = { id: string; name: string; frequency: string; startDate: string; endDate: string; debitAccountId: string; creditAccountId: string; amount: number; active: boolean };
const num = (s: string) => Number(s.replace(/,/g, "")) || 0;
const FREQ = [{ value: "MONTHLY", label: "Every month" }, { value: "QUARTERLY", label: "Every 3 months" }, { value: "YEARLY", label: "Every year" }];

export function RecurringDialog({ accounts, row }: { accounts: Opt[]; row?: RecurringRow }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: row?.name ?? "", frequency: row?.frequency ?? "MONTHLY", start: row?.startDate ?? new Date().toISOString().slice(0, 10), end: row?.endDate ?? "", debit: row?.debitAccountId ?? "", credit: row?.creditAccountId ?? "", amount: row ? String(row.amount) : "" });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (k: keyof typeof f) => (v: string) => setF((c) => ({ ...c, [k]: v }));
  const opts = accounts.map((a) => ({ value: a.id, label: a.label }));
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{row ? <Button type="button" size="sm" variant="ghost">Change</Button> : <Button type="button" size="sm">New recurring entry</Button>}</DialogTrigger>
      <DialogContent title={row ? "Change recurring entry" : "New recurring entry"} description="Posts itself on every due date, from the first date until today. Rent, insurance, a loan instalment, a retainer.">
        <div className="space-y-3">
          <label className="block text-sm font-medium text-primary">What is it for<Input className="mt-1" value={f.name} onChange={(e) => set("name")(e.target.value)} placeholder="e.g. Office rent" /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm font-medium text-primary">How often<div className="mt-1"><Select value={f.frequency} onChange={set("frequency")} options={FREQ} searchable={false} /></div></label>
            <label className="text-sm font-medium text-primary">Amount (AED)<Input className="mt-1 text-right" inputMode="decimal" value={f.amount} onChange={(e) => set("amount")(e.target.value)} /></label>
            <label className="text-sm font-medium text-primary">First date<div className="mt-1"><DatePicker value={f.start} onChange={set("start")} ariaLabel="First date" /></div></label>
            <label className="text-sm font-medium text-primary">Last date (optional)<div className="mt-1"><DatePicker value={f.end} onChange={set("end")} ariaLabel="Last date" /></div></label>
          </div>
          <label className="block text-sm font-medium text-primary">Debit (what it is spent on)<div className="mt-1"><Select value={f.debit} onChange={set("debit")} options={opts} placeholder="e.g. Office & admin" searchable searchPlaceholder="Search accounts" /></div></label>
          <label className="block text-sm font-medium text-primary">Credit (where the money comes from)<div className="mt-1"><Select value={f.credit} onChange={set("credit")} options={opts} placeholder="e.g. your bank account" searchable searchPlaceholder="Search accounts" /></div></label>
          {error && <p role="alert" className="text-sm text-error">{error}</p>}
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button type="button" disabled={pending} onClick={() => start(async () => {
            const r = await saveRecurringAction({ id: row?.id, name: f.name, frequency: f.frequency, startDate: f.start, endDate: f.end || undefined, debitAccountId: f.debit, creditAccountId: f.credit, amount: num(f.amount), active: row?.active ?? true });
            if (r.error) { setError(r.error); return; }
            setOpen(false); setError(null);
            if (!row) setF((c) => ({ ...c, name: "", amount: "" }));
          })}>{pending ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RecurringActions({ accounts, row }: { accounts: Opt[]; row: RecurringRow }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex justify-end gap-1.5">
      <RecurringDialog accounts={accounts} row={row} />
      <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => start(async () => { const r = await saveRecurringAction({ ...row, endDate: row.endDate || undefined, active: !row.active }); if (r.error) window.alert(r.error); })}>{row.active ? "Pause" : "Resume"}</Button>
      <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => { if (window.confirm(`Remove "${row.name}"? The entries it posted are removed too, unless their month is locked.`)) start(async () => { const r = await deleteRecurringAction(row.id); if (r.error) window.alert(r.error); }); }}>Remove</Button>
    </div>
  );
}
