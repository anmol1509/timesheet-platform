"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ScanSearch } from "lucide-react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/Dialog";
import { applyExpiriesAction, recheckDocumentAction, type Recheck } from "./actions";

const fmt = (iso: string | null) => (iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "none read");
const label = (t: string) => t.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

/** Reads each expired document's scan again and lets the person approve the dates that differ. */
export function RecheckExpired({ ids }: { ids: string[] }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Recheck[]>([]);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  const started = useRef(false);
  const applied = useRef(false);
  const router = useRouter();

  async function run() {
    started.current = true;
    setRunning(true);
    setMsg(null);
    const queue = [...ids];
    const pick = async () => {
      for (let id = queue.shift(); id; id = queue.shift()) {
        const r = await recheckDocumentAction(id).catch(() => ({ error: "Couldn't read this one." }));
        if ("error" in r && !("id" in r)) { setDone((n) => n + 1); continue; }
        const row = r as Recheck;
        setRows((prev) => [...prev, row]);
        if (!row.error && row.read && row.read !== row.stored && row.confidence !== "low") setChosen((prev) => new Set(prev).add(row.id));
        setDone((n) => n + 1);
      }
    };
    await Promise.all([pick(), pick(), pick()]);
    setRunning(false);
  }

  async function apply() {
    const items = rows.filter((r) => chosen.has(r.id) && r.read).map((r) => ({ id: r.id, expiry: r.read! }));
    const res = await applyExpiriesAction(items);
    setMsg(res.error ?? `Updated ${res.updated} document${res.updated === 1 ? "" : "s"}.`);
    if (!res.error) { applied.current = true; setChosen(new Set()); setRows((prev) => prev.map((r) => (chosen.has(r.id) && r.read ? { ...r, stored: r.read } : r))); }
  }

  const changed = rows.filter((r) => !r.error && r.read && r.read !== r.stored);
  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o && !started.current) void run(); if (!o && applied.current) { applied.current = false; router.refresh(); } }}>
      <DialogTrigger className="inline-flex h-8 items-center gap-1.5 rounded-md border border-strong bg-surface px-2.5 text-xs font-medium text-secondary shadow-xs hover:bg-surface-hover hover:text-primary">
        <ScanSearch className="h-3.5 w-3.5" aria-hidden /> Re-check expired against scans
      </DialogTrigger>
      <DialogContent title="Re-check expired documents" description="Each scan is read again and the date it shows is set beside the one on file. Nothing changes until you apply." className="max-w-2xl">
        <p className="mt-3 text-xs text-muted" aria-live="polite">{running ? `Reading ${done} of ${ids.length}…` : `Read ${rows.length} of ${ids.length}. ${changed.length} differ from what is on file.`}</p>
        <div className="mt-2 max-h-[55vh] overflow-y-auto rounded-lg border border-default">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-surface-hover text-muted"><tr><th className="w-8 px-2 py-2" /><th className="px-2 py-2">Employee</th><th className="px-2 py-2">On file</th><th className="px-2 py-2">Scan shows</th></tr></thead>
            <tbody>
              {rows.map((r) => {
                const differs = !r.error && !!r.read && r.read !== r.stored;
                return (
                  <tr key={r.id} className="border-t border-default align-top">
                    <td className="px-2 py-2"><input type="checkbox" disabled={!differs} checked={chosen.has(r.id)} aria-label={`Use the scan's date for ${r.employee}`} onChange={(e) => setChosen((prev) => { const n = new Set(prev); if (e.target.checked) n.add(r.id); else n.delete(r.id); return n; })} className="h-4 w-4 accent-[var(--brand-primary)]" /></td>
                    <td className="px-2 py-2"><span className="font-medium text-primary">{r.employee}</span><br /><span className="text-muted">{label(r.type)}</span></td>
                    <td className="px-2 py-2 tabular text-secondary">{fmt(r.stored)}</td>
                    <td className="px-2 py-2 tabular">{r.error ? <span className="text-[var(--error)]">{r.error}</span> : <span className={differs ? "font-medium text-primary" : "text-muted"}>{fmt(r.read)}{differs && r.confidence !== "high" ? ` (${r.confidence} confidence)` : ""}{!differs && r.read ? " ✓ same" : ""}</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {msg && <p className="mt-2 text-xs text-secondary" role="status">{msg}</p>}
        <div className="mt-3 flex justify-end">
          <button type="button" disabled={running || chosen.size === 0} onClick={() => void apply()} className="h-9 rounded-md bg-[var(--brand-primary)] px-3.5 text-sm font-medium text-white disabled:opacity-50">Apply {chosen.size || ""} date{chosen.size === 1 ? "" : "s"}</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
