"use client";

import { useRouter } from "next/navigation";
import { History, Undo2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToastActions } from "@/components/ui/Toast";
import { undoBulkSaveAction } from "./bulk-undo";

/** "2026-11" as "Nov 2026" (no database code here: this runs in the browser). */
const monthLabel = (key: string) => { const [y, m] = key.split("-").map(Number); return y && m ? new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" }) : key; };

export type BulkSaveRow = { id: string; at: string; by: string; month: string; workers: number };

/**
 * Bulk timesheet saves that can still be undone. Undoing removes the rows that save created, puts back the hours it overwrote
 * and removes the attendance it added (anything since submitted, approved or locked is left alone and counted).
 */
export function BulkSaves({ saves, heading, highlight }: { saves: BulkSaveRow[]; heading: string; highlight?: string }) {
  const router = useRouter();
  const toast = useToastActions();
  if (saves.length === 0) return null;

  async function undo(id: string) {
    const r = await undoBulkSaveAction(id);
    if (r.error) return { error: r.error };
    const parts = [
      r.removed ? `${r.removed} ${r.removed === 1 ? "row" : "rows"} removed` : "",
      r.restored ? `${r.restored} ${r.restored === 1 ? "row" : "rows"} put back as they were` : "",
      r.attendanceRemoved ? `${r.attendanceRemoved} attendance ${r.attendanceRemoved === 1 ? "day" : "days"} removed` : "",
      r.skipped ? `${r.skipped} left alone because they were submitted or locked since` : "",
    ].filter(Boolean);
    toast.success("Save undone", parts.join(" · ") || "Nothing needed changing.");
    router.refresh();
    return {};
  }

  return (
    <section className="rounded-[14px] border border-default bg-surface p-4" aria-label={heading}>
      <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-primary"><History className="h-4 w-4 text-muted" aria-hidden /> {heading}</h2>
      <ul className="divide-y divide-[var(--border)]">
        {saves.map((s) => (
          <li key={s.id} className={`flex flex-wrap items-center gap-x-4 gap-y-1 py-2 text-sm ${s.id === highlight ? "rounded-lg bg-brand-soft px-2" : ""}`}>
            <span className="font-medium text-primary">{monthLabel(s.month)}</span>
            <span className="text-secondary">{s.workers} {s.workers === 1 ? "worker" : "workers"}</span>
            <span className="text-xs text-muted">{new Date(s.at).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })} · {s.by}</span>
            <span className="ml-auto">
              <ConfirmDialog
                title="Undo this save?"
                description="Rows it created are deleted, hours it overwrote are put back, and attendance it added is removed. Anything submitted, approved or locked since is left alone."
                confirmLabel="Undo"
                onConfirm={() => undo(s.id)}
                trigger={(open) => (
                  <button type="button" onClick={open} className="inline-flex items-center gap-1 text-xs font-medium text-[var(--error)] hover:underline"><Undo2 className="h-3.5 w-3.5" aria-hidden /> Undo this save</button>
                )}
              />
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
