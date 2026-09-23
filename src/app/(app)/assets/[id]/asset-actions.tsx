"use client";

import { useActionState, useState, useTransition } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { AssetForm, type AssetFormValues } from "../assets-manager";
import { addMaintenanceAction, deleteAssetAction, deleteMaintenanceAction, disposeAssetAction } from "../actions";

type State = { error: string | null; ok?: boolean };

export function AssetHeaderActions({ value, disposed, canEdit, canDelete }: { value: AssetFormValues; disposed: boolean; canEdit: boolean; canDelete: boolean }) {
  const [edit, setEdit] = useState(false);
  const [dispose, setDispose] = useState(false);
  const [pending, start] = useTransition();
  const [dState, dAction, dPending] = useActionState(
    async (prev: State, fd: FormData) => { const r = await disposeAssetAction(prev, fd); if (r.ok) setDispose(false); return r; },
    { error: null } as State
  );
  return (
    <div className="flex flex-wrap gap-2">
      {canEdit && <button type="button" className="btn btn-secondary" onClick={() => setEdit(true)}><Pencil className="h-4 w-4" aria-hidden /> Edit</button>}
      {canEdit && !disposed && <button type="button" className="btn btn-secondary" onClick={() => setDispose(true)}>Dispose</button>}
      {canDelete && <button type="button" className="btn btn-secondary" disabled={pending} onClick={() => start(async () => { const fd = new FormData(); fd.set("id", value.id!); await deleteAssetAction(fd); })}><Trash2 className="h-4 w-4" aria-hidden /> Delete</button>}
      <Dialog open={edit} onOpenChange={setEdit}><DialogContent title={`Edit ${value.code}`}><AssetForm value={value} onDone={() => setEdit(false)} /></DialogContent></Dialog>
      <Dialog open={dispose} onOpenChange={setDispose}>
        <DialogContent title="Dispose of this asset" description="Depreciation stops at the disposal date.">
          <form action={dAction} className="mt-4 space-y-3">
            <input type="hidden" name="id" value={value.id} />
            <div className="grid grid-cols-2 gap-3">
              <label className="block"><span className="mb-1 block text-xs font-medium text-muted">Disposal date</span><input type="date" name="disposedOn" required defaultValue={new Date().toISOString().slice(0, 10)} className="input w-full" /></label>
              <label className="block"><span className="mb-1 block text-xs font-medium text-muted">Sale proceeds (AED)</span><input type="number" step="0.01" min="0" name="disposalValue" defaultValue="0" className="input w-full" /></label>
            </div>
            <div className="flex items-center gap-3"><button type="submit" className="btn btn-primary" disabled={dPending}>{dPending ? "Saving…" : "Mark disposed"}</button>{dState.error && <p role="alert" className="text-sm text-[var(--danger-text,#b42318)]">{dState.error}</p>}</div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function MaintenanceForm({ assetId }: { assetId: string }) {
  const [state, action, pending] = useActionState(
    async (prev: State, fd: FormData) => addMaintenanceAction(prev, fd),
    { error: null } as State
  );
  return (
    <form action={action} key={state.ok ? "reset" : "form"} className="card space-y-3 p-4">
      <h2 className="text-sm font-semibold text-primary">Log maintenance</h2>
      <input type="hidden" name="assetId" value={assetId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block"><span className="mb-1 block text-xs font-medium text-muted">Date</span><input type="date" name="date" required defaultValue={new Date().toISOString().slice(0, 10)} className="input w-full" /></label>
        <label className="block"><span className="mb-1 block text-xs font-medium text-muted">Cost (AED)</span><input type="number" step="0.01" min="0" name="cost" defaultValue="0" className="input w-full" /></label>
        <label className="block sm:col-span-2"><span className="mb-1 block text-xs font-medium text-muted">What was done</span><input name="description" required className="input w-full" /></label>
        <label className="block"><span className="mb-1 block text-xs font-medium text-muted">Done by</span><input name="doneBy" className="input w-full" /></label>
        <label className="block"><span className="mb-1 block text-xs font-medium text-muted">Next due (optional)</span><input type="date" name="nextDueDate" className="input w-full" /></label>
      </div>
      <div className="flex items-center gap-3"><button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "Saving…" : "Add entry"}</button>{state.error && <p role="alert" className="text-sm text-[var(--danger-text,#b42318)]">{state.error}</p>}</div>
    </form>
  );
}

export function DeleteMaintenanceButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button type="button" disabled={pending} aria-label="Delete entry" className="rounded-md p-1 text-subtle hover:bg-surface-hover hover:text-secondary" onClick={() => start(async () => { const fd = new FormData(); fd.set("id", id); await deleteMaintenanceAction(fd); })}>
      <Trash2 className="h-4 w-4" />
    </button>
  );
}
