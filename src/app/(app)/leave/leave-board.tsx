"use client";

import { useActionState, useState, useTransition } from "react";
import { Check, Plus, X } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { Select } from "@/components/ui/Select";
import { Badge, type BadgeColor } from "@/components/Badge";
import { LEAVE_STATUS_LABELS } from "@/lib/leave";
import { cancelLeaveAction, createLeaveRequestAction, decideLeaveAction } from "./actions";

type State = { error: string | null; ok?: boolean };
export type LeaveRow = {
  id: string;
  employeeName: string;
  employeeIdNo: string;
  typeName: string;
  paid: boolean;
  start: string;
  end: string;
  days: number;
  reason: string | null;
  status: string;
  decisionNote: string | null;
  decidedBy: string | null;
};

const STATUS_COLOR: Record<string, BadgeColor> = { PENDING: "amber", APPROVED: "green", REJECTED: "red", CANCELLED: "slate" };

function NewRequestForm({
  employees,
  types,
  onDone,
}: {
  employees: { id: string; name: string; employeeIdNo: string }[];
  types: { id: string; name: string }[];
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState(
    async (prev: State, fd: FormData) => {
      const res = await createLeaveRequestAction(prev, fd);
      if (res.ok) onDone();
      return res;
    },
    { error: null } as State
  );
  return (
    <form action={action} className="mt-4 space-y-3">
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted">Employee</span>
        <Select
          name="employeeId"
          placeholder="Choose an employee…"
          searchPlaceholder="Search name or ID…"
          options={employees.map((e) => ({ value: e.id, label: `${e.name} · ${e.employeeIdNo}` }))}
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted">Leave type</span>
        <Select name="leaveTypeId" searchable={false} placeholder="Choose a type…" options={types.map((t) => ({ value: t.id, label: t.name }))} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">From</span>
          <input type="date" name="startDate" required className="input w-full" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">To (inclusive)</span>
          <input type="date" name="endDate" required className="input w-full" />
        </label>
      </div>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted">Reason (optional)</span>
        <input name="reason" className="input w-full" />
      </label>
      <div className="flex items-center gap-3">
        <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "Saving…" : "Submit request"}</button>
        {state.error && <p role="alert" className="text-sm text-[var(--danger-text,#b42318)]">{state.error}</p>}
      </div>
    </form>
  );
}

export function LeaveBoard({
  rows,
  employees,
  types,
  canApprove,
  canCreate,
}: {
  rows: LeaveRow[];
  employees: { id: string; name: string; employeeIdNo: string }[];
  types: { id: string; name: string }[];
  canApprove: boolean;
  canCreate: boolean;
}) {
  const [newOpen, setNewOpen] = useState(false);
  const [rejecting, setRejecting] = useState<LeaveRow | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function run(fn: (fd: FormData) => Promise<State>, fields: Record<string, string>, after?: () => void) {
    setError(null);
    start(async () => {
      const fd = new FormData();
      for (const [k, v] of Object.entries(fields)) fd.set(k, v);
      const res = await fn(fd);
      if (res.error) setError(res.error);
      else after?.();
    });
  }

  return (
    <div className="space-y-3">
      {canCreate && (
        <div className="flex justify-end">
          <button type="button" className="btn btn-primary" onClick={() => setNewOpen(true)} disabled={types.length === 0}>
            <Plus className="h-4 w-4" aria-hidden /> New request
          </button>
        </div>
      )}
      {types.length === 0 && canCreate && (
        <p className="text-sm text-muted">Set up leave types first (Leave → Leave Types) before raising a request.</p>
      )}
      {error && <p role="alert" className="text-sm text-[var(--danger-text,#b42318)]">{error}</p>}

      {rows.length === 0 ? (
        <div className="card p-10 text-center text-sm text-muted">No leave requests here yet.</div>
      ) : (
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-default bg-surface-subtle text-left text-xs font-medium uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Employee</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Dates</th>
              <th className="px-4 py-3 text-right">Days</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-3">
                  <p className="font-medium text-primary">{r.employeeName}</p>
                  <p className="text-xs text-muted">{r.employeeIdNo}</p>
                </td>
                <td className="px-4 py-3 text-secondary">
                  {r.typeName}
                  {!r.paid && <span className="ml-1 text-xs text-muted">(unpaid)</span>}
                  {r.reason && <p className="max-w-56 truncate text-xs text-muted" title={r.reason}>{r.reason}</p>}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-secondary">{r.start} → {r.end}</td>
                <td className="px-4 py-3 text-right tabular-nums text-primary">{r.days}</td>
                <td className="px-4 py-3">
                  <Badge color={STATUS_COLOR[r.status] ?? "slate"} dot>{LEAVE_STATUS_LABELS[r.status] ?? r.status}</Badge>
                  {r.decidedBy && r.status !== "PENDING" && <p className="mt-0.5 text-xs text-muted">by {r.decidedBy}</p>}
                  {r.decisionNote && <p className="max-w-48 truncate text-xs text-muted" title={r.decisionNote}>{r.decisionNote}</p>}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1.5">
                    {r.status === "PENDING" && canApprove && (
                      <>
                        <button type="button" className="btn btn-secondary" disabled={pending} onClick={() => run(decideLeaveAction, { id: r.id, decision: "APPROVED" })}>
                          <Check className="h-4 w-4" aria-hidden /> Approve
                        </button>
                        <button type="button" className="btn btn-secondary" disabled={pending} onClick={() => { setNote(""); setRejecting(r); }}>
                          <X className="h-4 w-4" aria-hidden /> Reject
                        </button>
                      </>
                    )}
                    {(r.status === "PENDING" || r.status === "APPROVED") && canCreate && (
                      <button type="button" className="btn btn-secondary" disabled={pending} onClick={() => run(cancelLeaveAction, { id: r.id })}>
                        Cancel
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent title="New leave request" description="Overlapping leave for the same person is refused.">
          <NewRequestForm employees={employees} types={types} onDone={() => setNewOpen(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={rejecting !== null} onOpenChange={(o) => !o && setRejecting(null)}>
        {rejecting && (
          <DialogContent title={`Reject ${rejecting.employeeName}'s leave?`} description={`${rejecting.typeName}, ${rejecting.start} → ${rejecting.end}`}>
            <label className="mt-4 block">
              <span className="mb-1 block text-xs font-medium text-muted">Reason (shown on the request)</span>
              <input value={note} onChange={(e) => setNote(e.target.value)} className="input w-full" />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="btn btn-secondary" onClick={() => setRejecting(null)}>Back</button>
              <button type="button" className="btn btn-primary" disabled={pending} onClick={() => run(decideLeaveAction, { id: rejecting.id, decision: "REJECTED", note }, () => setRejecting(null))}>
                Reject
              </button>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
