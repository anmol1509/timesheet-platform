"use client";

import { useActionState } from "react";
import { setApprovalThresholdAction } from "./actions";

/** Payroll approval limit: above it, a run's creator can't approve their own run. */
export function ApprovalRuleForm({ current }: { current: number | null }) {
  const [state, action, pending] = useActionState(
    async (_prev: { error: string | null; ok?: boolean }, fd: FormData) => setApprovalThresholdAction(fd),
    { error: null } as { error: string | null; ok?: boolean }
  );
  return (
    <form action={action} className="card flex flex-wrap items-end gap-3 p-4">
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted">Second approver needed above (AED)</span>
        <input type="number" step="0.01" min="0" name="threshold" defaultValue={current ?? ""} placeholder="No limit" className="input w-44" />
      </label>
      <button type="submit" className="btn btn-secondary" disabled={pending}>{pending ? "Saving…" : "Save rule"}</button>
      {state.ok && <span className="text-sm text-[var(--success)]">Saved</span>}
      {state.error && <p role="alert" className="text-sm text-[var(--error)]">{state.error}</p>}
      <p className="w-full text-xs text-muted">
        When a run&apos;s total is above this, the person who created it can&apos;t approve it; someone else with approval rights has to. Leave blank for no limit.
      </p>
    </form>
  );
}
