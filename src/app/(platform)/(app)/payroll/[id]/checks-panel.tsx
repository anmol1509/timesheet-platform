"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CircleAlert } from "lucide-react";
import { recomputeRunAction } from "../actions";
import { DaysButton } from "./days-panel";

import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/Alert";
export type CheckIssue = { text: string; href?: string; kind?: string; workers?: { id: string; name: string }[] };

const RECALC_KINDS = new Set(["pending-timesheets", "no-hours", "no-attendance", "zero-pay", "swing"]);

/**
 * "Worth checking", with the fix beside each item instead of a link away: the workers each issue is about, each opening
 * its days to correct them right here; Recalculate once the hours or attendance are right; and the link to the module
 * where the underlying records live.
 */
export function ChecksPanel({ runId, canEdit, issues }: { runId: string; canEdit: boolean; issues: CheckIssue[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function recalc() {
    setError(null); setDone(false);
    start(async () => {
      const fd = new FormData();
      fd.set("id", runId);
      const res = await recomputeRunAction(fd);
      if (res.error) { setError(res.error); return; }
      setDone(true);
      router.refresh();
    });
  }

  // One Recalculate button for the whole panel, under the first issue it applies to.
  const firstRecalc = issues.find((i) => i.kind && RECALC_KINDS.has(i.kind));

  return (
    <div className="space-y-4">
      {issues.map((i) => (
        <section key={i.text} className="rounded-md border border-default p-3 text-sm">
          <p className="flex items-start gap-2 text-primary"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-[var(--warning)]" aria-hidden />{i.text}</p>
          {i.workers && i.workers.length > 0 && (
            <ul className="mt-2 divide-y divide-[var(--border)] rounded-md border border-default">
              {i.workers.slice(0, 40).map((w) => (
                <li key={w.id} className="flex items-center justify-between gap-3 px-3 py-1.5">
                  <Link href={`/employees/${w.id}`} target="_blank" rel="noopener noreferrer" className="min-w-0 truncate text-primary hover:underline">{w.name}</Link>
                  <DaysButton runId={runId} employeeId={w.id} name={w.name} />
                </li>
              ))}
              {i.workers.length > 40 && <li className="px-3 py-1.5 text-xs text-muted">…and {i.workers.length - 40} more</li>}
            </ul>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-3">
            {canEdit && i.kind && RECALC_KINDS.has(i.kind) && i === firstRecalc && <Button variant="secondary" size="btn-sm" type="button" disabled={pending} onClick={recalc} loading={pending}>Recalculate the run</Button>}
            {i.href && <Link href={i.href} className="text-xs font-medium text-[var(--brand-primary)] hover:underline">Open the records</Link>}
          </div>
        </section>
      ))}
      {done && <p className="rounded-md border border-[var(--success-border)] bg-[var(--success-soft)] px-3 py-2 text-sm text-[var(--success)]">Recalculated. The list above is up to date after you close this panel.</p>}
      {error && <Alert>{error}</Alert>}
    </div>
  );
}
