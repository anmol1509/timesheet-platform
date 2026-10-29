"use client";

import { useActionState, useState } from "react";
import { Check } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { cn } from "@/lib/cn";
import { topUpPriceLabel } from "@/lib/aiCredits";
import { requestCreditsAction } from "@/app/(platform)/(app)/settings/ai/actions";

import { Button } from "@/components/ui/Button";
const PACKS = [
  { credits: 1000, note: "A small top-up" },
  { credits: 2500, note: "Month-end push" },
  { credits: 5000, note: "Bulk import" },
  { credits: 10000, note: "Heavy use" },
];
const initial = { error: null as string | null, ok: false };

/** Ask for extra credits for this month. Nothing is added until it is approved; no prices are shown. */
export function TopUpDialog({ open, onOpenChange, total }: { open: boolean; onOpenChange: (open: boolean) => void; total: number }) {
  const [state, run, pending] = useActionState(async (_p: typeof initial, fd: FormData) => {
    const r = await requestCreditsAction({ error: null }, fd);
    return { error: r.error, ok: !!r.ok };
  }, initial);
  const [pack, setPack] = useState<number | null>(2500);
  const [custom, setCustom] = useState("");
  const typed = Number(custom.replace(/,/g, ""));
  const credits = custom.trim() ? (Number.isInteger(typed) && typed > 0 ? typed : 0) : pack ?? 0;
  const n = (v: number) => Math.round(v).toLocaleString("en-US");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Top up AI credits" description="Extra credits are added for this month only." className="max-w-md">
        {state.ok ? (
          <div className="space-y-4 py-6 text-center">
            <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-[var(--success-soft)] text-[var(--success)]"><Check className="h-5 w-5" aria-hidden /></span>
            <p className="text-sm font-medium text-primary">Request sent to ManpowerSync</p>
            <p className="text-xs text-muted">The credits are added once it is approved, and you will get a message here and by email.</p>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => onOpenChange(false)}>Done</button>
          </div>
        ) : (
          <form action={run} className="mt-4 space-y-4">
            <input type="hidden" name="credits" value={credits || ""} />
            <fieldset>
              <legend className="mb-2 text-xs font-semibold text-primary">How many credits?</legend>
              <div className="grid grid-cols-2 gap-2">
                {PACKS.map((p) => {
                  const on = !custom.trim() && pack === p.credits;
                  return (
                    <button key={p.credits} type="button" aria-pressed={on} onClick={() => { setPack(p.credits); setCustom(""); }} className={cn("rounded-xl border px-3 py-2.5 text-left transition", on ? "border-[var(--brand-primary)] bg-[var(--brand-primary-soft)] text-[var(--brand-primary)]" : "border-default hover:bg-surface-hover")}>
                      <span className="tabular block text-base font-semibold">{n(p.credits)}</span>
                      <span className="block text-xs text-muted">{p.note}</span>
                      <span className="mt-1 block text-xs font-semibold text-secondary">{topUpPriceLabel(p.credits)}</span>
                    </button>
                  );
                })}
              </div>
            </fieldset>
            <label className="block text-xs font-semibold text-primary">Or a number of your own
              <input inputMode="numeric" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="e.g. 3,500" className="input mt-1 h-9 w-full text-sm font-normal" />
              {custom.trim() && credits > 0 && <span className="mt-1 block text-xs font-normal text-secondary">{n(credits)} credits = <span className="font-semibold text-primary">{topUpPriceLabel(credits)}</span></span>}
            </label>
            <label className="block text-xs font-semibold text-primary">What is it for? (optional)
              <input name="reason" maxLength={300} placeholder="e.g. Payroll month-end, importing 400 workers" className="input mt-1 h-9 w-full text-sm font-normal" />
            </label>
            <p className="rounded-lg bg-surface-sunken px-3 py-2 text-xs text-secondary">
              {credits > 0 ? <>You will have <span className="tabular font-semibold text-primary">{n(total + credits)}</span> credits this month once it is approved. This top-up is <span className="font-semibold text-primary">{topUpPriceLabel(credits)}</span>.</> : "Choose or type a number of credits."}
            </p>
            {state.error && <p role="alert" className="text-xs text-[var(--error)]">{state.error}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => onOpenChange(false)}>Cancel</button>
              <Button size="btn-sm" type="submit" disabled={pending || credits <= 0} loading={pending}>Send request</Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
