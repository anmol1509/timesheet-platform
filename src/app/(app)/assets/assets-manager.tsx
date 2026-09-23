"use client";

import { useActionState, useState } from "react";
import { Plus } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { ASSET_CATEGORIES } from "@/lib/financeConstants";
import { saveAssetAction } from "./actions";

type State = { error: string | null; ok?: boolean };
export type AssetFormValues = { id?: string; code: string; name: string; category: string; serialNo: string; location: string; purchaseDate: string; cost: string; salvageValue: string; usefulLifeYears: string; notes: string };

export function AssetForm({ value, onDone }: { value?: AssetFormValues; onDone: () => void }) {
  const [state, action, pending] = useActionState(
    async (prev: State, fd: FormData) => { const r = await saveAssetAction(prev, fd); if (r.ok) onDone(); return r; },
    { error: null } as State
  );
  const f = (label: string, name: keyof AssetFormValues, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="block"><span className="mb-1 block text-xs font-medium text-muted">{label}</span><input name={name} defaultValue={value?.[name] ?? ""} className="input w-full" {...props} /></label>
  );
  return (
    <form action={action} className="mt-4 space-y-3">
      {value?.id && <input type="hidden" name="id" value={value.id} />}
      <div className="grid grid-cols-2 gap-3">
        {f("Asset code", "code", { required: true, placeholder: "e.g. VEH-001" })}
        {f("Name", "name", { required: true })}
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">Category</span>
          <input name="category" required list="asset-categories" defaultValue={value?.category ?? ""} className="input w-full" />
          <datalist id="asset-categories">{ASSET_CATEGORIES.map((c) => <option key={c} value={c} />)}</datalist>
        </label>
        {f("Serial / plate no.", "serialNo")}
        {f("Purchase date", "purchaseDate", { type: "date", required: true })}
        {f("Location", "location", { placeholder: "Camp, site, office…" })}
        {f("Cost (AED)", "cost", { type: "number", step: "0.01", min: "0", required: true })}
        {f("Salvage value (AED)", "salvageValue", { type: "number", step: "0.01", min: "0" })}
        {f("Useful life (years)", "usefulLifeYears", { type: "number", step: "0.5", min: "0.1", required: true })}
      </div>
      {f("Notes", "notes")}
      <div className="flex items-center gap-3">
        <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "Saving…" : value?.id ? "Save changes" : "Add asset"}</button>
        {state.error && <p role="alert" className="text-sm text-[var(--danger-text,#b42318)]">{state.error}</p>}
      </div>
    </form>
  );
}

export function AddAssetButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}><Plus className="h-4 w-4" aria-hidden /> Add asset</button>
      <Dialog open={open} onOpenChange={setOpen}><DialogContent title="Add asset" description="Straight-line depreciation is calculated from these figures."><AssetForm onDone={() => setOpen(false)} /></DialogContent></Dialog>
    </>
  );
}
