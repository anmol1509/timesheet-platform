"use client";

import { useActionState, useState, useTransition } from "react";
import { Pencil, Plus, Wand2 } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { Badge } from "@/components/Badge";
import { saveLeaveTypeAction, seedLeaveTypesAction } from "../actions";

type State = { error: string | null; ok?: boolean };
export type LeaveTypeRow = { id: string; name: string; code: string; paid: boolean; daysPerYear: number; isActive: boolean };

function TypeForm({ type, onDone }: { type?: LeaveTypeRow; onDone: () => void }) {
  const [state, action, pending] = useActionState(
    async (prev: State, fd: FormData) => {
      const res = await saveLeaveTypeAction(prev, fd);
      if (res.ok) onDone();
      return res;
    },
    { error: null } as State
  );
  return (
    <form action={action} className="mt-4 space-y-3">
      {type && <input type="hidden" name="id" value={type.id} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">Name</span>
          <input name="name" defaultValue={type?.name} required className="input w-full" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">Code</span>
          <input name="code" defaultValue={type?.code} required disabled={!!type} className="input w-full" placeholder="e.g. ANNUAL" />
          {type && <input type="hidden" name="code" value={type.code} />}
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">Days per year (0 = uncapped)</span>
          <input name="daysPerYear" type="number" min={0} max={366} defaultValue={type?.daysPerYear ?? 0} className="input w-full" />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm text-secondary">
        <input type="checkbox" name="paid" defaultChecked={type?.paid ?? true} /> Paid leave
      </label>
      {type && (
        <label className="flex items-center gap-2 text-sm text-secondary">
          <input type="checkbox" name="isActive" defaultChecked={type.isActive} /> Active (available for new requests)
        </label>
      )}
      <div className="flex items-center gap-3">
        <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "Saving…" : "Save"}</button>
        {state.error && <p role="alert" className="text-sm text-[var(--danger-text,#b42318)]">{state.error}</p>}
      </div>
    </form>
  );
}

export function TypesManager({ types, canEdit }: { types: LeaveTypeRow[]; canEdit: boolean }) {
  const [dialog, setDialog] = useState<"new" | LeaveTypeRow | null>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      {canEdit && (
        <div className="flex flex-wrap justify-end gap-2">
          {types.length === 0 && (
            <button type="button" className="btn btn-secondary" disabled={pending} onClick={() => start(async () => { const r = await seedLeaveTypesAction(); setError(r.error); })}>
              <Wand2 className="h-4 w-4" aria-hidden /> Add UAE standard types
            </button>
          )}
          <button type="button" className="btn btn-primary" onClick={() => setDialog("new")}>
            <Plus className="h-4 w-4" aria-hidden /> New type
          </button>
        </div>
      )}
      {error && <p role="alert" className="text-sm text-[var(--danger-text,#b42318)]">{error}</p>}

      {types.length === 0 ? (
        <div className="card p-10 text-center text-sm text-muted">No leave types yet. Add the UAE standard set, or create your own.</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-default bg-surface-subtle text-left text-xs font-medium uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3 text-right">Days / year</th>
                <th className="px-4 py-3">Pay</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {types.map((t) => (
                <tr key={t.id} className={t.isActive ? "" : "opacity-60"}>
                  <td className="px-4 py-3 font-medium text-primary">{t.name}</td>
                  <td className="px-4 py-3 text-secondary">{t.code}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-secondary">{t.daysPerYear > 0 ? t.daysPerYear : "uncapped"}</td>
                  <td className="px-4 py-3"><Badge color={t.paid ? "green" : "slate"}>{t.paid ? "Paid" : "Unpaid"}</Badge></td>
                  <td className="px-4 py-3 text-secondary">{t.isActive ? "Active" : "Inactive"}</td>
                  <td className="px-4 py-3 text-right">
                    {canEdit && (
                      <button type="button" className="rounded-md p-1.5 text-subtle hover:bg-surface-hover hover:text-secondary" aria-label={`Edit ${t.name}`} onClick={() => setDialog(t)}>
                        <Pencil className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={dialog !== null} onOpenChange={(o) => !o && setDialog(null)}>
        {dialog !== null && (
          <DialogContent title={dialog === "new" ? "New leave type" : `Edit ${dialog.name}`}>
            <TypeForm key={dialog === "new" ? "new" : dialog.id} type={dialog === "new" ? undefined : dialog} onDone={() => setDialog(null)} />
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
