"use client";

import { Plus, Settings2, X } from "lucide-react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogFooter, DialogTrigger } from "@/components/ui/Dialog";
import { NumberInput } from "@/components/ui/NumberInput";
import type { QuoteSettings } from "@/lib/quotationMath";
import { saveQuoteSettingsAction } from "./settings-actions";

import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/Alert";
/** Quotation defaults, edited by an admin. Everything here is optional and only feeds suggestions and conversions. */
export function QuoteSettingsDialog({ settings }: { settings: QuoteSettings }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [s, setS] = useState(settings);
  const [error, setError] = useState<string | null>(null);
  const cost = (k: keyof QuoteSettings["costDefaults"], label: string, hint?: string) => (
    <label className="block">
      <span className="mb-1 block text-xs text-muted">{label}</span>
      <NumberInput value={String(s.costDefaults[k] || "")} onChange={(v) => setS({ ...s, costDefaults: { ...s.costDefaults, [k]: Number(v) || 0 } })} min={0} placeholder="0" />
      {hint && <span className="mt-0.5 block text-[11px] text-subtle">{hint}</span>}
    </label>
  );

  function save() {
    setError(null);
    start(async () => {
      const res = await saveQuoteSettingsAction(s);
      if (res.error) return setError(res.error);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) setS(settings); }}>
      <DialogTrigger asChild>
        <button type="button" className="btn btn-secondary btn-sm gap-1.5"><Settings2 className="h-3.5 w-3.5" aria-hidden />Quotation settings</button>
      </DialogTrigger>
      {open && (
        <DialogContent title="Quotation settings" description="Used to turn day and hour prices into a month, and to suggest costs. All optional." className="max-w-xl">
          <div className="mt-4 space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <label className="block"><span className="mb-1 block text-xs text-muted">Working days a month</span><NumberInput value={String(s.daysPerMonth)} onChange={(v) => setS({ ...s, daysPerMonth: Number(v) || 0 })} min={1} max={31} /></label>
              <label className="block"><span className="mb-1 block text-xs text-muted">Normal hours a day</span><NumberInput value={String(s.hoursPerDay)} onChange={(v) => setS({ ...s, hoursPerDay: Number(v) || 0 })} min={1} max={24} step={0.5} /></label>
            </div>

            <div>
              <p className="mb-1 text-sm font-medium text-primary">Your own price units</p>
              <p className="mb-2 text-xs text-muted">For example “shift” = 30 a month. They appear next to month, day and hour on each line.</p>
              <div className="space-y-2">
                {s.units.map((u, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input value={u.label} onChange={(e) => setS({ ...s, units: s.units.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} placeholder="Unit name" className="input min-w-0 flex-1" />
                    <span className="text-xs text-muted">= </span>
                    <div className="w-24"><NumberInput value={String(u.perMonth)} onChange={(v) => setS({ ...s, units: s.units.map((x, j) => (j === i ? { ...x, perMonth: Number(v) || 0 } : x)) })} min={0} step={0.5} /></div>
                    <span className="text-xs text-muted">a month</span>
                    <button type="button" aria-label="Remove unit" onClick={() => setS({ ...s, units: s.units.filter((_, j) => j !== i) })} className="text-subtle hover:text-[var(--error)]"><X className="h-4 w-4" aria-hidden /></button>
                  </div>
                ))}
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setS({ ...s, units: [...s.units, { key: "", label: "", perMonth: 30 }] })}><Plus className="h-3.5 w-3.5" aria-hidden />Add a unit</button>
              </div>
            </div>

            <div>
              <p className="mb-1 text-sm font-medium text-primary">Usual cost per worker per month</p>
              <p className="mb-2 text-xs text-muted">Used by “Suggest from pay and terms”. Accommodation, transport and PPE are added only when a quotation says <b>By us</b>.</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {cost("permits", "Visa, labour card, medical", "spread over the contract")}
                {cost("accommodation", "Accommodation")}
                {cost("transport", "Transport")}
                {cost("ppe", "PPE")}
                {cost("food", "Food")}
              </div>
            </div>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-primary">Profit target <span className="font-normal text-muted">(optional)</span></span>
              <div className="flex items-center gap-2"><div className="w-28"><NumberInput value={s.targetProfit ? String(s.targetProfit) : ""} onChange={(v) => setS({ ...s, targetProfit: Number(v) > 0 ? Number(v) : null })} min={0} placeholder="none" /></div><span className="text-xs text-muted">per worker per month</span></div>
            </label>
            {error && <Alert>{error}</Alert>}
          </div>
          <DialogFooter>
            <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
            <Button size="btn" type="button" disabled={pending} onClick={save} loading={pending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  );
}
