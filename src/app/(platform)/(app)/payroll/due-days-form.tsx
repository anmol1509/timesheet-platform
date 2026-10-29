"use client";

import { useActionState } from "react";
import { setDueDaysAction } from "./actions";
import { NumberInput } from "@/components/ui/NumberInput";

import { Button } from "@/components/ui/Button";
/** How many days after the month ends salaries must be paid. Runs show a due date and flag when they are late. */
export function DueDaysForm({ current }: { current: number | null }) {
  const [state, action, pending] = useActionState(
    async (_prev: { error: string | null; ok?: boolean }, fd: FormData) => setDueDaysAction(fd),
    { error: null } as { error: string | null; ok?: boolean }
  );
  return (
    <form action={action} className="flex flex-wrap items-end gap-3 p-4">
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted">Salaries are due this many days after month end</span>
        <NumberInput name="dueDays" defaultValue={current ?? ""} min={0} max={60} step={1} placeholder="No due date" className="w-44" />
      </label>
      <Button variant="secondary" size="btn" type="submit" disabled={pending} loading={pending}>Save</Button>
      {state.ok && <span className="text-sm text-[var(--success)]">Saved</span>}
      {state.error && <p role="alert" className="text-sm text-[var(--error)]">{state.error}</p>}
      <p className="w-full text-xs text-muted">For example, 15 means September salaries are due on 15 October. Each new run shows its due date and warns when it is late.</p>
    </form>
  );
}
