"use client";

import { useActionState, useState } from "react";
import { Plus, UserPlus } from "lucide-react";
import { Select } from "@/components/ui/Select";
import { PhoneField } from "@/components/ui/PhoneField";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { createAgencyContactAction, type CreateContactResult } from "./actions";

export type AgencyContactOption = { id: string; name: string; agencyId: string };

/**
 * A reusable person picker: search existing contacts for the selected
 * agency, or add a new one inline without leaving the form. The same
 * coordinator at an agency typically handles many candidates, so this is a
 * proper pickable record rather than a name re-typed on every candidate.
 */
export function ContactPicker({
  name,
  agencyId,
  contacts,
  value,
  onChange,
  disabled,
}: {
  /** Hidden field name the selected contact id submits under. */
  name: string;
  agencyId: string;
  contacts: AgencyContactOption[];
  value: string;
  onChange: (id: string, contacts: AgencyContactOption[]) => void;
  disabled?: boolean;
}) {
  const [list, setList] = useState(contacts);
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(
    async (_prev: CreateContactResult, fd: FormData) => {
      fd.set("agencyId", agencyId);
      const res = await createAgencyContactAction({ error: null }, fd);
      if (res.contact) {
        const next = [...list, { id: res.contact.id, name: res.contact.name, agencyId }];
        setList(next);
        onChange(res.contact.id, next);
        setOpen(false);
      }
      return res;
    },
    { error: null } as CreateContactResult
  );

  const options = list.filter((c) => c.agencyId === agencyId);

  return (
    <div className="flex items-center gap-2">
      <input type="hidden" name={name} value={value} />
      <div className="flex-1">
        <Select
          value={value}
          onChange={(v) => onChange(v, list)}
          searchable
          disabled={disabled || !agencyId}
          placeholder={agencyId ? "Select a contact…" : "Choose an agency first"}
          options={[{ value: "", label: "None" }, ...options.map((c) => ({ value: c.id, label: c.name }))]}
        />
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={disabled || !agencyId}
          className="btn btn-secondary shrink-0 px-2.5 disabled:opacity-50"
          title="Add a new contact"
        >
          <UserPlus className="h-4 w-4" aria-hidden />
        </button>
        <DialogContent title="Add agency contact" description="A reusable contact you can pick again for other candidates from this agency.">
          <form action={action} className="mt-4 space-y-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">Name *</span>
              <input name="name" required autoFocus className="input w-full" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">Mobile</span>
              <PhoneField name="phone" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">Email</span>
              <input name="email" type="email" className="input w-full" />
            </label>
            <div className="flex items-center gap-3 pt-1">
              <button type="submit" className="btn btn-primary" disabled={pending}>
                <Plus className="h-4 w-4" aria-hidden /> {pending ? "Adding…" : "Add contact"}
              </button>
              {state.error && <p role="alert" className="text-sm text-[var(--error)]">{state.error}</p>}
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
