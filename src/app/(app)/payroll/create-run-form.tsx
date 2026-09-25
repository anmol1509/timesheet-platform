"use client";

import { useActionState } from "react";
import { createRunAction } from "./actions";

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
        <span className="mb-1 block text-xs font-medium text-muted">Company</span>
        <select name="companyId" required defaultValue={companies.length === 1 ? companies[0].id : ""} className="input min-w-56">
          {companies.length > 1 && <option value="" disabled>Choose a company…</option>}
          {companies.map((c) => <option key={c.id} value={c.id}>{c.name}{c.payType ? ` — ${c.payType === "HOURLY" ? "Hourly" : "Basic"}` : " — set pay type first"}</option>)}
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted">Payroll month</span>
        <input type="month" name="month" defaultValue={defaultMonth} required className="input" />
      </label>
      <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "Calculating…" : "Create payroll run"}</button>
      {state.error && <p role="alert" className="text-sm text-[var(--error)]">{state.error}</p>}
      <p className="w-full text-xs text-muted">Basic companies are paid from attendance; hourly companies from the timesheet hours. Only that company&apos;s own employees are included.</p>
    </form>
  );
}
