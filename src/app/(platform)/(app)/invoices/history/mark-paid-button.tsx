"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { DatePicker } from "@/components/ui/DatePicker";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/Dialog";
import { Select } from "@/components/ui/Select";

/** Marks an invoice paid on the day the money really arrived, and says which company bank received it. */
export function MarkPaidButton({
  action,
  invoiceId,
  invoiceNumber,
  banks = [],
  defaultBankId = "",
}: {
  action: (formData: FormData) => void | Promise<void>;
  invoiceId: string;
  invoiceNumber: string;
  banks?: { id: string; label: string }[];
  defaultBankId?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [bank, setBank] = useState(defaultBankId);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="text-xs font-medium text-[var(--brand-primary)] hover:underline">Mark paid</button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title="Mark invoice as paid" description={`When did the money for ${invoiceNumber} arrive, and in which account?`}>
          <form ref={formRef} action={async (fd) => { await action(fd); setOpen(false); }} className="mt-4 space-y-3">
            <input type="hidden" name="invoiceId" value={invoiceId} />
            <label className="block text-sm font-medium text-primary">Received on<div className="mt-1"><DatePicker name="paidDate" value={date} onChange={setDate} ariaLabel="Received on" max={new Date().toISOString().slice(0, 10)} /></div></label>
            {banks.length > 0 && (
              <label className="block text-sm font-medium text-primary">Received in<div className="mt-1"><Select name="bankId" value={bank} onChange={setBank} options={[{ value: "", label: "Default bank" }, ...banks.map((b) => ({ value: b.id, label: b.label }))]} searchable={false} /></div></label>
            )}
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit">Mark paid</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
