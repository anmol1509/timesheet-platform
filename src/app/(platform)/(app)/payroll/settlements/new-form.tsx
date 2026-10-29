"use client";

import { useActionState, useState } from "react";
import { Select } from "@/components/ui/Select";
import { DatePicker } from "@/components/ui/DatePicker";
import { EXIT_REASONS } from "@/lib/exitReasons";
import { createSettlementAction } from "./actions";

import { Button } from "@/components/ui/Button";
type State = { error: string | null; ok?: boolean };

export function NewSettlementForm({ employees }: { employees: { id: string; label: string; exitDate: string }[] }) {
  const [employeeId, setEmployeeId] = useState("");
  const [exitDate, setExitDate] = useState("");
  const [state, action, pending] = useActionState(createSettlementAction as (p: State, fd: FormData) => Promise<State>, { error: null } as State);
  return (
    <form action={action} className="card space-y-3 p-4">
      <h2 className="text-sm font-semibold text-primary">Start a settlement</h2>
      <div className="grid gap-3 sm:grid-cols-4">
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-xs font-medium text-muted">Employee *</span>
          <Select name="employeeId" value={employeeId} onChange={(v) => { setEmployeeId(v); const e = employees.find((x) => x.id === v); if (e?.exitDate) setExitDate(e.exitDate); }} placeholder="Choose who is leaving…" searchPlaceholder="Search name or ID…" options={employees.map((e) => ({ value: e.id, label: e.label }))} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">Last working day *</span>
          <DatePicker name="exitDate" value={exitDate} onChange={setExitDate} className="w-full" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">Reason</span>
          <Select name="reason" defaultValue="Resigned" searchable={false} options={EXIT_REASONS.map((r) => ({ value: r, label: r }))} />
        </label>
      </div>
      <div className="flex items-center gap-3">
        <Button size="btn" type="submit" disabled={pending || !employeeId} loading={pending}>Work out the settlement</Button>
        {state.error && <p role="alert" className="text-sm text-[var(--error)]">{state.error}</p>}
      </div>
    </form>
  );
}
