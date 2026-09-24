"use client";

import { useState, useTransition } from "react";
import { FilePlus2, Plus, Sparkles } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { LETTER_PRESETS } from "@/lib/letterPresets";
import { addMissingDefaultsAction, createFromPresetAction } from "./actions";

/** "New template" — choose a ready-made starting point (or blank), then edit. */
export function NewTemplateButton({ variant = "primary" }: { variant?: "primary" | "secondary" }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const pick = (key: string) => start(async () => { const fd = new FormData(); fd.set("presetKey", key); await createFromPresetAction(fd); });
  return (
    <>
      <button type="button" className={variant === "primary" ? "btn btn-primary" : "btn btn-secondary"} onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" aria-hidden /> New template
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title="Start a new template" description="Pick a ready-made one and change the wording, or start blank." className="max-w-2xl!">
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {LETTER_PRESETS.map((p) => (
              <button key={p.key} type="button" disabled={pending} onClick={() => pick(p.key)}
                className="rounded-lg border border-default p-3 text-left transition hover:border-[var(--brand-primary)] hover:bg-surface-hover disabled:opacity-60">
                <span className="flex items-center gap-1.5 text-sm font-medium text-primary"><Sparkles className="h-3.5 w-3.5 text-[var(--brand-primary)]" aria-hidden />{p.name}</span>
                <span className="mt-0.5 block text-xs text-muted">{p.category}</span>
                <span className="mt-1.5 block text-xs text-secondary">{p.blurb}</span>
              </button>
            ))}
            <button type="button" disabled={pending} onClick={() => pick("blank")}
              className="rounded-lg border border-dashed border-default p-3 text-left transition hover:border-[var(--brand-primary)] hover:bg-surface-hover disabled:opacity-60">
              <span className="flex items-center gap-1.5 text-sm font-medium text-primary"><FilePlus2 className="h-3.5 w-3.5" aria-hidden />Blank template</span>
              <span className="mt-1.5 block text-xs text-secondary">Start from an empty letter body.</span>
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function AddDefaultsButton() {
  const [pending, start] = useTransition();
  return (
    <button type="button" className="btn btn-secondary" disabled={pending} onClick={() => start(async () => { await addMissingDefaultsAction(); })}>
      <Sparkles className="h-4 w-4" aria-hidden /> {pending ? "Adding…" : "Add ready-made templates"}
    </button>
  );
}
