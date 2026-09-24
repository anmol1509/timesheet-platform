"use client";

import { useActionState, useState, useTransition } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Building2, Check, ChevronDown, Plus } from "lucide-react";
import { setActiveBranchAction } from "@/app/(app)/branch-switcher-actions";
import { createBranchAction } from "@/app/(app)/settings/actions";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { cn } from "@/lib/cn";

type Branch = { id: string; code: string; name: string };
type State = { error: string | null; ok?: boolean };

function AddBranchForm({ current, onDone }: { current: Branch | null; onDone: () => void }) {
  const [state, action, pending] = useActionState(
    async (prev: State, fd: FormData) => {
      const res = await createBranchAction(prev, fd);
      if (res.ok) onDone();
      return res;
    },
    { error: null } as State
  );
  return (
    <form action={action} className="mt-4 space-y-3">
      <input type="hidden" name="switchTo" value="1" />
      <div className="grid grid-cols-3 gap-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">Code</span>
          <input name="code" required maxLength={10} placeholder="DXB" className="input w-full uppercase" />
        </label>
        <label className="col-span-2 block">
          <span className="mb-1 block text-xs font-medium text-muted">Branch name</span>
          <input name="name" required placeholder="Dubai" className="input w-full" />
        </label>
      </div>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted">Emirate (optional)</span>
        <input name="emirate" className="input w-full" />
      </label>
      {current && (
        <label className="flex items-start gap-2 text-sm text-secondary">
          <input type="checkbox" name="copyFromBranchId" value={current.id} defaultChecked className="mt-0.5" />
          <span>
            Copy setup from {current.name}
            <span className="block text-xs text-muted">Dropdown lists and letter templates. Never people, projects, clients, banks or any records.</span>
          </span>
        </label>
      )}
      <div className="flex items-center gap-3 pt-1">
        <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "Adding…" : "Add branch and switch to it"}</button>
        {state.error && <p role="alert" className="text-sm text-[var(--danger-text,#b42318)]">{state.error}</p>}
      </div>
    </form>
  );
}

/**
 * Branch dropdown for super admins. Always present: with one branch it shows
 * that branch plus "Add new branch"; with several it also offers "All branches".
 */
export function BranchSwitcher({
  branches,
  activeBranchId,
}: {
  branches: Branch[];
  activeBranchId: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [pending, start] = useTransition();
  const many = branches.length > 1;
  const active = branches.find((b) => b.id === activeBranchId) ?? (many ? null : branches[0] ?? null);
  const label = active ? active.name : "All branches";

  function pick(id: string | null) {
    setOpen(false);
    const fd = new FormData();
    fd.set("branchId", id ?? "");
    start(() => { void setActiveBranchAction(fd); });
  }

  const row = "flex w-full items-center gap-2 rounded-sm px-2.5 py-1.5 text-left text-sm transition hover:bg-surface-hover";

  return (
    <>
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <button
            type="button"
            aria-label={`Active branch: ${label}`}
            disabled={pending}
            className="flex h-9 min-w-0 items-center gap-1.5 rounded-control border border-default bg-surface-subtle px-2 text-sm text-secondary transition hover:bg-surface-hover disabled:opacity-60"
          >
            <Building2 className="h-4 w-4 shrink-0 text-subtle" aria-hidden />
            <span className="max-w-28 truncate text-xs font-medium sm:max-w-40 sm:text-sm">{label}</span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-subtle" aria-hidden />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content align="end" sideOffset={8} className="rx-popover z-50 w-64 overflow-hidden rounded-card border border-default bg-surface p-1 shadow-popover">
            {many && (
              <button type="button" className={cn(row, !active ? "text-primary" : "text-secondary")} onClick={() => pick(null)}>
                <span className="flex-1">All branches</span>
                {!active && <Check className="h-4 w-4 text-[var(--brand-primary)]" aria-hidden />}
              </button>
            )}
            {branches.map((b) => (
              <button key={b.id} type="button" className={cn(row, active?.id === b.id ? "text-primary" : "text-secondary")} onClick={() => pick(b.id)}>
                <span className="min-w-0 flex-1 truncate">{b.code} — {b.name}</span>
                {active?.id === b.id && <Check className="h-4 w-4 shrink-0 text-[var(--brand-primary)]" aria-hidden />}
              </button>
            ))}
            <div className="my-1 border-t border-default" />
            <button type="button" className={cn(row, "text-[var(--brand-primary)]")} onClick={() => { setOpen(false); setAdding(true); }}>
              <Plus className="h-4 w-4 shrink-0" aria-hidden /> Add new branch
            </button>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent title="Add a branch" description="You'll be switched into it straight away.">
          <AddBranchForm current={active} onDone={() => setAdding(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}
