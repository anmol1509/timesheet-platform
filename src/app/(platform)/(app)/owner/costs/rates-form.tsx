"use client";

import { useActionState } from "react";
import { saveRatesAction, type OwnerState } from "../actions";
import type { Rates } from "@/lib/ownerCosts";
import { computeUsdFor } from "@/lib/ownerCosts";

import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/Alert";
const initial: OwnerState = { error: null };

function Field({ name, label, value, hint }: { name: string; label: string; value: number; hint?: string }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs text-muted">{label}</span>
      <input name={name} defaultValue={value} inputMode="decimal" className="input h-9 w-full" />
      {hint && <span className="mt-0.5 block text-xs text-subtle">{hint}</span>}
    </label>
  );
}

export function RatesForm({ rates, customers }: { rates: Rates; customers: { code: string; name: string }[] }) {
  const [state, action, pending] = useActionState(saveRatesAction, initial);
  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field name="usdToAed" label="AED for 1 US dollar" value={rates.usdToAed} />
        <Field name="supabasePlanUsd" label="Supabase Pro plan, $ a month" value={rates.supabasePlanUsd} />
        <Field name="supabaseComputeCreditUsd" label="Compute credit Pro includes, $" value={rates.supabaseComputeCreditUsd} />
        <Field name="mainComputeUsd" label="Compute: main website database, $ a month" value={rates.mainComputeUsd} hint="Nano is usually $0" />
        {customers.map((c) => <Field key={c.code} name={`compute_${c.code}`} label={`Compute: ${c.code}, $ a month`} value={computeUsdFor(rates, c.code)} hint="Micro is usually $10" />)}
        <Field name="diskGb" label="Disk per database, GB" value={rates.diskGb} hint="Pro includes 8 GB" />
        <Field name="vercelSeats" label="Vercel Pro seats" value={rates.vercelSeats} />
        <Field name="vercelSeatUsd" label="Vercel Pro, $ per seat a month" value={rates.vercelSeatUsd} />
        <Field name="emailPlanUsd" label="Email plan, $ a month" value={rates.emailPlanUsd} hint="Resend free is $0" />
        <Field name="emailMonthlyLimit" label="Emails a month the plan allows" value={rates.emailMonthlyLimit} hint="Resend free is 3,000" />
      </div>
      <div>
        <p className="mb-2 text-xs font-medium text-muted">Claude price, $ per million tokens (matched by the model's name)</p>
        <div className="grid gap-3 sm:grid-cols-4">
          {rates.models.map((m) => (
            <div key={m.family} className="space-y-1.5 rounded-lg border border-default p-2.5">
              <p className="text-sm font-medium capitalize text-primary">{m.family}</p>
              <Field name={`model_${m.family}_in`} label="Input" value={m.inputUsd} />
              <Field name={`model_${m.family}_out`} label="Output" value={m.outputUsd} />
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Button size="btn" type="submit" disabled={pending} loading={pending}>Save rates</Button>
        {state.error && <Alert>{state.error}</Alert>}
        {state.ok && <p role="status" className="text-sm text-[var(--success)]">Saved.</p>}
      </div>
    </form>
  );
}
