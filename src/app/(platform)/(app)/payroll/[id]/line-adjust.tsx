"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { NumberInput } from "@/components/ui/NumberInput";
import { saveLineAction } from "../actions";

type Values = { deduction: number; deductionNote: string; advance: number; advanceNote: string; adjustment: number; adjustmentNote: string; bankCharge: number; bankWaived: boolean };

const aed = (n: number) => n.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * What is typed against one worker's line (deduction, advance, adjustment, bank charge) as one table cell: a small chip for
 * each figure that is set, and "+ Adjust" / "Edit" to open all four in one popup. A row with nothing typed is one short
 * link instead of four empty boxes, so twice as many workers fit on screen and the table stays within the page.
 */
export function LineAdjust({ lineId, name, values, deductionCount, disabled }: { lineId: string; name: string; values: Values; /** More than one named deduction: those are edited in View days. */ deductionCount: number; disabled: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [v, setV] = useState({ deduction: String(values.deduction || ""), deductionNote: values.deductionNote, advance: String(values.advance || ""), advanceNote: values.advanceNote, adjustment: String(values.adjustment || ""), adjustmentNote: values.adjustmentNote, bankCharge: String(values.bankCharge || ""), bankWaived: values.bankWaived });
  const multi = deductionCount > 1;

  const chips: { key: string; text: string; tone?: string; title?: string }[] = [];
  if (values.deduction > 0) chips.push({ key: "d", text: multi ? `${deductionCount} deductions −${aed(values.deduction)}` : `Deduction −${aed(values.deduction)}`, title: values.deductionNote });
  if (values.advance > 0) chips.push({ key: "a", text: `Advance −${aed(values.advance)}`, title: values.advanceNote });
  if (values.adjustment !== 0) chips.push({ key: "j", text: `Adjust ${values.adjustment > 0 ? "+" : "−"}${aed(Math.abs(values.adjustment))}`, title: values.adjustmentNote });
  if (values.bankCharge > 0) chips.push({ key: "b", text: values.bankWaived ? `Bank charge ${aed(values.bankCharge)} waived` : `Bank charge −${aed(values.bankCharge)}`, tone: values.bankWaived ? "line-through" : undefined });

  function reset() {
    setV({ deduction: String(values.deduction || ""), deductionNote: values.deductionNote, advance: String(values.advance || ""), advanceNote: values.advanceNote, adjustment: String(values.adjustment || ""), adjustmentNote: values.adjustmentNote, bankCharge: String(values.bankCharge || ""), bankWaived: values.bankWaived });
    setError(null);
  }
  function save() {
    setError(null);
    start(async () => {
      const fd = new FormData();
      fd.set("lineId", lineId);
      fd.set("deduction", v.deduction); fd.set("deductionNote", v.deductionNote);
      fd.set("advance", v.advance); fd.set("advanceNote", v.advanceNote);
      fd.set("adjustment", v.adjustment); fd.set("adjustmentNote", v.adjustmentNote);
      fd.set("bankSent", "1"); fd.set("bankCharge", v.bankCharge); fd.set("bankWaived", v.bankWaived ? "1" : "0");
      const res = await saveLineAction(fd);
      if (res.error) { setError(res.error); return; }
      setOpen(false);
      router.refresh();
    });
  }

  const field = (label: string, amountKey: "deduction" | "advance" | "adjustment", noteKey: "deductionNote" | "advanceNote" | "adjustmentNote", placeholder: string, off?: boolean) => {
    const has = Number(v[amountKey] || 0) !== 0;
    const required = amountKey !== "adjustment";
    return (
      <div className="grid grid-cols-[7rem_9rem_1fr] items-center gap-2">
        <span className="text-xs font-medium text-muted">{label}</span>
        <NumberInput step={0.01} value={v[amountKey]} onChange={(n) => setV((p) => ({ ...p, [amountKey]: String(n) }))} ariaLabel={`${label} (AED)`} inputClassName="h-9 text-right tabular-nums" disabled={off} />
        {has && !off ? <input value={v[noteKey]} onChange={(e) => setV((p) => ({ ...p, [noteKey]: e.target.value }))} placeholder={placeholder} aria-label={`${label} note`} className={`input h-9 text-sm ${required && !v[noteKey].trim() ? "border-[var(--warning)]" : ""}`} /> : <span className="text-xs text-subtle">{off ? "Several named deductions: edit them in View days." : ""}</span>}
      </div>
    );
  };

  return (
    <div className="flex max-w-[16rem] flex-wrap items-center gap-1">
      {chips.map((c) => (
        <span key={c.key} title={c.title} className={`rounded-full border border-default bg-surface-subtle px-2 py-0.5 text-[11px] tabular-nums text-secondary ${c.tone ?? ""}`}>{c.text}</span>
      ))}
      {!disabled && (
        <button type="button" onClick={() => { reset(); setOpen(true); }} className="text-xs font-medium text-[var(--brand-primary)] hover:underline">{chips.length === 0 ? "+ Adjust" : "Edit"}</button>
      )}
      {chips.length === 0 && disabled && <span className="text-muted">—</span>}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title={`Adjust ${name}`} description="Typed against this worker for this month. Each amount asks what it is for. Net pay updates when you save." className="max-w-2xl">
          <div className="mt-4 space-y-3">
            {field("Deduction", "deduction", "deductionNote", "What for? (fine, damage…)", multi)}
            {field("Advance", "advance", "advanceNote", "Note (advance taken on…)")}
            {field("Adjustment", "adjustment", "adjustmentNote", "Bonus / correction (− to deduct)")}
            <div className="grid grid-cols-[7rem_9rem_1fr] items-center gap-2">
              <span className="text-xs font-medium text-muted">Bank charge</span>
              <NumberInput step={0.01} value={v.bankCharge} onChange={(n) => setV((p) => ({ ...p, bankCharge: String(n) }))} ariaLabel="Bank charge (AED)" inputClassName={`h-9 text-right tabular-nums ${v.bankWaived ? "line-through opacity-60" : ""}`} />
              <label className="flex items-center gap-2 text-xs text-muted"><input type="checkbox" checked={v.bankWaived} onChange={(e) => setV((p) => ({ ...p, bankWaived: e.target.checked }))} /> Waive (take nothing)</label>
            </div>
            <div className="flex items-center gap-3 border-t border-default pt-3">
              <button type="button" className="btn btn-primary" disabled={pending} onClick={save}>{pending ? "Saving…" : "Save"}</button>
              <button type="button" className="btn btn-secondary" disabled={pending} onClick={() => setOpen(false)}>Cancel</button>
              {error && <p role="alert" className="text-sm text-[var(--error)]">{error}</p>}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
