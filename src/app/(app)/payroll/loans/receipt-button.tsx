"use client";

import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/Dialog";

/** Opens the advance as a PDF, with the same printing choices as payslips and letters: plain paper or letterhead, signature, stamp. */
export function ReceiptButton({ id, label, icon }: { id: string; label: string; icon?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [letterhead, setLetterhead] = useState(false);
  const [signature, setSignature] = useState(false);
  const [stamp, setStamp] = useState(false);
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const params = new URLSearchParams();
  if (letterhead) params.set("letterhead", "1");
  if (signature) params.set("signature", "1");
  if (stamp) params.set("stamp", "1");
  if (name.trim()) params.set("name", name.trim());
  if (title.trim()) params.set("title", title.trim());
  const href = `/api/payroll/loans/${id}/receipt${params.size > 0 ? `?${params}` : ""}`;
  return (
    <>
      <button type="button" className="inline-flex items-center gap-1 text-[var(--brand-primary)] hover:underline" onClick={() => setOpen(true)}>{icon} {label}</button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title={label} description="Opens as a PDF to print and sign. The employee signs the acknowledgement at the bottom of the same page. The wording comes from your Advance letter templates (Letters › Templates).">
          <div className="mt-4 space-y-3 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={letterhead} onChange={(e) => setLetterhead(e.target.checked)} /> On the company letterhead</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={signature} onChange={(e) => setSignature(e.target.checked)} /> Add the company signature (if on file)</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={stamp} onChange={(e) => setStamp(e.target.checked)} /> Add the company stamp (if on file)</label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block"><span className="mb-1 block text-xs font-medium text-muted">Signatory name</span><input value={name} onChange={(e) => setName(e.target.value)} className="input w-full" placeholder="Authorised signatory" /></label>
              <label className="block"><span className="mb-1 block text-xs font-medium text-muted">Title</span><input value={title} onChange={(e) => setTitle(e.target.value)} className="input w-full" placeholder="e.g. General Manager" /></label>
            </div>
            <div className="flex justify-end">
              <a className="btn btn-primary" href={href} target="_blank" rel="noreferrer" onClick={() => setOpen(false)}>Open PDF</a>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
