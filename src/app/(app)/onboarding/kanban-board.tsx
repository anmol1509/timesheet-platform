"use client";

import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { STAGES, currentStage, daysSince, isOverdue, type StageKey } from "@/lib/onboarding";

type Candidate = {
  id: string;
  candidateNo: number;
  candidateName: string;
  trade: string | null;
  readyToJoin: boolean;
  joined: boolean;
  updatedAt: Date;
  agency: { name: string } | null;
  offerStatus: string;
  wppStatus: string;
  workPermitPaymentStatus: string;
  entryPermitStatus: string;
  arrivalStatus: string;
  medicalStatus: string;
  tawjeehStatus: string;
  iloeStatus: string;
  contractStatus: string;
  idVisaStatus: string;
};

type ColumnKey = StageKey | "READY" | "JOINED";

/** Groups candidates by where they currently sit in the pipeline. No drag
 * and drop (this app has no dnd dependency yet) — each card links straight
 * to the candidate page, where the actual stage/status editing happens. */
export function KanbanBoard({ candidates }: { candidates: Candidate[] }) {
  const columns: { key: ColumnKey; label: string }[] = [
    ...STAGES.map((s) => ({ key: s.key as ColumnKey, label: s.short })),
    { key: "READY", label: "Ready to join" },
    { key: "JOINED", label: "Joined" },
  ];

  const buckets = new Map<ColumnKey, Candidate[]>(columns.map((c) => [c.key, []]));
  for (const c of candidates) {
    const key: ColumnKey = c.joined ? "JOINED" : c.readyToJoin ? "READY" : (currentStage(c)?.key ?? "READY");
    buckets.get(key)!.push(c);
  }

  if (candidates.length === 0) {
    return (
      <div className="card p-8 text-center text-sm text-muted">
        No candidates match this view yet. Add a candidate, or switch the filter above.
      </div>
    );
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {columns.map((col) => {
        const items = buckets.get(col.key) ?? [];
        return (
          <div key={col.key} className="w-64 shrink-0">
            <div className="mb-2 flex items-center justify-between px-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">{col.label}</p>
              <span className="text-xs text-subtle">{items.length}</span>
            </div>
            <div className="flex flex-col gap-2">
              {items.map((c) => {
                const overdue = !c.joined && isOverdue(c, c.updatedAt);
                return (
                  <Link
                    key={c.id}
                    href={`/onboarding/${c.id}`}
                    className={cn(
                      "card block p-3 text-sm transition-shadow hover:shadow-md",
                      overdue && "border-[var(--error)]"
                    )}
                  >
                    <p className="truncate font-medium text-primary">{c.candidateName}</p>
                    <p className="truncate text-xs text-muted">{c.agency?.name ?? "No agency"}{c.trade ? ` · ${c.trade}` : ""}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-[11px] text-subtle">#{String(c.candidateNo).padStart(3, "0")}</span>
                      {col.key === "JOINED" ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-[var(--success)]" aria-hidden />
                      ) : (
                        <span className={cn("text-[11px]", overdue ? "font-medium text-[var(--error)]" : "text-subtle")}>
                          {daysSince(c.updatedAt)}d
                        </span>
                      )}
                    </div>
                  </Link>
                );
              })}
              {items.length === 0 && <p className="rounded-lg border border-dashed border-default px-3 py-4 text-center text-xs text-subtle">Empty</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
