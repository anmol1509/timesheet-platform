"use client";

import { Phone, StickyNote } from "lucide-react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DatePicker } from "@/components/ui/DatePicker";
import { cn } from "@/lib/cn";
import { addSalesNoteAction, setFollowUpAction } from "./activity-actions";
import { Alert } from "@/components/Alert";

export type ActivityRow = { id: string; kind: string; body: string; userName: string | null; createdAt: string };

const DOT: Record<string, string> = { NOTE: "bg-[var(--info)]", CALL: "bg-[var(--warning)]", SENT: "bg-[var(--brand-primary)]", REVISION: "bg-[var(--brand-primary)]", STATUS: "bg-[var(--text-subtle)]", CREATED: "bg-[var(--text-subtle)]", FOLLOWUP: "bg-[var(--warning)]", LOST: "bg-[var(--error)]" };

const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** Follow-up date plus the trail of notes, calls, sends and status changes for one enquiry or quotation. */
export function ActivityPanel({ entity, id, nextFollowUp, activities, canWrite }: { entity: "quotation" | "enquiry"; id: string; nextFollowUp: string; activities: ActivityRow[]; canWrite: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [text, setText] = useState("");
  const [date, setDate] = useState(nextFollowUp);
  const [editingDate, setEditingDate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = { entity, id } as const;

  function add(kind: "NOTE" | "CALL") {
    setError(null);
    start(async () => {
      const res = await addSalesNoteAction(t, kind, text);
      if (res.error) return setError(res.error);
      setText("");
      router.refresh();
    });
  }
  function saveDate(next: string | null) {
    setError(null);
    start(async () => {
      const res = await setFollowUpAction(t, next);
      if (res.error) return setError(res.error);
      setEditingDate(false);
      router.refresh();
    });
  }

  const overdue = nextFollowUp && new Date(`${nextFollowUp}T23:59:59`) < new Date();

  return (
    <div className="space-y-5">
      <div className="card p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-primary">Next follow-up</h2>
          {canWrite && !editingDate && <button type="button" onClick={() => setEditingDate(true)} className="text-xs font-medium text-[var(--brand-primary)] hover:underline">{nextFollowUp ? "Change" : "Set a date"}</button>}
        </div>
        {editingDate ? (
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1"><DatePicker value={date} onChange={setDate} className="w-full" /></div>
            <button type="button" disabled={pending || !date} onClick={() => saveDate(date)} className="btn btn-primary btn-sm">Save</button>
            {nextFollowUp && <button type="button" disabled={pending} onClick={() => saveDate(null)} className="btn btn-secondary btn-sm">Clear</button>}
          </div>
        ) : nextFollowUp ? (
          <p className={cn("mt-2 text-sm", overdue ? "font-medium text-[var(--error)]" : "text-primary")}>{new Date(`${nextFollowUp}T12:00:00`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}{overdue ? " · overdue" : ""}</p>
        ) : (
          <p className="mt-2 text-sm text-muted">None set. A date shows up under “Needs you today” when it arrives.</p>
        )}
      </div>

      <div className="card p-5">
        <h2 className="text-sm font-semibold text-primary">Activity</h2>
        {canWrite && (
          <div className="mt-3 space-y-2">
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder="Write a note, or what was said on a call…" className="input w-full" />
            <div className="flex gap-2">
              <button type="button" disabled={pending || !text.trim()} onClick={() => add("NOTE")} className="btn btn-secondary btn-sm gap-1.5"><StickyNote className="h-3.5 w-3.5" aria-hidden />Add note</button>
              <button type="button" disabled={pending || !text.trim()} onClick={() => add("CALL")} className="btn btn-secondary btn-sm gap-1.5"><Phone className="h-3.5 w-3.5" aria-hidden />Log call</button>
            </div>
          </div>
        )}
        {error && <Alert className="mt-2">{error}</Alert>}
        {activities.length === 0 ? (
          <p className="mt-4 text-sm text-muted">Nothing yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-[var(--border)]">
            {activities.map((a) => (
              <li key={a.id} className="flex gap-3 py-2.5 text-sm">
                <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", DOT[a.kind] ?? "bg-[var(--text-subtle)]")} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block whitespace-pre-wrap text-primary">{a.kind === "CALL" ? <b>Call · </b> : null}{a.body}</span>
                  <span className="block text-xs text-subtle">{a.userName ?? "System"} · {when(a.createdAt)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
