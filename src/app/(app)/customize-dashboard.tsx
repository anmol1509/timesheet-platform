"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Settings2, ChevronUp, ChevronDown } from "lucide-react";
import { m } from "motion/react";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/Dialog";
import { Switch } from "@/components/ui/Switch";
import { WidgetThumb } from "@/components/WidgetThumb";
import { DURATION, EASE } from "@/lib/motion";
import { saveDashboardPreferenceAction } from "./dashboard-actions";

type WidgetMeta = { id: string; label: string };

// Short names for the picker; the registry labels are long because they double
// as documentation. Unknown ids fall back to the registry label.
const TITLES: Record<string, { title: string; hint: string }> = {
  kpi: { title: "Key numbers", hint: "Workforce, deployment, projects, alerts" },
  "trend-attention": { title: "Hours trend & alerts", hint: "Normal vs overtime, plus what needs attention" },
  "timesheet-pipeline": { title: "Timesheet pipeline", hint: "Where rows sit in approval, hours by weekday" },
  "compliance-runway": { title: "Compliance runway", hint: "Documents expiring in the next 90 days" },
  "document-expiry": { title: "Document expiry", hint: "Employees, clients, projects, suppliers" },
  composition: { title: "Workforce mix", hint: "By employee type, deployed vs bench" },
  "staff-partners-facilities": { title: "Staff, partners & camps", hint: "Assigned staff, associates, bed occupancy" },
  "quick-actions": { title: "Quick actions", hint: "Shortcuts to common tasks" },
  "months-with-data": { title: "Months with data", hint: "Which timesheet months are loaded" },
};

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
          className="max-w-2xl!"
          description="Switch sections on or off and reorder them. Saved to your account."
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
      <ul className="max-h-[28rem] space-y-2 overflow-y-auto pr-1">
        {order.map((id, i) => {
          const isHidden = hidden.has(id);
          return (
            <m.li
              key={id}
              layout
              transition={{ duration: DURATION, ease: EASE }}
              className="flex items-center gap-3 rounded-card border border-default bg-surface p-2.5"
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
              <WidgetThumb id={id} muted={isHidden} />
              <div className={`min-w-0 flex-1 ${isHidden ? "opacity-60" : ""}`}>
                <p className="truncate text-sm font-medium text-primary">
                  {TITLES[id]?.title ?? labelById[id] ?? id}
                </p>
                <p className="mt-0.5 line-clamp-2 text-xs text-muted">{TITLES[id]?.hint}</p>
              </div>
              <Switch
                checked={!isHidden}
                onCheckedChange={() => toggle(id)}
                ariaLabel={`Show ${TITLES[id]?.title ?? labelById[id] ?? id}`}
              />
            </m.li>
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
