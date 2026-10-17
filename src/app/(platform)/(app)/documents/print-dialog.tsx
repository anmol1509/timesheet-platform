"use client";

import { Printer } from "lucide-react";
import { useState } from "react";
import { Checkbox } from "@/components/ui/Checkbox";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/Dialog";
import { PRINT_LIMIT } from "./print-docs";

export type PrintOption = {
  key: string;
  label: string;
  /** How many of the selected people or suppliers have this document on file. */
  have: number;
  /** How many were selected. */
  of: number;
  /** Extra words after the count, e.g. "one per supplier". */
  note?: string;
};

/**
 * "Print…": pick which kinds of document to print for the people or suppliers chosen, or all of them. Shows how many
 * will actually print and how many aren't on file, so nothing is silently left out.
 */
export function PrintDialog({ open, onOpenChange, title, subject, options, count, onPrint }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** "12 employees" / "3 suppliers" */
  subject: string;
  options: PrintOption[];
  /** What would print for the chosen kinds, so the dialog can show the real total. */
  count: (keys: string[]) => { printing: number; missing: number };
  onPrint: (keys: string[]) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <DialogContent title={title} description={`${subject} selected. Choose what to print.`}>
          <Choices options={options} count={count} onCancel={() => onOpenChange(false)} onPrint={(keys) => { onPrint(keys); onOpenChange(false); }} />
        </DialogContent>
      )}
    </Dialog>
  );
}

/** Mounted fresh each time the dialog opens, so every kind that is on file starts ticked. */
function Choices({ options, count, onCancel, onPrint }: { options: PrintOption[]; count: (keys: string[]) => { printing: number; missing: number }; onCancel: () => void; onPrint: (keys: string[]) => void }) {
  const [chosen, setChosen] = useState<Set<string>>(() => new Set(options.filter((o) => o.have > 0).map((o) => o.key)));
  const usable = options.filter((o) => o.have > 0);
  const allOn = usable.length > 0 && usable.every((o) => chosen.has(o.key));
  const keys = options.filter((o) => chosen.has(o.key)).map((o) => o.key);
  const { printing, missing } = count(keys);
  const tooMany = printing > PRINT_LIMIT;
  const toggle = (key: string) => setChosen((p) => { const n = new Set(p); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  return (
    <>
      <div className="mt-4 space-y-1">
        <div className="rounded-lg border border-default px-3 py-2.5">
          <Checkbox checked={allOn} onCheckedChange={(on) => setChosen(on ? new Set(usable.map((o) => o.key)) : new Set())} label={<span className="font-medium text-primary">All documents</span>} />
        </div>
        <div className="divide-y divide-[var(--border)] rounded-lg border border-default">
          {options.map((o) => (
            <div key={o.key} className="flex items-center justify-between gap-3 px-3 py-2.5">
              <Checkbox checked={chosen.has(o.key)} disabled={o.have === 0} onCheckedChange={() => toggle(o.key)} label={<span className={o.have === 0 ? "text-subtle" : "text-secondary"}>{o.label}</span>} />
              <span className="text-xs text-muted tabular">{o.have === 0 ? "none on file" : `${o.have} of ${o.of} have it${o.note ? ` · ${o.note}` : ""}`}</span>
            </div>
          ))}
        </div>
      </div>
      <p className="mt-3 text-sm text-secondary">
        {printing === 0 ? "Nothing to print with this choice." : <><b className="text-primary">{printing}</b> {printing === 1 ? "document" : "documents"} will print{missing > 0 ? <>, <span className="text-muted">{missing} not on file</span></> : null}.</>}
      </p>
      {tooMany && <p role="alert" className="mt-1 text-sm text-[var(--error)]">That is more than {PRINT_LIMIT} documents. Select fewer or untick some kinds.</p>}
      <p className="mt-1 text-xs text-subtle">PDFs and photos print; Word or Excel files can&apos;t be included.</p>
      <DialogFooter>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
        <button type="button" className="btn btn-primary gap-1.5" disabled={printing === 0 || tooMany} onClick={() => onPrint(keys)}><Printer className="h-4 w-4" aria-hidden />Print</button>
      </DialogFooter>
    </>
  );
}
