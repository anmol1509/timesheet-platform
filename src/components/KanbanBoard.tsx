"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/cn";

export type KanbanColumn = { id: string; title: string; tone?: "slate" | "amber" | "blue" | "green" | "red"; hint?: string };
export type KanbanCard = { id: string; columnId: string; content: React.ReactNode; /** Shown in the column header total. */ weight?: number };

const DOT = { slate: "bg-[var(--text-subtle)]", amber: "bg-[var(--warning)]", blue: "bg-[var(--info)]", green: "bg-[var(--success)]", red: "bg-[var(--error)]" } as const;

/**
 * Column board. Cards are drag-and-drop when `onMove` is given; `transitions`
 * (from -> allowed targets) limits where a card may be dropped, and the server
 * action stays the authority. Without `onMove` the board is read-only.
 */
export function KanbanBoard({
  columns,
  cards,
  onMove,
  transitions,
  weightLabel,
  emptyText = "Nothing here",
}: {
  columns: KanbanColumn[];
  cards: KanbanCard[];
  onMove?: (cardId: string, toColumn: string) => Promise<{ error?: string | null } | void>;
  transitions?: Record<string, string[]>;
  weightLabel?: string;
  emptyText?: string;
}) {
  const [placement, setPlacement] = useState<Record<string, string>>({});
  const [dragging, setDragging] = useState<{ id: string; from: string } | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();

  const colOf = (c: KanbanCard) => placement[c.id] ?? c.columnId;
  const canDrop = (to: string) => !!dragging && dragging.from !== to && (!transitions || (transitions[dragging.from] ?? []).includes(to));

  function drop(to: string) {
    const d = dragging;
    setDragging(null);
    setOver(null);
    if (!d || !onMove || !canDrop(to)) return;
    setError(null);
    setPlacement((p) => ({ ...p, [d.id]: to }));
    start(async () => {
      const res = await onMove(d.id, to);
      if (res && res.error) {
        setError(res.error);
        setPlacement((p) => {
          const n = { ...p };
          delete n[d.id];
          return n;
        });
      }
    });
  }

  return (
    <div className="space-y-2">
      {error && <p role="alert" className="text-sm text-[var(--error)]">{error}</p>}
      <div className="flex gap-3 overflow-x-auto pb-2">
        {columns.map((col) => {
          const inCol = cards.filter((c) => colOf(c) === col.id);
          const weight = inCol.reduce((n, c) => n + (c.weight ?? 0), 0);
          const droppable = canDrop(col.id);
          return (
            <section
              key={col.id}
              aria-label={col.title}
              onDragOver={(e) => { if (droppable) { e.preventDefault(); setOver(col.id); } }}
              onDragLeave={() => setOver((o) => (o === col.id ? null : o))}
              onDrop={(e) => { e.preventDefault(); drop(col.id); }}
              className={cn(
                "flex w-72 shrink-0 flex-col rounded-xl border bg-surface-subtle transition",
                over === col.id ? "border-[var(--brand-primary)] bg-brand-soft" : dragging && droppable ? "border-dashed border-[var(--brand-primary)]/50" : "border-default",
                dragging && !droppable && dragging.from !== col.id && "opacity-50"
              )}
            >
              <header className="flex items-center justify-between gap-2 px-3 py-2.5">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-primary">
                  <span className={cn("h-2 w-2 rounded-full", DOT[col.tone ?? "slate"])} aria-hidden />
                  {col.title}
                  <span className="tabular rounded-full bg-surface-sunken px-1.5 text-xs font-medium text-muted">{inCol.length}</span>
                </h3>
                {weightLabel && weight > 0 && <span className="tabular text-xs text-muted">{weight} {weightLabel}</span>}
              </header>
              {col.hint && <p className="px-3 pb-1 text-[11px] text-subtle">{col.hint}</p>}
              <div className="flex max-h-[62vh] flex-1 flex-col gap-2 overflow-y-auto p-2 pt-0">
                {inCol.length === 0 && <p className="rounded-lg border border-dashed border-default px-3 py-6 text-center text-xs text-subtle">{emptyText}</p>}
                {inCol.map((c) => (
                  <div
                    key={c.id}
                    draggable={!!onMove}
                    onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; setDragging({ id: c.id, from: colOf(c) }); }}
                    onDragEnd={() => { setDragging(null); setOver(null); }}
                    className={cn("rounded-lg border border-default bg-surface p-3 shadow-sm", onMove && "cursor-grab active:cursor-grabbing", dragging?.id === c.id && "opacity-40")}
                  >
                    {c.content}
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>
      {onMove && <p className="text-xs text-subtle">Drag a card to another column to change its status.</p>}
    </div>
  );
}
