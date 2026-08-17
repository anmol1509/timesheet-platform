"use client";

import { useTransition } from "react";
import { unallocateEmployeeAction } from "../actions";
import { cn } from "@/lib/cn";
import type { TradeSupply } from "@/lib/demandSupply";

type Allocation = { id: string; employeeId: string; employeeName: string; employeeIdNo: string };
type Trade = {
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
  const remaining = Math.max(0, trade.quantity - trade.allocations.length);
  // Assignment is gated on having enough idle workers *of this trade* — other
  // trades are shown for context but can't fill the line.
  const short = remaining > 0 && supply.matching < remaining;

  function handleUnallocate(allocationId: string) {
    const formData = new FormData();
    formData.append("allocationId", allocationId);
    startTransition(() => {
      unallocateEmployeeAction(formData);
    });
  }

  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="font-medium text-primary">{trade.trade}</span>
          <span className="ml-2 text-xs text-muted">
            {trade.shift ? `${trade.shift} shift` : "No shift set"}
            {trade.rate != null ? ` · AED ${trade.rate}` : ""}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="tabular text-xs font-medium text-secondary">
            {trade.allocations.length} / {trade.quantity} assigned
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

          {/* No assigning here: this screen answers whether a line can be
              covered. Choosing workers happens on Mobilisation. */}
          {short && (
            <span className="text-xs text-[var(--warning)]">
              {remaining - supply.matching} short
            </span>
          )}
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
