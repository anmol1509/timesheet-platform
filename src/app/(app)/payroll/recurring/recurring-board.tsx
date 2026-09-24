"use client";

import { useActionState, useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/Badge";
import { createAdjustmentAction, toggleAdjustmentAction } from "../pay-items-actions";

type State = { error: string | null; ok?: boolean };
export type RecurringRow = { id: string; employee: string; employeeIdNo: string; kind: string; label: string; amount: number; startMonth: string; endMonth: string | null; active: boolean };
const aed = (n: number) => n.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const thisMonth = () => new Date().toISOString().slice(0, 7);

function NewItemForm({ employees, onDone }: { employees: { id: string; label: string }[]; onDone: () => void }) {
  const [state, action, pending] = useActionState(
    async (prev: State, fd: FormData) => {
      const res = await createAdjustmentAction(prev, fd);
      if (res.ok) onDone();
      return res;
    },
    { error: null } as State
  );
  return (
    <form action={action} className="mt-4 space-y-3">
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted">Employee</span>
        <Select name="employeeId" defaultValue="" placeholder="Choose an employee…" options={employees.map((e) => ({ value: e.id, label: e.label }))} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">Kind</span>
          <Select name="kind" defaultValue="EARNING" searchable={false} options={[{ value: "EARNING", label: "Earning (added to pay)" }, { value: "DEDUCTION", label: "Deduction (taken from pay)" }]} />
        </label>
        <label className="block"><span className="mb-1 block text-xs font-medium text-muted">Monthly amount (AED)</span><input type="number" step="0.01" min="0" name="amount" required className="input w-full" /></label>
      </div>
      <label className="block"><span className="mb-1 block text-xs font-medium text-muted">Name on the payslip</span><input name="label" required placeholder="e.g. Phone allowance" className="input w-full" /></label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block"><span className="mb-1 block text-xs font-medium text-muted">First month</span><input type="month" name="startMonth" defaultValue={thisMonth()} required className="input w-full" /></label>
        <label className="block"><span className="mb-1 block text-xs font-medium text-muted">Last month (blank = ongoing)</span><input type="month" name="endMonth" className="input w-full" /></label>
      </div>
      <div className="flex items-center gap-3">
        <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "Saving…" : "Add item"}</button>
        {state.error && <p role="alert" className="text-sm text-[var(--error)]">{state.error}</p>}
      </div>
    </form>
  );
}

export function RecurringBoard({ rows, employees, canCreate, canEdit }: { rows: RecurringRow[]; employees: { id: string; label: string }[]; canCreate: boolean; canEdit: boolean }) {
  const [open, setOpen] = useState(false);
  const [, start] = useTransition();
  const monthlyIn = rows.filter((r) => r.active && r.kind === "EARNING").reduce((s, r) => s + r.amount, 0);
  const monthlyOut = rows.filter((r) => r.active && r.kind === "DEDUCTION").reduce((s, r) => s + r.amount, 0);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          Active items add <span className="tabular font-semibold text-primary">AED {aed(monthlyIn)}</span> and deduct{" "}
          <span className="tabular font-semibold text-primary">AED {aed(monthlyOut)}</span> each month.
        </p>
        {canCreate && (
          <button type="button" className="btn btn-primary gap-1.5" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden /> New item
          </button>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="empty-state"><p className="text-sm text-muted">No recurring items yet. Add a standing allowance or deduction and it applies to every run automatically.</p></div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-default bg-surface-subtle text-left text-xs font-medium uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Item</th>
                <th className="px-4 py-3 text-right">Monthly (AED)</th>
                <th className="px-4 py-3">Applies</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {rows.map((r) => (
                <tr key={r.id} className={r.active ? "" : "opacity-60"}>
                  <td className="px-4 py-3"><p className="font-medium text-primary">{r.employee}</p><p className="text-xs text-muted">{r.employeeIdNo}</p></td>
                  <td className="px-4 py-3 text-secondary">{r.label}</td>
                  <td className={`px-4 py-3 text-right tabular-nums ${r.kind === "EARNING" ? "text-[var(--success)]" : "text-[var(--error)]"}`}>{r.kind === "EARNING" ? "+" : "−"}{aed(r.amount)}</td>
                  <td className="px-4 py-3 text-secondary">{r.startMonth} → {r.endMonth ?? "ongoing"}</td>
                  <td className="px-4 py-3"><Badge color={r.active ? "green" : "slate"} dot>{r.active ? "Active" : "Paused"}</Badge></td>
                  <td className="px-4 py-3 text-right">
                    {canEdit && (
                      <button type="button" className="text-xs font-medium text-[var(--brand-primary)] hover:underline" onClick={() => { const fd = new FormData(); fd.set("id", r.id); start(async () => { await toggleAdjustmentAction(fd); }); }}>
                        {r.active ? "Pause" : "Resume"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title="New recurring item" description="Applies to every payroll run from the first month until the last (or until you pause it).">
          <NewItemForm employees={employees} onDone={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}
