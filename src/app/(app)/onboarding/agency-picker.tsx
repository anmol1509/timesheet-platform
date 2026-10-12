"use client";

import { useActionState, useState } from "react";
import { Plus, Building2 } from "lucide-react";
import { Select } from "@/components/ui/Select";
import { PhoneField } from "@/components/ui/PhoneField";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { createAgencyAction, type CreateAgencyResult } from "./actions";

export type AgencyOption = { id: string; name: string };

/** Same "pick existing, or add new inline" pattern as ContactPicker, one
 * level up — the agency itself. Nothing forces picking from a stale list
 * when the agency simply hasn't been added yet. */
export function AgencyPicker({
  name,
  agencies,
  value,
  onChange,
  disabled,
}: {
  name: string;
  agencies: AgencyOption[];
  value: string;
  onChange: (id: string, agencies: AgencyOption[]) => void;
  disabled?: boolean;
}) {
  const [list, setList] = useState(agencies);
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(
    async (_prev: CreateAgencyResult, fd: FormData) => {
      const res = await createAgencyAction({ error: null }, fd);
      if (res.agency) {
        const next = [...list, { id: res.agency.id, name: res.agency.name }];
        setList(next);
        onChange(res.agency.id, next);
        setOpen(false);
      }
      return res;
    },
    { error: null } as CreateAgencyResult
  );

  return (
    <div className="flex items-center gap-2">
      <input type="hidden" name={name} value={value} />
      <div className="flex-1">
        <Select
          value={value}
          onChange={(v) => onChange(v, list)}
          searchable
          disabled={disabled}
          placeholder="Select an agency…"
          emptyText="No agencies yet — add one with the button."
          options={[{ value: "", label: "None" }, ...list.map((a) => ({ value: a.id, label: a.name }))]}
        />
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={disabled}
          className="btn btn-secondary shrink-0 px-2.5 disabled:opacity-50"
          title="Add a new agency"
        >
          <Building2 className="h-4 w-4" aria-hidden />
        </button>
        <DialogContent title="Add agency" description="Creates a real Supplier record — the same list used across the app.">
          <form action={action} className="mt-4 space-y-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">Agency name *</span>
              <input name="name" required autoFocus className="input w-full" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">Contact phone</span>
              <PhoneField name="phone" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">Contact email</span>
              <input name="email" type="email" className="input w-full" />
            </label>
            <div className="flex items-center gap-3 pt-1">
              <button type="submit" className="btn btn-primary" disabled={pending}>
                <Plus className="h-4 w-4" aria-hidden /> {pending ? "Adding…" : "Add agency"}
              </button>
              {state.error && <p role="alert" className="text-sm text-[var(--error)]">{state.error}</p>}
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
