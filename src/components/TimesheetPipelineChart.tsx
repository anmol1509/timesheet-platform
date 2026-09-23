"use client";

import Link from "next/link";
import { m } from "motion/react";
import { FileSpreadsheet, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/Badge";
import type { TimesheetPipeline } from "@/lib/timesheetPipeline";

function formatMonthLabel(month: string) {
  const [y, mo] = month.split("-");
  return new Date(Number(y), Number(mo) - 1, 1).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });
}

/**
 * Where this month's timesheet rows are stuck. Ordered by the real approval
 * walk, so the eye lands on the stage holding the most rows — that's the one
 * blocking invoicing.
 */
export function TimesheetPipelineChart({ pipeline }: { pipeline: TimesheetPipeline }) {
  if (pipeline.month === null || pipeline.total === 0) {
    return (
      <div className="flex flex-col items-center px-5 py-10 text-center">
        <FileSpreadsheet className="mb-2 h-5 w-5 text-subtle" aria-hidden />
        <p className="text-sm font-medium text-primary">No timesheets yet</p>
        <p className="mt-1 text-xs text-muted">
          Upload a timesheet or record attendance to start the approval pipeline.
        </p>
      </div>
    );
  }

  const max = Math.max(...pipeline.stages.map((s) => s.count), 1);

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs text-muted">{formatMonthLabel(pipeline.month)}</span>
        <span className="tabular text-xs text-subtle">{pipeline.total} rows</span>
      </div>

      <ul className="space-y-2">
        {pipeline.stages.map((stage, i) => (
          <li key={stage.status} className="flex items-center gap-3">
            <span className="w-28 shrink-0 text-xs font-medium text-secondary">
              {stage.label}
            </span>
            <span className="flex h-6 min-w-0 flex-1 items-center">
              <m.span
                className="h-full rounded-sm bg-brand-soft"
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(2, (stage.count / max) * 100)}%` }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: i * 0.04 }}
              />
              <span className="tabular ml-2 shrink-0 text-xs font-semibold text-primary">
                {stage.count}
              </span>
            </span>
            <span className="hidden w-36 shrink-0 truncate text-right text-[11px] text-subtle sm:block">
              {stage.hint}
            </span>
          </li>
        ))}
      </ul>

      {pipeline.rejected > 0 && (
        <p className="flex items-center gap-2 rounded-control border border-[var(--error-border)] bg-[var(--error-soft)] px-3 py-2 text-xs text-[var(--error)]">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="flex-1">
            <Badge color="red">{pipeline.rejected}</Badge> rejected and awaiting rework.
          </span>
        </p>
      )}

      <Link
        href="/invoices/client-timesheet"
        className="inline-flex items-center text-xs font-medium text-[var(--brand-primary)] hover:underline"
      >
        View timesheets →
      </Link>
    </div>
  );
}
