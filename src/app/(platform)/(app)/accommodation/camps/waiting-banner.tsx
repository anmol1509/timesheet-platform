"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TriangleAlert } from "lucide-react";
import { autoAssignWaitingAction } from "../checkin-actions";

import { Button } from "@/components/ui/Button";
/** Workers who are checked in but have no bed yet, with one button to fill beds in order. */
export function WaitingBanner({ waiting, enough, canAssign }: { waiting: number; enough: boolean; canAssign: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [note, setNote] = useState<string | null>(null);
  if (waiting === 0 && !note) return null;
  return (
    <div role="status" className="flex flex-wrap items-center gap-3 rounded-card border border-[var(--warning-border,var(--border))] bg-[var(--warning-soft)] px-4 py-3 text-sm">
      <TriangleAlert className="h-5 w-5 shrink-0 text-[var(--warning)]" aria-hidden />
      <div className="min-w-0 flex-1">
        {waiting > 0 ? (
          <>
            <p className="font-semibold text-primary">{waiting} {waiting === 1 ? "worker is" : "workers are"} checked in and waiting for a bed.</p>
            <p className="text-muted">{enough ? "There are enough vacant beds in their camps for everyone." : "Not enough vacant beds in their camps for everyone."}</p>
          </>
        ) : (
          <p className="font-semibold text-primary">{note}</p>
        )}
        {waiting > 0 && note && <p className="text-muted">{note}</p>}
      </div>
      {waiting > 0 && (
        <>
          <Link href="/accommodation/bed-allocation" className="btn btn-secondary btn-sm">Review</Link>
          {canAssign && (
            <Button size="btn-sm" type="button" disabled={pending} onClick={() =>
                start(async () => {
                  const r = await autoAssignWaitingAction();
                  setNote("error" in r ? r.error : r.waiting > 0 ? `${r.assigned} placed, ${r.waiting} still waiting (no vacant bed).` : `${r.assigned} placed in order.`);
                  router.refresh();
                })
              } loading={pending}>
              {`Auto-assign ${waiting}`}
            </Button>
          )}
        </>
      )}
    </div>
  );
}
