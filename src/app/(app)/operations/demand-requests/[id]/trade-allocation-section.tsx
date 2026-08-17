"use client";

import { useState, useTransition } from "react";
import { Checkbox } from "@/components/ui/Checkbox";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/Dialog";
import { allocateEmployeesAction, unallocateEmployeeAction } from "../actions";
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
type IdleEmployee = { id: string; name: string; employeeIdNo: string; trade: string | null };

export function TradeAllocationSection({
  trade,
  idleEmployees,
  supply,
}: {
  trade: Trade;
  idleEmployees: IdleEmployee[];
  supply: TradeSupply;
}) {
  const [pending, startTransition] = useTransition();
  const [showAllocate, setShowAllocate] = useState(false);
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

          <button
            type="button"
            onClick={() => setShowAllocate(true)}
            disabled={remaining === 0 || short}
            title={
              short
                ? `Only ${supply.matching} idle ${trade.trade} available for ${remaining} still needed`
                : undefined
            }
            className="btn btn-primary btn-sm"
          >
            Assign
          </button>
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

      <AllocateModal
        open={showAllocate}
        trade={trade}
        remaining={remaining}
        idleEmployees={idleEmployees}
        onClose={() => setShowAllocate(false)}
      />
    </div>
  );
}

function AllocateModal({
  open,
  trade,
  remaining,
  idleEmployees,
  onClose,
}: {
  open: boolean;
  trade: Trade;
  remaining: number;
  idleEmployees: IdleEmployee[];
  onClose: () => void;
}) {
  return (
    <Dialog modal={false} open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        title={`Allocate to ${trade.trade}`}
        description={`Select up to ${remaining} idle employee${remaining === 1 ? "" : "s"}. Employees matching this trade are listed first.`}
      >
        {idleEmployees.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No idle employees available.</p>
        ) : (
          <AllocateForm key={trade.id} trade={trade} remaining={remaining} idleEmployees={idleEmployees} onClose={onClose} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function AllocateForm({
  trade,
  remaining,
  idleEmployees,
  onClose,
}: {
  trade: Trade;
  remaining: number;
  idleEmployees: IdleEmployee[];
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);

  const sorted = [...idleEmployees].sort((a, b) => {
    const aMatch = a.trade === trade.trade ? 0 : 1;
    const bMatch = b.trade === trade.trade ? 0 : 1;
    return aMatch - bMatch;
  });

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < remaining) {
        next.add(id);
      }
      return next;
    });
  }

  function handleSubmit() {
    if (selected.size === 0) return;
    const formData = new FormData();
    formData.append("tradeId", trade.id);
    for (const id of selected) formData.append("employeeId", id);
    startTransition(async () => {
      const res = await allocateEmployeesAction(formData);
      if (res.allocated < res.requested) {
        setResult(`Allocated ${res.allocated} of ${res.requested} — trade line is now full.`);
      } else {
        onClose();
      }
    });
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="max-h-72 space-y-1 overflow-y-auto rounded-lg border border-default p-2">
        {sorted.map((e) => {
          const disabled = !selected.has(e.id) && selected.size >= remaining;
          // Same loose comparison the counts use, so the badge and this list
          // never disagree about who holds the trade.
          const matches =
            (e.trade ?? "").trim().toLowerCase() === trade.trade.trim().toLowerCase();
          return (
            <label
              key={e.id}
              className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm ${
                disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer hover:bg-surface-hover"
              }`}
              onClick={(ev) => {
                ev.preventDefault();
                if (!disabled) toggle(e.id);
              }}
            >
              <Checkbox checked={selected.has(e.id)} />
              <span className="flex-1 truncate">
                {e.name} ({e.employeeIdNo})
                {e.trade && <span className="text-subtle"> — {e.trade}</span>}
              </span>
              {matches && (
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                  match
                </span>
              )}
            </label>
          );
        })}
      </div>
      {result && <p className="text-xs text-amber-600">{result}</p>}
      <DialogFooter>
        <button
          type="button"
          onClick={onClose}
          className="btn btn-secondary"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={selected.size === 0 || pending}
          className="btn btn-primary"
        >
          {pending ? "Allocating…" : `Allocate ${selected.size}`}
        </button>
      </DialogFooter>
    </div>
  );
}
