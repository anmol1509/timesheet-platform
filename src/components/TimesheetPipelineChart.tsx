"use client";

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

  const COLORS = [
    "var(--border-strong)",
    "var(--info)",
    "var(--warning)",
    "var(--brand-primary)",
    "var(--success)",
  ];
  const busiest = pipeline.stages.reduce((a, s) => (s.count > a.count ? s : a), pipeline.stages[0]);

  return (
    <div className="space-y-5">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <span className="tabular text-3xl font-semibold tracking-tight text-primary">
            {pipeline.total}
          </span>
          <span className="ml-2 text-sm text-muted">rows in {formatMonthLabel(pipeline.month)}</span>
        </div>
        {busiest.count > 0 && (
          <span className="text-xs text-subtle">
            Most at <span className="font-medium text-secondary">{busiest.label}</span>
          </span>
        )}
      </div>

      <div className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full bg-[var(--surface-sunken)]">
        {pipeline.stages.map((stage, i) =>
          stage.count > 0 ? (
            <m.span
              key={stage.status}
              title={`${stage.label}: ${stage.count}`}
              className="h-full first:rounded-l-full last:rounded-r-full"
              style={{ backgroundColor: COLORS[i] }}
              initial={{ width: 0 }}
              animate={{ width: `${(stage.count / pipeline.total) * 100}%` }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: i * 0.04 }}
            />
          ) : null
        )}
      </div>

      <ul className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-5">
        {pipeline.stages.map((stage, i) => (
          <li key={stage.status} className={stage.count === 0 ? "opacity-50" : undefined}>
            <div className="flex items-center gap-1.5 text-xs text-muted">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS[i] }} aria-hidden />
              {stage.label}
            </div>
            <div className="tabular mt-0.5 text-lg font-semibold text-primary">{stage.count}</div>
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

    </div>
  );
}
