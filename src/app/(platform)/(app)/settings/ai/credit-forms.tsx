"use client";

import { useActionState } from "react";
import { grantAiCreditsAction, setAiAllowanceAction } from "./actions";

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
          <button type="submit" className="btn btn-primary btn-sm" disabled={settingPending}>{settingPending ? "Saving…" : "Save allowance"}</button>
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
          <button type="submit" className="btn btn-primary btn-sm" disabled={grantPending}>{grantPending ? "Adding…" : "Add credits"}</button>
          {grantState.error && <p role="alert" className="text-xs text-[var(--error)]">{grantState.error}</p>}
          {grantState.ok && !grantState.error && <p className="text-xs text-[var(--success)]">Added.</p>}
        </div>
      </form>
    </div>
  );
}
