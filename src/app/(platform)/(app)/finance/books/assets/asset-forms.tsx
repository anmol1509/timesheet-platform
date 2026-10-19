"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogContent, DialogFooter, DialogTrigger } from "@/components/ui/Dialog";
import { DatePicker } from "@/components/ui/DatePicker";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { deleteAssetAction, disposeAssetAction, saveAssetAction } from "./actions";

type Opt = { id: string; label: string };
const today = () => new Date().toISOString().slice(0, 10);
const num = (s: string) => Number(s.replace(/,/g, "")) || 0;

export function AddAsset({ accounts, minDate }: { accounts: Opt[]; minDate: string }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: "", category: "", cost: "", salvage: "0", years: "5", date: today(), paidFrom: "" });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (k: keyof typeof f) => (v: string) => setF((c) => ({ ...c, [k]: v }));
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button type="button" size="sm">Add asset</Button></DialogTrigger>
      <DialogContent title="Add an asset" description="Something the company owns and uses for years, such as a vehicle, camp furniture or equipment. It is written off evenly over its life.">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm font-medium text-primary">Name<Input className="mt-1" value={f.name} onChange={(e) => set("name")(e.target.value)} placeholder="e.g. Toyota Hiace bus" /></label>
            <label className="text-sm font-medium text-primary">Type<Input className="mt-1" value={f.category} onChange={(e) => set("category")(e.target.value)} placeholder="Vehicle, furniture…" /></label>
            <label className="text-sm font-medium text-primary">Cost (AED)<Input className="mt-1 text-right" inputMode="decimal" value={f.cost} onChange={(e) => set("cost")(e.target.value)} /></label>
            <label className="text-sm font-medium text-primary">Worth at the end (AED)<Input className="mt-1 text-right" inputMode="decimal" value={f.salvage} onChange={(e) => set("salvage")(e.target.value)} /></label>
            <label className="text-sm font-medium text-primary">Bought on<div className="mt-1"><DatePicker value={f.date} onChange={set("date")} ariaLabel="Bought on" /></div></label>
            <label className="text-sm font-medium text-primary">Lasts (years)<Input className="mt-1 text-right" inputMode="decimal" value={f.years} onChange={(e) => set("years")(e.target.value)} /></label>
          </div>
          <label className="block text-sm font-medium text-primary">Record the purchase, paid from<div className="mt-1"><Select value={f.paidFrom} onChange={set("paidFrom")} options={[{ value: "", label: "Already in the books (don't post)" }, ...accounts.map((a) => ({ value: a.id, label: a.label }))]} /></div></label>
          <p className="text-xs text-muted">Pick an account only if this purchase isn&apos;t in your books yet. Depreciation starts in the month of purchase{minDate ? ` and is posted from ${minDate} onwards` : ""}.</p>
          {error && <p role="alert" className="text-sm text-error">{error}</p>}
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button type="button" disabled={pending} onClick={() => start(async () => {
            const r = await saveAssetAction({ name: f.name, category: f.category, cost: num(f.cost), salvage: num(f.salvage), purchaseDate: f.date, lifeMonths: Math.round(num(f.years) * 12), paidFromAccountId: f.paidFrom || undefined });
            if (r.error) { setError(r.error); return; }
            setOpen(false); setError(null); setF((c) => ({ ...c, name: "", cost: "" }));
          })}>{pending ? "Saving…" : "Add"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AssetRowActions({ id, name, moneyAccounts }: { id: string; name: string; moneyAccounts: Opt[] }) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(today());
  const [amount, setAmount] = useState("");
  const [acct, setAcct] = useState(moneyAccounts[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex justify-end gap-1.5">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild><Button type="button" size="sm" variant="ghost">Sold / scrapped</Button></DialogTrigger>
        <DialogContent title={`Sold or scrapped: ${name}`} description="Takes it off the books with its depreciation and shows any gain or loss. Enter 0 if it was scrapped.">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm font-medium text-primary">Date<div className="mt-1"><DatePicker value={date} onChange={setDate} ariaLabel="Date" /></div></label>
              <label className="text-sm font-medium text-primary">Sale amount (AED)<Input className="mt-1 text-right" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" /></label>
            </div>
            <label className="block text-sm font-medium text-primary">Paid in to<div className="mt-1"><Select value={acct} onChange={setAcct} options={moneyAccounts.map((a) => ({ value: a.id, label: a.label }))} placeholder="Choose account" /></div></label>
            {error && <p role="alert" className="text-sm text-error">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="button" disabled={pending} onClick={() => start(async () => {
              const r = await disposeAssetAction({ id, date, amount: num(amount), accountId: acct || undefined });
              if (r.error) { setError(r.error); return; }
              setOpen(false);
            })}>{pending ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => { if (window.confirm(`Remove ${name} from the register? Its depreciation entries go with it.`)) start(async () => { const r = await deleteAssetAction(id); if (r.error) window.alert(r.error); }); }}>Remove</Button>
    </div>
  );
}
