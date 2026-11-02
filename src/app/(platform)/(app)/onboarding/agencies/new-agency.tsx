"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Building2 } from "lucide-react";
import { keepInput } from "@/lib/vendor/keepInput";
import { PhoneField } from "@/components/ui/PhoneField";
import { CountrySelect } from "@/components/ui/CountrySelect";
import { Dialog, DialogClose, DialogContent, DialogFooter } from "@/components/ui/Dialog";
import { createAgencyAction, type CreateAgencyResult } from "../actions";

import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/Alert";
const lbl = "mb-1.5 block text-xs font-medium text-secondary";

/** Adds a brand-new recruitment agency. */
export function NewAgency() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [country, setCountry] = useState("");
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
      <DialogContent icon={<Building2 className="h-[18px] w-[18px]" />} title="New recruitment agency" description="Agencies put candidates forward for onboarding. Contacts are added from a candidate's form.">
        <form onSubmit={keepInput(action)} className="mt-6">
          <div className="space-y-6">
            <section className="space-y-3">
              <h3 className="text-xs font-semibold tracking-wide text-muted uppercase">Agency</h3>
              <label className="block"><span className={lbl}>Agency name <span className="text-[var(--error)]">*</span></span><input name="name" required autoFocus className="input w-full" /></label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block"><span className={lbl}>Country</span><CountrySelect name="country" value={country} onChange={setCountry} /></label>
                <label className="block"><span className={lbl}>Licence number</span><input name="licence" className="input w-full" /></label>
                <label className="block sm:col-span-2"><span className={lbl}>Address</span><input name="address" className="input w-full" /></label>
              </div>
            </section>
            <section className="space-y-3 border-t border-default pt-5">
              <h3 className="text-xs font-semibold tracking-wide text-muted uppercase">Contact</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block"><span className={lbl}>Contact person</span><input name="contactPerson" className="input w-full" /></label>
                <label className="block"><span className={lbl}>Designation</span><input name="contactDesignation" placeholder="e.g. Operations manager" className="input w-full" /></label>
                <label className="block"><span className={lbl}>Phone</span><PhoneField name="phone" country={country} /></label>
                <label className="block"><span className={lbl}>Email</span><input name="email" type="email" className="input w-full" /></label>
              </div>
            </section>
          </div>
          {state.error && <Alert className="mt-4">{state.error}</Alert>}
          <DialogFooter>
            <DialogClose asChild><Button size="btn" type="button" variant="secondary">Cancel</Button></DialogClose>
            <Button size="btn" type="submit" disabled={pending} loading={pending}>Add agency</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
