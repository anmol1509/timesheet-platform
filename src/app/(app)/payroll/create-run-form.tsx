"use client";

import { useActionState } from "react";
import { createRunAction } from "./actions";

export function CreateRunForm({ defaultMonth }: { defaultMonth: string }) {
  const [state, action, pending] = useActionState(
    async (prev: { error: string | null }, fd: FormData) => createRunAction(prev, fd),
    { error: null } as { error: string | null }
  );
  return (
    <form action={action} className="card flex flex-wrap items-end gap-3 p-4">
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted">Payroll month</span>
        <input type="month" name="month" defaultValue={defaultMonth} required className="input" />
      </label>
      <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "Calculating…" : "Create payroll run"}</button>
      {state.error && <p role="alert" className="text-sm text-[var(--danger-text,#b42318)]">{state.error}</p>}
      <p className="w-full text-xs text-muted">Pulls each paid employee&apos;s pay structure, that month&apos;s attendance (absences and overtime) and approved unpaid leave.</p>
    </form>
  );
}
