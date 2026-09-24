"use client";

import { useActionState, useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { Select } from "@/components/ui/Select";
import { Badge, type BadgeColor } from "@/components/Badge";
import { cancelLoanAction, createLoanAction } from "../pay-items-actions";

type State = { error: string | null; ok?: boolean };
export type LoanRow = { id: string; employee: string; employeeIdNo: string; type: string; principal: number; repaid: number; instalment: number; startMonth: string; status: string; reason: string | null };

const STATUS: Record<string, { label: string; color: BadgeColor }> = {
  ACTIVE: { label: "Recovering", color: "blue" },
  CLEARED: { label: "Cleared", color: "green" },
  CANCELLED: { label: "Cancelled", color: "slate" },
};
const aed = (n: number) => n.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const thisMonth = () => new Date().toISOString().slice(0, 7);

function NewLoanForm({ employees, onDone }: { employees: { id: string; label: string }[]; onDone: () => void }) {
  const [state, action, pending] = useActionState(
    async (prev: State, fd: FormData) => {
      const res = await createLoanAction(prev, fd);
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
          <span className="mb-1 block text-xs font-medium text-muted">Type</span>
          <Select name="type" defaultValue="ADVANCE" searchable={false} options={[{ value: "ADVANCE", label: "Salary advance" }, { value: "LOAN", label: "Loan" }]} />
        </label>
        <label className="block"><span className="mb-1 block text-xs font-medium text-muted">First deduction month</span><input type="month" name="startMonth" defaultValue={thisMonth()} required className="input w-full" /></label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="block"><span className="mb-1 block text-xs font-medium text-muted">Amount advanced (AED)</span><input type="number" step="0.01" min="0" name="principal" required className="input w-full" /></label>
        <label className="block"><span className="mb-1 block text-xs font-medium text-muted">Recovered per month (AED)</span><input type="number" step="0.01" min="0" name="instalment" required className="input w-full" /></label>
      </div>
      <label className="block"><span className="mb-1 block text-xs font-medium text-muted">Reason (optional)</span><input name="reason" className="input w-full" /></label>
      <div className="flex items-center gap-3">
        <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "Saving…" : "Record loan"}</button>
        {state.error && <p role="alert" className="text-sm text-[var(--error)]">{state.error}</p>}
      </div>
    </form>
  );
}

export function LoansBoard({ rows, employees, canCreate, canEdit }: { rows: LoanRow[]; employees: { id: string; label: string }[]; canCreate: boolean; canEdit: boolean }) {
  const [open, setOpen] = useState(false);
  const [, start] = useTransition();
  const outstanding = rows.filter((r) => r.status === "ACTIVE").reduce((s, r) => s + (r.principal - r.repaid), 0);
  const activeCount = rows.filter((r) => r.status === "ACTIVE").length;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          <span className="tabular font-semibold text-primary">AED {aed(outstanding)}</span> still to recover across {activeCount} active {activeCount === 1 ? "loan" : "loans"}.
        </p>
        {canCreate && (
          <button type="button" className="btn btn-primary gap-1.5" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden /> New loan / advance
          </button>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="empty-state"><p className="text-sm text-muted">No loans or advances yet. Record one and it is deducted from the next payroll run automatically.</p></div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-default bg-surface-subtle text-left text-xs font-medium uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3 text-right">Advanced</th>
                <th className="px-4 py-3">Recovered</th>
                <th className="px-4 py-3 text-right">Per month</th>
                <th className="px-4 py-3">From</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {rows.map((r) => {
                const pct = r.principal > 0 ? Math.min(100, Math.round((r.repaid / r.principal) * 100)) : 0;
                return (
                  <tr key={r.id}>
                    <td className="px-4 py-3"><p className="font-medium text-primary">{r.employee}</p><p className="text-xs text-muted">{r.employeeIdNo}{r.reason ? ` · ${r.reason}` : ""}</p></td>
                    <td className="px-4 py-3 text-secondary">{r.type === "ADVANCE" ? "Advance" : "Loan"}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-secondary">{aed(r.principal)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="h-1.5 w-20 overflow-hidden rounded-full bg-[var(--surface-sunken)]"><span className="block h-full rounded-full bg-[var(--brand-primary)]" style={{ width: `${pct}%` }} /></span>
                        <span className="tabular text-xs text-muted">{aed(r.repaid)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-secondary">{aed(r.instalment)}</td>
                    <td className="px-4 py-3 text-secondary">{r.startMonth}</td>
                    <td className="px-4 py-3"><Badge color={STATUS[r.status]?.color ?? "slate"} dot>{STATUS[r.status]?.label ?? r.status}</Badge></td>
                    <td className="px-4 py-3 text-right">
                      {canEdit && r.status === "ACTIVE" && (
                        <button
                          type="button"
                          className="text-xs font-medium text-[var(--error)] hover:underline"
                          onClick={() => {
                            if (!confirm(`Stop recovering ${r.employee}'s ${r.type === "ADVANCE" ? "advance" : "loan"}? What was already recovered stays recorded.`)) return;
                            const fd = new FormData();
                            fd.set("id", r.id);
                            start(async () => { await cancelLoanAction(fd); });
                          }}
                        >
                          Stop recovery
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title="New loan or advance" description="Recovered from each payroll run from the first month you choose, until fully repaid.">
          <NewLoanForm employees={employees} onDone={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}
