"use client";

import { startTransition, useActionState, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Minus, User, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { Select } from "@/components/ui/Select";
import { DatePicker } from "@/components/ui/DatePicker";
import { updateStageAction, assignStageTaskAction } from "./actions";
import { StageAttachments, type StageAttachmentRow } from "./stage-attachments";
import type { Stage, StatusKind } from "@/lib/onboarding";

import { Button } from "@/components/ui/Button";
type State = { error: string | null; ok?: boolean; skipped?: string[] };
type HrOption = { id: string; name: string };
type Task = { ownerId: string | null; ownerName: string | null; dueDate: Date | null } | null;

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

function toDateInput(d: Date | null) {
  return d ? new Date(d).toISOString().slice(0, 10) : "";
}

export function StageRow({
  candidateId,
  candidateBranchId,
  stage,
  status,
  kind,
  task,
  hrUsers,
  attachments,
  canEdit = true,
}: {
  candidateId: string;
  candidateBranchId: string;
  stage: Stage;
  status: string;
  kind: StatusKind;
  task: Task;
  hrUsers: HrOption[];
  attachments: StageAttachmentRow[];
  /** False for a person who may only look: the forms are left out. */
  canEdit?: boolean;
}) {
  const [open, setOpen] = useState(false);
  // Filled in from an attached file by the AI, for the person to check before saving the step.
  const [refNo, setRefNo] = useState("");
  const [expiry, setExpiry] = useState("");
  const [readNote, setReadNote] = useState(false);
  const router = useRouter();
  // What was submitted, kept so "Save anyway" sends the same values (the form clears itself after a submit).
  const submitted = useRef<FormData | null>(null);
  const [state, action, pending] = useActionState(
    async (_prev: State, fd: FormData) => {
      fd.set("id", candidateId);
      fd.set("stage", stage.key);
      submitted.current = fd;
      const res = await updateStageAction({ error: null }, fd);
      if (res.ok) {
        setOpen(false);
        router.refresh();
      }
      return res;
    },
    { error: null } as State
  );
  const [taskState, taskAction, taskPending] = useActionState(
    async (_prev: State, fd: FormData) => {
      fd.set("id", candidateId);
      fd.set("stage", stage.key);
      const res = await assignStageTaskAction({ error: null }, fd);
      if (res.ok) router.refresh();
      return res;
    },
    { error: null } as State
  );

  const overdue = task?.dueDate && new Date(task.dueDate) < new Date() && kind !== "done";

  return (
    <div className="border-b border-default last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-surface-hover"
      >
        <span className="flex flex-col items-start gap-0.5">
          <span className="text-sm font-medium text-primary">{stage.label}</span>
          {task && (task.ownerName || task.dueDate) && (
            <span className={cn("text-[11px]", overdue ? "font-medium text-[var(--error)]" : "text-subtle")}>
              {task.ownerName ? task.ownerName : "Unassigned"}
              {task.dueDate ? ` · due ${new Date(task.dueDate).toLocaleDateString("en-GB")}${overdue ? " (overdue)" : ""}` : ""}
            </span>
          )}
        </span>
        <span className="flex items-center gap-2">
          <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", KIND_STYLE[kind])}>
            {KIND_ICON[kind]} {status}
          </span>
          <ChevronDown className={cn("h-4 w-4 text-subtle transition-transform", open && "rotate-180")} aria-hidden />
        </span>
      </button>
      {open && (
        <div className="border-t border-default bg-surface-subtle">
          {canEdit && <form action={taskAction} className="flex flex-wrap items-end gap-3 border-b border-default px-4 py-3">
            <User className="mb-2 h-4 w-4 shrink-0 text-subtle" aria-hidden />
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">Owner</span>
              <Select
                name="ownerId"
                defaultValue={task?.ownerId ?? ""}
                searchable
                options={[{ value: "", label: "Unassigned" }, ...hrUsers.map((u) => ({ value: u.id, label: u.name }))]}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">Due date</span>
              <DatePicker name="dueDate" defaultValue={toDateInput(task?.dueDate ?? null)} />
            </label>
            <Button variant="secondary" size="btn" type="submit" disabled={taskPending} loading={taskPending}>
              Assign
            </Button>
            {taskState.error && <p role="alert" className="text-sm text-[var(--error)]">{taskState.error}</p>}
          </form>}
          {canEdit ? <form action={action} className="grid gap-3 px-4 py-4 sm:grid-cols-2">
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
              <input name="referenceNo" value={refNo} onChange={(e) => setRefNo(e.target.value)} className="input w-full" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">Expiry date (if applicable)</span>
              <DatePicker name="expiryDate" value={expiry} onChange={setExpiry} className="w-full" />
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-xs font-medium text-muted">Remarks</span>
              <input name="remarks" className="input w-full" />
            </label>
            <div className="flex items-center gap-3 sm:col-span-2">
              <Button size="btn" type="submit" disabled={pending} loading={pending}>
                Save status
              </Button>
              {state.error && <p role="alert" className="text-sm text-[var(--error)]">{state.error}</p>}
            </div>
            {state.skipped && state.skipped.length > 0 && (
              <div role="status" className="flex flex-wrap items-center gap-3 rounded-lg border border-[var(--warning-border)] bg-[var(--warning-soft)] px-3 py-2 text-sm text-primary sm:col-span-2">
                <span className="min-w-0 flex-1"><span className="font-medium">Earlier steps aren&rsquo;t finished:</span> {state.skipped.join(", ")}. Record this one anyway?</span>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={pending}
                  onClick={() => {
                    const fd = new FormData();
                    for (const [k, v] of submitted.current ?? []) fd.set(k, v);
                    fd.set("confirmSkip", "1");
                    startTransition(() => action(fd));
                  }}
                >Save anyway</button>
              </div>
            )}
          </form> : <p className="px-4 py-3 text-sm text-muted">You can see this step but not change it.</p>}
          {readNote && <p className="px-4 pb-1 text-xs text-muted">Reference and expiry read from the file. Check them, then save the step.</p>}
          <StageAttachments onRead={(r) => { if (r.docNumber) setRefNo((v) => v || r.docNumber); if (r.expiry) setExpiry((v) => v || r.expiry); setReadNote(true); }} candidateId={candidateId} candidateBranchId={candidateBranchId} stageKey={stage.key} attachments={attachments} canEdit={canEdit} />
        </div>
      )}
    </div>
  );
}
