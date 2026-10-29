"use client";

import { useActionState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Select } from "@/components/ui/Select";
import { DatePicker } from "@/components/ui/DatePicker";
import { COST_KINDS, COST_KIND_LABEL, costTotals } from "@/lib/candidateCosts";
import { addCostAction, deleteCostAction, toggleCostPaidAction } from "./cost-actions";

import { Button } from "@/components/ui/Button";
type Cost = { id: string; kind: string; amount: number; incurredOn: string; paid: boolean; note: string | null };
type State = { error: string | null; ok?: boolean };

const aed = (n: number) => `AED ${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const lbl = "mb-1 block text-xs font-medium text-muted";

/** What this candidate has cost so far (agency fee, visa and permit fees, medical, ticket), with paid and outstanding. */
export function CostPanel({ candidateId, costs, canEdit = true }: { candidateId: string; costs: Cost[]; canEdit?: boolean }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const totals = costTotals(costs);
  const [state, action, pending] = useActionState(
    async (_p: State, fd: FormData) => {
      fd.set("id", candidateId);
      const res = await addCostAction(_p, fd);
      if (res.ok) { formRef.current?.reset(); router.refresh(); }
      return res;
    },
    { error: null } as State,
  );

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-default px-4 py-3">
        <div>
          <p className="text-sm font-medium text-primary">Costs</p>
          <p className="text-xs text-muted">What it has cost to bring this candidate on board. Added up per agency on the Agencies page.</p>
        </div>
        <p className="tabular text-sm text-secondary">
          <span className="font-semibold text-primary">{aed(totals.total)}</span> · paid {aed(totals.paid)} · <span className={totals.outstanding > 0 ? "font-medium text-[var(--warning-text,#92400e)]" : ""}>owing {aed(totals.outstanding)}</span>
        </p>
      </div>
      {costs.length > 0 && (
        <ul className="divide-y divide-[var(--border)]">
          {costs.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm">
              <span className="min-w-0 flex-1">
                <span className="font-medium text-primary">{COST_KIND_LABEL[c.kind] ?? c.kind}</span>
                <span className="ml-2 text-xs text-muted">{new Date(c.incurredOn).toLocaleDateString("en-GB")}{c.note ? ` · ${c.note}` : ""}</span>
              </span>
              <span className="tabular text-primary">{aed(c.amount)}</span>
              {canEdit ? <form action={toggleCostPaidAction}>
                <input type="hidden" name="costId" value={c.id} />
                <button type="submit" className={c.paid ? "text-xs font-medium text-[var(--success)] hover:underline" : "text-xs font-medium text-[var(--warning-text,#92400e)] hover:underline"} title="Click to change">{c.paid ? "Paid" : "Owing"}</button>
              </form> : <span className="text-xs text-muted">{c.paid ? "Paid" : "Owing"}</span>}
              {canEdit && <form action={deleteCostAction}>
                <input type="hidden" name="costId" value={c.id} />
                <button type="submit" className="text-subtle hover:text-[var(--error)]" aria-label={`Remove ${COST_KIND_LABEL[c.kind] ?? c.kind}`}><Trash2 className="h-4 w-4" aria-hidden /></button>
              </form>}
            </li>
          ))}
        </ul>
      )}
      {canEdit && <form ref={formRef} action={action} className="grid grid-cols-1 gap-3 border-t border-default bg-surface-subtle px-4 py-3 sm:grid-cols-[12rem_8rem_9rem_1fr_auto] sm:items-end">
        <label className="block"><span className={lbl}>For</span><Select name="kind" defaultValue="AGENCY_FEE" searchable={false} options={COST_KINDS.map((k) => ({ value: k.value, label: k.label }))} /></label>
        <label className="block"><span className={lbl}>Amount (AED)</span><input name="amount" inputMode="decimal" required className="input w-full" placeholder="0.00" /></label>
        <label className="block"><span className={lbl}>Date</span><DatePicker name="incurredOn" defaultValue={new Date().toISOString().slice(0, 10)} className="w-full" /></label>
        <label className="block"><span className={lbl}>Note</span><input name="note" maxLength={200} className="input w-full" /></label>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-muted"><input type="checkbox" name="paid" /> Paid</label>
          <Button size="btn-sm" type="submit" disabled={pending} loading={pending}>Add cost</Button>
        </div>
        {state.error && <p role="alert" className="text-sm text-[var(--error)] sm:col-span-full">{state.error}</p>}
      </form>}
    </div>
  );
}
