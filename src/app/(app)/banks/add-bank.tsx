"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { BankForm, EMPTY_BANK } from "./bank-form";

export function AddBank({ companies }: { companies: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn btn-primary gap-1.5" onClick={() => setOpen(true)}><Plus className="h-4 w-4" aria-hidden /> Add bank account</button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl!" title="Add a bank account" description="A bank becomes active once its account number and a valid IBAN are entered. Until then it shows as Incomplete.">
          <div className="mt-4"><BankForm initial={EMPTY_BANK} companies={companies} onDone={() => setOpen(false)} /></div>
        </DialogContent>
      </Dialog>
    </>
  );
}
