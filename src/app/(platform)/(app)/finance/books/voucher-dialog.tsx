"use client";

import { todayInUae } from "@/lib/today";
import { useState, useTransition } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogContent, DialogFooter, DialogTrigger } from "@/components/ui/Dialog";
import { DatePicker } from "@/components/ui/DatePicker";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { createVoucherAction } from "./actions";

type Line = { accountId: string; debit: string; credit: string; description: string };
const blank = (): Line => ({ accountId: "", debit: "", credit: "", description: "" });
const n = (s: string) => Math.round((Number(s) || 0) * 100) / 100;
const aed = (x: number) => x.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** A manual journal voucher: any set of debits and credits that balance. */
export function VoucherDialog({ accounts, minDate, label = "New voucher" }: { accounts: { id: string; label: string }[]; minDate?: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(() => todayInUae());
  const [narration, setNarration] = useState("");
  const [lines, setLines] = useState<Line[]>([blank(), blank()]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const debit = lines.reduce((s, l) => s + n(l.debit), 0);
  const credit = lines.reduce((s, l) => s + n(l.credit), 0);
  const diff = Math.round((debit - credit) * 100) / 100;
  const set = (i: number, patch: Partial<Line>) => setLines((cur) => cur.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  function save() {
    setError(null);
    start(async () => {
      const r = await createVoucherAction({ date, narration, lines: lines.map((l) => ({ accountId: l.accountId, debit: n(l.debit), credit: n(l.credit), description: l.description })) });
      if (r.error) { setError(r.error); return; }
      setOpen(false); setNarration(""); setLines([blank(), blank()]);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button type="button" size="sm"><Plus className="h-4 w-4" aria-hidden />{label}</Button></DialogTrigger>
      <DialogContent title="Journal voucher" description="Debits must equal credits." className="max-w-3xl!">
        <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
          <label className="text-sm font-medium text-primary">Date<div className="mt-1"><DatePicker value={date} onChange={setDate} ariaLabel="Voucher date" min={minDate} /></div></label>
          <label className="text-sm font-medium text-primary">What is it for<Input className="mt-1" value={narration} onChange={(e) => setNarration(e.target.value)} placeholder="e.g. Transfer from cash to bank" /></label>
        </div>
        <div className="mt-4 space-y-2">
          <div className="hidden grid-cols-[1fr_7rem_7rem_2rem] gap-2 px-1 text-xs text-muted sm:grid"><span>Account</span><span className="text-right">Debit</span><span className="text-right">Credit</span><span /></div>
          {lines.map((l, i) => (
            <div key={i} className="grid grid-cols-[1fr_6rem_6rem_2rem] items-center gap-2">
              <Select value={l.accountId} onChange={(v) => set(i, { accountId: v })} options={accounts.map((a) => ({ value: a.id, label: a.label }))} placeholder="Choose account" searchable searchPlaceholder="Search accounts" />
              <Input inputMode="decimal" aria-label={`Debit ${i + 1}`} className="text-right" value={l.debit} onChange={(e) => set(i, { debit: e.target.value, credit: e.target.value ? "" : l.credit })} />
              <Input inputMode="decimal" aria-label={`Credit ${i + 1}`} className="text-right" value={l.credit} onChange={(e) => set(i, { credit: e.target.value, debit: e.target.value ? "" : l.debit })} />
              <button type="button" aria-label={`Remove line ${i + 1}`} disabled={lines.length <= 2} onClick={() => setLines((cur) => cur.filter((_, j) => j !== i))} className="rounded-md p-1.5 text-muted hover:bg-surface-hover disabled:opacity-30"><X className="h-4 w-4" aria-hidden /></button>
            </div>
          ))}
          <button type="button" onClick={() => setLines((c) => [...c, blank()])} className="text-sm font-medium text-brand hover:underline">+ Add a line</button>
        </div>
        <div className="mt-4 flex items-center justify-between rounded-lg bg-[var(--surface-sunken)] px-3 py-2 text-sm">
          <span className="text-muted">Debit <span className="tabular font-medium text-primary">{aed(debit)}</span> · Credit <span className="tabular font-medium text-primary">{aed(credit)}</span></span>
          {debit === 0 && credit === 0 ? <span className="text-muted">Add amounts</span> : diff === 0 ? <span className="font-medium text-success">Balanced</span> : <span className="font-medium text-warning">Out by {aed(Math.abs(diff))}</span>}
        </div>
        {error && <p role="alert" className="mt-3 text-sm text-error">{error}</p>}
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button type="button" disabled={pending || diff !== 0 || (debit === 0 && credit === 0)} onClick={save}>{pending ? "Saving…" : "Post voucher"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
