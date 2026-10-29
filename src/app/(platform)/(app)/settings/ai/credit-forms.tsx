"use client";

import { useActionState, useState } from "react";
import { topUpPriceLabel } from "@/lib/aiCredits";
import { grantAiCreditsAction, requestCreditsAction, setAiAllowanceAction } from "./actions";

import { Button } from "@/components/ui/Button";
type State = { error: string | null; ok?: boolean };
const initial: State = { error: null };

/** For a super admin: the branch's monthly allowance, and extra credits for this month. */
export function CreditForms({ branchId, allowance }: { branchId: string; allowance: number }) {
  const [setState, setAction, settingPending] = useActionState(setAiAllowanceAction, initial);
  const [grantState, grantAction, grantPending] = useActionState(grantAiCreditsAction, initial);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <form action={setAction} className="card space-y-3 p-4">
        <h3 className="text-sm font-semibold text-primary">Monthly allowance</h3>
        <p className="text-xs text-muted">What this company gets each month. It starts again on the 1st (UAE time).</p>
        <input type="hidden" name="branchId" value={branchId} />
        <label className="block text-xs text-muted">Credits per month
          <input name="credits" inputMode="numeric" defaultValue={allowance} className="input mt-1 h-9 w-full text-sm" />
        </label>
        <div className="flex items-center gap-3">
          <Button size="btn-sm" type="submit" disabled={settingPending} loading={settingPending}>Save allowance</Button>
          {setState.error && <p role="alert" className="text-xs text-[var(--error)]">{setState.error}</p>}
          {setState.ok && !setState.error && <p className="text-xs text-[var(--success)]">Saved.</p>}
        </div>
      </form>
      <form action={grantAction} className="card space-y-3 p-4">
        <h3 className="text-sm font-semibold text-primary">Add credits for this month</h3>
        <p className="text-xs text-muted">Extra credits on top of the allowance. They count for this month only.</p>
        <input type="hidden" name="branchId" value={branchId} />
        <div className="grid gap-3 sm:grid-cols-[8rem_1fr]">
          <label className="block text-xs text-muted">Credits
            <input name="credits" inputMode="numeric" placeholder="1000" className="input mt-1 h-9 w-full text-sm" />
          </label>
          <label className="block text-xs text-muted">Note (optional)
            <input name="note" placeholder="e.g. Month-end payroll push" className="input mt-1 h-9 w-full text-sm" />
          </label>
        </div>
        <div className="flex items-center gap-3">
          <Button size="btn-sm" type="submit" disabled={grantPending} loading={grantPending}>Add credits</Button>
          {grantState.error && <p role="alert" className="text-xs text-[var(--error)]">{grantState.error}</p>}
          {grantState.ok && !grantState.error && <p className="text-xs text-[var(--success)]">Added.</p>}
        </div>
      </form>
    </div>
  );
}

/** The strip on the page for asking for extra credits this month. */
export function RequestStrip() {
  const [state, run, pending] = useActionState(requestCreditsAction, initial);
  const [typed, setTyped] = useState("");
  const credits = Number(typed.replace(/,/g, "").trim());
  const valid = Number.isInteger(credits) && credits > 0;
  return (
    <form action={run} className="flex flex-wrap items-end gap-3 rounded-2xl border border-[var(--warning-border)] bg-[var(--warning-soft)] p-4">
      <div className="min-w-[14rem] flex-1">
        <p className="text-sm font-semibold text-primary">Request more credits <span className="font-normal text-secondary">(approval required)</span></p>
        <p className="text-xs text-secondary">Need more this month? Send a request to ManpowerSync. The credits are added once it is approved. 1,000 credits = AED 10.</p>
      </div>
      <label className="block text-xs text-muted">Credits
        <input name="credits" inputMode="numeric" placeholder="e.g. 1,000" value={typed} onChange={(e) => setTyped(e.target.value)} className="input mt-1 h-9 w-32 text-sm" />
        <span className="mt-1 block h-4 text-xs font-semibold text-primary">{valid ? topUpPriceLabel(credits) : "\u00a0"}</span>
      </label>
      <label className="block min-w-[12rem] flex-1 text-xs text-muted">Reason (optional)
        <input name="reason" maxLength={300} placeholder="e.g. Month-end payroll push, bulk document import" className="input mt-1 h-9 w-full text-sm" />
      </label>
      <Button size="btn-sm" type="submit" disabled={pending} loading={pending}>Send request</Button>
      {state.error && <p role="alert" className="w-full text-xs text-[var(--error)]">{state.error}</p>}
      {state.ok && !state.error && <p className="w-full text-xs text-[var(--success)]">Request sent. You will get a message when it is answered.</p>}
    </form>
  );
}
