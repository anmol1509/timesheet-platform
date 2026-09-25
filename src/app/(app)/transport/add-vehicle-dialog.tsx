"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogTrigger } from "@/components/ui/Dialog";
import { createVehicleAction } from "./actions";

/** The two fields needed to register a vehicle; capacity, driver and documents are filled in on its page. */
export function AddVehicleDialog() {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button type="button" className="btn btn-primary gap-1.5"><Plus className="h-4 w-4" aria-hidden />Add vehicle</button>
      </DialogTrigger>
      <DialogContent title="Add vehicle" description="Register it now; add the driver, capacity and document dates on its page." className="max-w-md">
        <form action={async (fd) => { await createVehicleAction(fd); setOpen(false); }} className="mt-4 space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">Plate number <span className="text-[var(--error)]">*</span></span>
            <input name="plateNumber" required placeholder="e.g. DXB A 12345" className="input w-full" autoFocus />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">Type</span>
            <input name="type" placeholder="e.g. 30-seater bus" className="input w-full" />
          </label>
          <DialogFooter>
            <DialogClose asChild><button type="button" className="btn btn-secondary">Cancel</button></DialogClose>
            <button type="submit" className="btn btn-primary">Add vehicle</button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
