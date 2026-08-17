"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRightLeft, Check } from "lucide-react";
import { Select } from "@/components/ui/Select";
import { Checkbox } from "@/components/ui/Checkbox";
import { cn } from "@/lib/cn";
import {
  allocateEmployeesAction,
  changeEmployeeTradeAction,
  unallocateEmployeeAction,
} from "../../actions";

type Line = {
  id: string;
  trade: string;
  /** Only approved lines can be filled; approval is per trade, not per demand. */
  approved: boolean;
  quantity: number;
  shift: string | null;
  assigned: { id: string; employeeId: string; name: string; employeeIdNo: string }[];
};

type Worker = {
  id: string;
  name: string;
  employeeIdNo: string;
  trade: string | null;
  /** Trades from the taxonomy join, checked alongside the `trade` string. */
  skillNames: string[];
};

function sameTrade(a: string | null | undefined, b: string) {
  if (!a) return false;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function holdsTrade(worker: Worker, trade: string) {
  return (
    sameTrade(worker.trade, trade) || worker.skillNames.some((n) => sameTrade(n, trade))
  );
}

/**
 * Mobilisation: put names against an accepted demand's trade lines.
 *
 * The view screen deliberately shows only counts — whether a line *can* be
 * covered. This is where the actual workers are chosen, which is why it lists
 * them by name.
 *
 * The second tab exists because the roster rarely matches a demand exactly: a
 * client asks for Carpenters and the bench holds Helpers. Re-designating a
 * worker is what happens in practice, so it's done here, and it writes the
 * worker's profile rather than being a per-demand fudge.
 */
export function MobilisationBoard({
  lines,
  workers,
  tradeOptions,
}: {
  lines: Line[];
  workers: Worker[];
  tradeOptions: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [activeLineId, setActiveLineId] = useState(lines[0]?.id ?? "");
  const [tab, setTab] = useState<"matching" | "other">("matching");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [retrade, setRetrade] = useState<Record<string, string>>({});

  const activeLine = lines.find((l) => l.id === activeLineId) ?? lines[0];
  const assignedIds = useMemo(
    () => new Set(lines.flatMap((l) => l.assigned.map((a) => a.employeeId))),
    [lines]
  );

  const available = useMemo(
    () => workers.filter((w) => !assignedIds.has(w.id)),
    [workers, assignedIds]
  );

  const matching = useMemo(
    () => (activeLine ? available.filter((w) => holdsTrade(w, activeLine.trade)) : []),
    [available, activeLine]
  );
  const others = useMemo(
    () => (activeLine ? available.filter((w) => !holdsTrade(w, activeLine.trade)) : []),
    [available, activeLine]
  );

  if (!activeLine) {
    return (
      <p className="card p-6 text-center text-sm text-muted">
        This demand has no trade lines to mobilise against.
      </p>
    );
  }

  const remaining = Math.max(0, activeLine.quantity - activeLine.assigned.length);
  const locked = !activeLine.approved;

  function toggle(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < remaining) next.add(id);
      return next;
    });
  }

  function assign() {
    if (picked.size === 0) return;
    const body = new FormData();
    body.append("tradeId", activeLine.id);
    for (const id of picked) body.append("employeeId", id);
    startTransition(async () => {
      await allocateEmployeesAction(body);
      setPicked(new Set());
      router.refresh();
    });
  }

  function unassign(allocationId: string) {
    const body = new FormData();
    body.append("allocationId", allocationId);
    startTransition(async () => {
      await unallocateEmployeeAction(body);
      router.refresh();
    });
  }

  function applyRetrade(employeeId: string) {
    const trade = retrade[employeeId];
    if (!trade) return;
    const body = new FormData();
    body.append("employeeId", employeeId);
    body.append("trade", trade);
    startTransition(async () => {
      await changeEmployeeTradeAction(body);
      setRetrade((prev) => {
        const next = { ...prev };
        delete next[employeeId];
        return next;
      });
      router.refresh();
    });
  }

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[18rem_1fr]">
      {/* Which line is being filled. */}
      <div className="space-y-2">
        {lines.map((line) => {
          const done = line.assigned.length >= line.quantity;
          return (
            <button
              key={line.id}
              type="button"
              onClick={() => {
                setActiveLineId(line.id);
                setPicked(new Set());
              }}
              className={cn(
                "w-full rounded-card border p-3 text-left transition",
                line.id === activeLine.id
                  ? "border-[var(--brand-primary)] bg-brand-soft"
                  : "border-default bg-surface hover:bg-surface-hover"
              )}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="font-medium text-primary">{line.trade}</span>
                {done && <Check className="h-4 w-4 text-[var(--success)]" aria-hidden />}
              </span>
              <span className="mt-0.5 block text-xs text-muted">
                {line.approved ? "" : "Not approved · "}
                {line.shift ? `${line.shift} shift · ` : ""}
                <span className="tabular">
                  {line.assigned.length}/{line.quantity}
                </span>{" "}
                assigned
              </span>
            </button>
          );
        })}
      </div>

      <div className="space-y-4">
        {activeLine.assigned.length > 0 && (
          <div className="card p-4">
            <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">
              Mobilised for {activeLine.trade}
            </h3>
            <ul className="divide-y divide-[var(--border)]">
              {activeLine.assigned.map((a) => (
                <li key={a.id} className="flex items-center justify-between py-2">
                  <Link
                    href={`/employees/${a.employeeId}`}
                    className="text-sm text-primary hover:underline"
                  >
                    {a.name}
                    <span className="tabular ml-2 text-xs text-subtle">
                      {a.employeeIdNo}
                    </span>
                  </Link>
                  <button
                    type="button"
                    disabled={locked || pending}
                    onClick={() => unassign(a.id)}
                    className="text-xs font-medium text-red-600 hover:underline disabled:opacity-60"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="card overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-default px-4 py-3">
            <div className="flex gap-1">
              {(
                [
                  ["matching", `${activeLine.trade} (${matching.length})`],
                  ["other", `Other trades (${others.length})`],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  className={cn(
                    "rounded-control px-3 py-1.5 text-xs font-medium transition",
                    tab === key
                      ? "bg-brand-soft text-[var(--brand-primary)]"
                      : "text-secondary hover:bg-surface-hover"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted">
                {locked
                  ? "Approve this trade to mobilise"
                  : remaining === 0
                    ? "Line is full"
                    : `${remaining} still needed`}
              </span>
              <button
                type="button"
                onClick={assign}
                disabled={locked || pending || picked.size === 0}
                className="btn btn-primary btn-sm"
              >
                Mobilise {picked.size > 0 ? picked.size : ""}
              </button>
            </div>
          </div>

          {tab === "matching" ? (
            matching.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-muted">
                No idle worker holds {activeLine.trade}. Use{" "}
                <span className="font-medium">Other trades</span> to re-designate
                someone.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {matching.map((w) => (
                  <li key={w.id} className="flex items-center gap-3 px-4 py-2.5">
                    <Checkbox
                      checked={picked.has(w.id)}
                      onCheckedChange={() => toggle(w.id)}
                      disabled={locked || (!picked.has(w.id) && picked.size >= remaining)}
                    />
                    <Link
                      href={`/employees/${w.id}`}
                      className="min-w-0 flex-1 text-sm text-primary hover:underline"
                    >
                      {w.name}
                      <span className="tabular ml-2 text-xs text-subtle">
                        {w.employeeIdNo}
                      </span>
                    </Link>
                    <span className="text-xs text-muted">{w.trade || "No trade set"}</span>
                  </li>
                ))}
              </ul>
            )
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {others.map((w) => (
                <li key={w.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                  <Link
                    href={`/employees/${w.id}`}
                    className="min-w-0 flex-1 text-sm text-primary hover:underline"
                  >
                    {w.name}
                    <span className="tabular ml-2 text-xs text-subtle">
                      {w.employeeIdNo}
                    </span>
                  </Link>
                  <span className="text-xs text-muted">{w.trade || "No trade set"}</span>
                  <div className="flex w-56 items-center gap-2">
                    <Select
                      value={retrade[w.id] ?? ""}
                      onChange={(v) => setRetrade((prev) => ({ ...prev, [w.id]: v }))}
                      placeholder="Change trade to…"
                      options={tradeOptions.map((name) => ({ value: name, label: name }))}
                    />
                    <button
                      type="button"
                      disabled={locked || pending || !retrade[w.id]}
                      onClick={() => applyRetrade(w.id)}
                      title="Updates the worker's profile, not just this demand"
                      className="shrink-0 rounded-control border border-default p-1.5 text-subtle transition hover:bg-surface-hover hover:text-secondary disabled:opacity-40"
                    >
                      <ArrowRightLeft className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </div>
                </li>
              ))}
              {others.length === 0 && (
                <p className="px-4 py-10 text-center text-sm text-muted">
                  No other idle workers available.
                </p>
              )}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
