"use client";

import { useActionState } from "react";
import { createRunAction } from "./actions";
import { MonthInput } from "@/components/ui/MonthInput";
import { Select } from "@/components/ui/Select";

import { Button } from "@/components/ui/Button";
type Company = { id: string; name: string };
type State = { error: string | null };

export function CreateRunForm({ defaultMonth, companies, bare, defaultCompanyId }: { defaultMonth: string; companies: Company[]; bare?: boolean; defaultCompanyId?: string }) {
  const [state, action, pending] = useActionState(async (prev: State, fd: FormData) => createRunAction(prev, fd), { error: null } as State);
  if (companies.length === 0) {
    return <p className="card p-4 text-sm text-muted">Payroll is for your own companies only. Mark a company as &ldquo;Own company&rdquo; on its Suppliers page to create a run.</p>;
  }
  return (
    <form action={action} className={bare ? "flex flex-wrap items-end gap-3" : "card flex flex-wrap items-end gap-3 p-4"} aria-label="Start a payroll run">
      {!bare && <h2 className="w-full text-sm font-semibold text-primary">Start a payroll run</h2>}
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted">Company *</span>
<Select name="companyId" required defaultValue={defaultCompanyId ?? (companies.length === 1 ? companies[0].id : "")} placeholder="Choose a company…" options={companies.map((c) => ({ value: c.id, label: c.name }))} />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted">Month to pay *</span>
        <MonthInput name="month" defaultValue={defaultMonth} required />
      </label>
      <Button size="btn" type="submit" disabled={pending} loading={pending}>Start payroll run</Button>
      {state.error && <p role="alert" className="text-sm text-[var(--error)]">{state.error}</p>}
      <p className="w-full text-xs text-muted">We work out everyone&apos;s pay from attendance or timesheets. You can check and change it before anything is final.</p>
    </form>
  );
}
