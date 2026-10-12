"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Settings2 } from "lucide-react";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/Dialog";
import { Switch } from "@/components/ui/Switch";
import { saveModuleSectionsAction } from "@/app/(app)/dashboards/section-actions";

/** Customize for a module dashboard: switch its sections on or off. Saved to the person's account. */
export function CustomizeSections({
  module,
  sections,
  hidden,
}: {
  module: string;
  sections: { id: string; label: string }[];
  hidden: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [off, setOff] = useState(new Set(hidden));
  const [pending, startTransition] = useTransition();

  return (
    <>
      <button
        type="button"
        onClick={() => { setOff(new Set(hidden)); setOpen(true); }}
        className="inline-flex h-9 items-center gap-1.5 rounded-control border border-strong bg-surface px-3 text-[13px] font-medium text-secondary shadow-xs transition hover:bg-surface-hover hover:text-primary"
      >
        <Settings2 className="h-3.5 w-3.5" aria-hidden />
        Customize
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title="Customize this dashboard" description="Switch sections on or off. The key numbers at the top always stay.">
          <ul className="mt-2 space-y-2">
            {sections.map((s) => (
              <li key={s.id} className="flex items-center justify-between rounded-lg border border-default px-3 py-2.5">
                <span className="text-sm text-primary">{s.label}</span>
                <Switch
                  ariaLabel={s.label}
                  checked={!off.has(s.id)}
                  onCheckedChange={(on) =>
                    setOff((prev) => {
                      const next = new Set(prev);
                      if (on) next.delete(s.id);
                      else next.add(s.id);
                      return next;
                    })
                  }
                />
              </li>
            ))}
          </ul>
          <DialogFooter>
            <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await saveModuleSectionsAction(module, [...off]);
                  setOpen(false);
                  router.refresh();
                })
              }
            >
              {pending ? "Saving…" : "Save"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
