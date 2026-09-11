"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Settings2, ChevronUp, ChevronDown, Eye, EyeOff } from "lucide-react";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/Dialog";
import { saveDashboardPreferenceAction } from "./dashboard-actions";

type WidgetMeta = { id: string; label: string };

export function CustomizeDashboardButton({
  widgets,
  initialOrder,
  initialHidden,
}: {
  widgets: WidgetMeta[];
  initialOrder: string[];
  initialHidden: string[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-8 items-center gap-1.5 rounded-control border border-strong bg-surface px-2.5 text-xs font-medium text-secondary shadow-xs transition hover:bg-surface-hover hover:text-primary"
      >
        <Settings2 className="h-3.5 w-3.5" aria-hidden />
        Customize
      </button>

      <Dialog modal={false} open={open} onOpenChange={setOpen}>
        <DialogContent
          title="Customize dashboard"
          description="Show, hide, and reorder the sections below. Saved to your account."
        >
          <CustomizeForm
            widgets={widgets}
            initialOrder={initialOrder}
            initialHidden={initialHidden}
            onClose={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

function CustomizeForm({
  widgets,
  initialOrder,
  initialHidden,
  onClose,
}: {
  widgets: WidgetMeta[];
  initialOrder: string[];
  initialHidden: string[];
  onClose: () => void;
}) {
  const router = useRouter();
  const labelById = Object.fromEntries(widgets.map((w) => [w.id, w.label]));
  const [order, setOrder] = useState(initialOrder);
  const [hidden, setHidden] = useState(new Set(initialHidden));
  const [pending, startTransition] = useTransition();

  function move(index: number, direction: -1 | 1) {
    setOrder((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function toggle(id: string) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSave() {
    const formData = new FormData();
    for (const id of hidden) formData.append("hiddenWidgets", id);
    for (const id of order) formData.append("widgetOrder", id);
    startTransition(async () => {
      await saveDashboardPreferenceAction(formData);
      router.refresh();
      onClose();
    });
  }

  return (
    <div className="mt-4 space-y-4">
      <ul className="max-h-96 space-y-1.5 overflow-y-auto">
        {order.map((id, i) => {
          const isHidden = hidden.has(id);
          return (
            <li
              key={id}
              className="flex items-center gap-2 rounded-control border border-default bg-surface p-2"
            >
              <div className="flex flex-col">
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  aria-label="Move up"
                  className="rounded p-0.5 text-subtle transition hover:bg-surface-hover hover:text-secondary disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === order.length - 1}
                  aria-label="Move down"
                  className="rounded p-0.5 text-subtle transition hover:bg-surface-hover hover:text-secondary disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </div>
              <span className={`flex-1 text-sm ${isHidden ? "text-subtle" : "text-primary"}`}>
                {labelById[id] ?? id}
              </span>
              <button
                type="button"
                onClick={() => toggle(id)}
                className="inline-flex items-center gap-1 rounded-control border border-default px-2 py-1 text-xs font-medium text-secondary transition hover:bg-surface-hover"
              >
                {isHidden ? (
                  <>
                    <EyeOff className="h-3.5 w-3.5" /> Hidden
                  </>
                ) : (
                  <>
                    <Eye className="h-3.5 w-3.5" /> Visible
                  </>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      <DialogFooter>
        <button type="button" onClick={onClose} className="btn btn-secondary">
          Cancel
        </button>
        <button type="button" onClick={handleSave} disabled={pending} className="btn btn-primary">
          {pending ? "Saving…" : "Save"}
        </button>
      </DialogFooter>
    </div>
  );
}
