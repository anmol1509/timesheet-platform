"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { PhoneField } from "@/components/ui/PhoneField";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { createAgencyAction, type CreateAgencyResult } from "../actions";

import { Button } from "@/components/ui/Button";
const lbl = "mb-1 block text-xs font-medium text-muted";

/** Adds a brand-new recruitment agency. */
export function NewAgency() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(
    async (_p: CreateAgencyResult, fd: FormData) => {
      const res = await createAgencyAction({ error: null }, fd);
      if (res.agency) { setOpen(false); router.refresh(); }
      return res;
    },
    { error: null } as CreateAgencyResult,
  );
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <button type="button" className="btn btn-primary btn-sm" onClick={() => setOpen(true)}><Plus className="h-3.5 w-3.5" aria-hidden /> New agency</button>
      <DialogContent title="New recruitment agency" description="Agencies put candidates forward for onboarding. Contacts are added from a candidate's form.">
        <form action={action} className="mt-4 space-y-3">
          <label className="block"><span className={lbl}>Agency name *</span><input name="name" required autoFocus className="input w-full" /></label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block"><span className={lbl}>Country</span><input name="country" className="input w-full" /></label>
            <label className="block"><span className={lbl}>Licence number</span><input name="licence" className="input w-full" /></label>
            <label className="block"><span className={lbl}>Phone</span><PhoneField name="phone" /></label>
            <label className="block"><span className={lbl}>Email</span><input name="email" type="email" className="input w-full" /></label>
          </div>
          <div className="flex items-center gap-3 pt-1">
            <Button size="btn" type="submit" disabled={pending} loading={pending}>Add agency</Button>
            {state.error && <p role="alert" className="text-sm text-[var(--error)]">{state.error}</p>}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
