"use client";

import { useState, useTransition } from "react";
import { setTradeApprovalAction, unallocateEmployeeAction } from "../actions";
import { Badge } from "@/components/Badge";
import { cn } from "@/lib/cn";
import type { TradeSupply } from "@/lib/demandSupply";
import {
  APPROVAL_COLOR,
  APPROVAL_LABEL,
  approvalStateOf,
  approvalSummary,
  approvedHeadcount,
} from "@/lib/demandApproval";
import { NumberInput } from "@/components/ui/NumberInput";

type Allocation = { id: string; employeeId: string; employeeName: string; employeeIdNo: string };
type Trade = {
  /** null while undecided, 0 once refused, otherwise the heads agreed. */
  approvedQuantity: number | null;
  id: string;
  trade: string;
  quantity: number;
  shift: string | null;
  rate: number | null;
  allocations: Allocation[];
};

export function TradeAllocationSection({
  trade,
  supply,
}: {
  trade: Trade;
  supply: TradeSupply;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Defaults to the full request: approving everything asked for is still the
  // common answer, so it should be one click.
  const [draft, setDraft] = useState<string>(
    String(trade.approvedQuantity ?? trade.quantity)
  );
  const state = approvalStateOf(trade);
  const approved = approvedHeadcount(trade);
  // What is left to fill is measured against what was agreed, not what was asked.
  const remaining = Math.max(0, approved - trade.allocations.length);
  // Assignment is gated on having enough idle workers *of this trade* — other
  // trades are shown for context but can't fill the line.
  const short = remaining > 0 && supply.matching < remaining;

  function saveApproval(value: string) {
    const formData = new FormData();
    formData.append("tradeId", trade.id);
    formData.append("approvedQuantity", value);
    setError(null);
    startTransition(async () => {
      const result = await setTradeApprovalAction(formData);
      if (result?.error) setError(result.error);
    });
  }

  function handleUnallocate(allocationId: string) {
    const formData = new FormData();
    formData.append("allocationId", allocationId);
    startTransition(() => {
      unallocateEmployeeAction(formData);
    });
  }

  return (
    <div className="card p-4">
      {error && <p className="mb-2 text-xs text-red-600">{error}</p>}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="font-medium text-primary">{trade.trade}</span>
          <span className="ml-2 text-xs text-muted">
            {trade.shift ? `${trade.shift} shift` : "No shift set"}
            {trade.rate != null ? ` · AED ${trade.rate}` : ""}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Badge color={APPROVAL_COLOR[state]}>{APPROVAL_LABEL[state]}</Badge>
          <span className="tabular text-xs font-medium text-secondary">
            {approvalSummary(trade)}
          </span>
          <span className="tabular text-xs font-medium text-secondary">
            {trade.allocations.length} / {approved || trade.quantity} assigned
          </span>

          {/* Counts, not names: at this stage the question is only whether the
              trade can be covered. Picking the actual workers happens during
              mobilisation. */}
          <span
            className={cn(
              "rounded-control px-2 py-1 text-xs font-medium",
              short
                ? "bg-[var(--warning-soft)] text-[var(--warning)]"
                : "bg-[var(--success-soft)] text-[var(--success)]"
            )}
          >
            {supply.matching} idle {trade.trade}
          </span>
          <span className="text-xs text-muted">{supply.other} idle in other trades</span>

          {short && (
            <span className="text-xs text-[var(--warning)]">
              {remaining - supply.matching} short of this trade
            </span>
          )}

          {/* Approve regardless of the shortage above: mobilisation can put an
              other-trade worker on the line, so availability today doesn't
              decide whether the client's request is agreed.

              A number rather than a yes/no, because a client agreeing to six of
              the ten asked for is the normal answer and the flag could only
              record ten. */}
          <div className="flex items-center gap-1.5">
            <label className="flex items-center gap-1.5">
              <span className="text-xs text-muted">Approve</span>
              <NumberInput value={draft} onChange={(v) => setDraft(String(v))} disabled={pending} min={0} max={trade.quantity} ariaLabel={`Number of ${trade.trade} to approve, of ${trade.quantity} requested`} className="w-16" />
              <span className="text-xs text-muted">of {trade.quantity}</span>
            </label>
            <button
              type="button"
              disabled={pending || draft.trim() === ""}
              onClick={() => saveApproval(draft)}
              className="btn btn-primary btn-sm"
            >
              {state === "PENDING" ? "Approve" : "Update"}
            </button>
            {state !== "PENDING" && (
              <button
                type="button"
                disabled={pending}
                onClick={() => saveApproval("")}
                title="Puts the line back to undecided"
                className="btn btn-secondary btn-sm"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {trade.allocations.length > 0 && (
        <ul className="mt-3 space-y-1">
          {trade.allocations.map((a) => (
            <li key={a.id} className="flex items-center justify-between text-sm">
              <span>
                {a.employeeName} <span className="text-subtle">{a.employeeIdNo}</span>
              </span>
              <button
                type="button"
                disabled={pending}
                onClick={() => handleUnallocate(a.id)}
                className="text-xs font-medium text-red-600 hover:underline disabled:opacity-60"
              >
                Unallocate
              </button>
            </li>
          ))}
        </ul>
      )}

    </div>
  );
}
