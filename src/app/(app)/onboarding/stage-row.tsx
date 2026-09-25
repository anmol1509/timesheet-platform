"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Minus, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { Select } from "@/components/ui/Select";
import { DatePicker } from "@/components/ui/DatePicker";
import { updateStageAction } from "./actions";
import type { Stage, StatusKind } from "@/lib/onboarding";

type State = { error: string | null; ok?: boolean };

const KIND_STYLE: Record<StatusKind, string> = {
  done: "bg-[var(--success-soft)] text-[var(--success-text,#067647)]",
  progress: "bg-[var(--warning-soft,#fef3c7)] text-[var(--warning-text,#92400e)]",
  pending: "bg-surface-subtle text-muted",
  issue: "bg-[var(--error-soft,#fee4e2)] text-[var(--error)]",
};
const KIND_ICON: Record<StatusKind, React.ReactNode> = {
  done: <Check className="h-3 w-3" />,
  progress: <span className="h-1.5 w-1.5 rounded-full bg-current" />,
  pending: <Minus className="h-3 w-3" />,
  issue: <X className="h-3 w-3" />,
};

export function StageRow({
  candidateId,
  stage,
  status,
  kind,
}: {
  candidateId: string;
  stage: Stage;
  status: string;
  kind: StatusKind;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [state, action, pending] = useActionState(
    async (_prev: State, fd: FormData) => {
      fd.set("id", candidateId);
      fd.set("stage", stage.key);
      const res = await updateStageAction({ error: null }, fd);
      if (res.ok) {
        setOpen(false);
        router.refresh();
      }
      return res;
    },
    { error: null } as State
  );

  return (
    <div className="border-b border-default last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-surface-hover"
      >
        <span className="text-sm font-medium text-primary">{stage.label}</span>
        <span className="flex items-center gap-2">
          <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", KIND_STYLE[kind])}>
            {KIND_ICON[kind]} {status}
          </span>
          <ChevronDown className={cn("h-4 w-4 text-subtle transition-transform", open && "rotate-180")} aria-hidden />
        </span>
      </button>
      {open && (
        <form action={action} className="grid gap-3 border-t border-default bg-surface-subtle px-4 py-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">Status</span>
            <Select
              name="status"
              defaultValue={status}
              searchable={false}
              options={stage.statuses.map((s) => ({ value: s.value, label: s.value }))}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">Status date</span>
            <DatePicker name="statusDate" defaultValue={new Date().toISOString().slice(0, 10)} className="w-full" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">Reference number</span>
            <input name="referenceNo" className="input w-full" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">Expiry date (if applicable)</span>
            <DatePicker name="expiryDate" className="w-full" />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs font-medium text-muted">Remarks</span>
            <input name="remarks" className="input w-full" />
          </label>
          <div className="flex items-center gap-3 sm:col-span-2">
            <button type="submit" className="btn btn-primary" disabled={pending}>
              {pending ? "Saving…" : "Save status"}
            </button>
            {state.error && <p role="alert" className="text-sm text-[var(--error)]">{state.error}</p>}
          </div>
        </form>
      )}
    </div>
  );
}
