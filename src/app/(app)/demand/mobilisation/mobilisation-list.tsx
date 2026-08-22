"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/Badge";
import { cn } from "@/lib/cn";

type TradeRow = {
  id: string;
  trade: string;
  code: string | null;
  shift: string | null;
  quantity: number;
  filled: number;
  approved: boolean;
};

export type MobilisationRow = {
  id: string;
  requestNo: number;
  clientName: string;
  projectLabel: string;
  needed: number;
  filled: number;
  trades: TradeRow[];
};

/**
 * How far a demand has been staffed.
 *
 * "Open" on its own hid the difference between a demand nobody has touched and
 * one that is two workers short — which is the difference between starting and
 * chasing.
 */
export type Fulfilment = "open" | "partial" | "fulfilled";

export function fulfilmentOf(row: { needed: number; filled: number }): Fulfilment {
  if (row.filled === 0) return "open";
  return row.filled >= row.needed ? "fulfilled" : "partial";
}

const FULFILMENT = {
  open: { label: "Open", color: "slate" as const },
  partial: { label: "Partially fulfilled", color: "amber" as const },
  fulfilled: { label: "Fulfilled", color: "green" as const },
};

export function MobilisationList({ rows }: { rows: MobilisationRow[] }) {
  const [filter, setFilter] = useState<Fulfilment | "all">("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const counts = rows.reduce(
    (acc, r) => ({ ...acc, [fulfilmentOf(r)]: acc[fulfilmentOf(r)] + 1 }),
    { open: 0, partial: 0, fulfilled: 0 }
  );

  const visible = filter === "all" ? rows : rows.filter((r) => fulfilmentOf(r) === filter);

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {(
          [
            ["all", `All (${rows.length})`],
            ["open", `Open (${counts.open})`],
            ["partial", `Partially fulfilled (${counts.partial})`],
            ["fulfilled", `Fulfilled (${counts.fulfilled})`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={cn(
              "rounded-control border px-3 py-1.5 text-xs font-medium transition",
              filter === key
                ? "border-[var(--brand-primary)] bg-brand-soft text-[var(--brand-primary)]"
                : "border-default bg-surface text-secondary hover:bg-surface-hover"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[46rem] text-sm">
            <thead className="border-b border-default bg-surface-subtle text-left text-xs font-medium tracking-wide text-muted uppercase">
              <tr>
                <th className="w-10 px-4 py-3" />
                <th className="px-4 py-3">Request</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Project</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Mobilised</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {visible.flatMap((d) => {
                const state = fulfilmentOf(d);
                const isOpen = expanded.has(d.id);
                return [
                  <tr key={d.id}>
                    <td className="px-4 py-3">
                      {/* Same disclosure as the supplier list: the trades are
                          the detail you want without leaving the queue. */}
                      <button
                        type="button"
                        onClick={() => toggle(d.id)}
                        aria-expanded={isOpen}
                        aria-label={`${isOpen ? "Hide" : "Show"} trades on request ${d.requestNo}`}
                        className="rounded-sm p-0.5 text-subtle transition hover:bg-surface-hover hover:text-secondary"
                      >
                        <ChevronRight
                          className={cn("h-3.5 w-3.5 transition-transform", isOpen && "rotate-90")}
                        />
                      </button>
                    </td>
                    <td className="tabular px-4 py-3 font-medium text-primary">
                      #{d.requestNo}
                    </td>
                    <td className="px-4 py-3 text-secondary">{d.clientName}</td>
                    <td className="px-4 py-3 text-secondary">{d.projectLabel}</td>
                    <td className="px-4 py-3">
                      <Badge color={FULFILMENT[state].color}>{FULFILMENT[state].label}</Badge>
                    </td>
                    <td className="tabular px-4 py-3 text-secondary">
                      {d.filled} / {d.needed}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <Link
                        href={`/demand/${d.id}/mobilise`}
                        className="text-xs font-medium text-blue-600 hover:underline"
                      >
                        {state === "fulfilled" ? "Review" : "Mobilise"}
                      </Link>
                    </td>
                  </tr>,
                  ...(isOpen
                    ? [
                        <tr key={`${d.id}-trades`}>
                          <td colSpan={7} className="bg-surface-subtle px-4 py-3">
                            <ul className="divide-y divide-[var(--border)] rounded-card border border-default bg-surface">
                              {d.trades.map((t) => (
                                <li
                                  key={t.id}
                                  className="flex flex-wrap items-center gap-3 px-3 py-2"
                                >
                                  <span className="min-w-0 flex-1 text-sm text-primary">
                                    {t.trade}
                                    {t.code && (
                                      <span className="tabular ml-2 text-xs text-subtle">
                                        {t.code}
                                      </span>
                                    )}
                                  </span>
                                  <span className="text-xs text-muted">
                                    {t.shift ? `${t.shift} shift` : "No shift"}
                                  </span>
                                  {!t.approved && <Badge color="slate">Not approved</Badge>}
                                  <span
                                    className={cn(
                                      "tabular text-xs font-medium",
                                      t.filled >= t.quantity
                                        ? "text-[var(--success)]"
                                        : "text-[var(--warning)]"
                                    )}
                                  >
                                    {t.filled} / {t.quantity}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </td>
                        </tr>,
                      ]
                    : []),
                ];
              })}
            </tbody>
          </table>
        </div>
        {visible.length === 0 && (
          <p className="px-4 py-10 text-center text-sm text-muted">
            No demand is {FULFILMENT[filter as Fulfilment]?.label.toLowerCase() ?? "listed"}.
          </p>
        )}
      </div>
    </div>
  );
}
