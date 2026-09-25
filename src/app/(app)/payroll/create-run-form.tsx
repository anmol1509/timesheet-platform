"use client";

import { useActionState } from "react";
import { createRunAction } from "./actions";
import { MonthInput } from "@/components/ui/MonthInput";
import { Select } from "@/components/ui/Select";

type Company = { id: string; name: string; payType: string | null };
type State = { error: string | null };

export function CreateRunForm({ defaultMonth, companies }: { defaultMonth: string; companies: Company[] }) {
  const [state, action, pending] = useActionState(async (prev: State, fd: FormData) => createRunAction(prev, fd), { error: null } as State);
  if (companies.length === 0) {
    return <p className="card p-4 text-sm text-muted">Payroll is for your own companies only. Mark a company as &ldquo;Own company&rdquo; on its Suppliers page, and set whether it pays Basic or Hourly, to create a run.</p>;
  }
  return (
    <form action={action} className="card flex flex-wrap items-end gap-3 p-4">
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted">Company *</span>
<Select name="companyId" required defaultValue={companies.length === 1 ? companies[0].id : ""} placeholder="Choose a company…" options={companies.map((c) => ({ value: c.id, label: `${c.name}${c.payType ? ` — ${c.payType === "HOURLY" ? "Hourly" : "Basic"}` : " — set pay type first"}` }))} />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted">Payroll month *</span>
        <MonthInput name="month" defaultValue={defaultMonth} required />
      </label>
      <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "Calculating…" : "Create payroll run"}</button>
      {state.error && <p role="alert" className="text-sm text-[var(--error)]">{state.error}</p>}
      <p className="w-full text-xs text-muted">Basic companies are paid from attendance; hourly companies from the timesheet hours. Only that company&apos;s own employees are included.</p>
    </form>
  );
}
