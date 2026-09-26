import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { DeploymentStage } from "@/lib/deploymentPipeline";

const COLORS = [
  "bg-[var(--surface-sunken)] text-secondary",
  "bg-[var(--warning-soft)] text-[var(--warning-text,#92400e)]",
  "bg-[var(--info-soft,#dbeafe)] text-[var(--info-text,#1e40af)]",
  "bg-[var(--success-soft)] text-[var(--success-text,#067647)]",
];

/** Where the workforce sits, from "on the books" to "working a shift". */
export function DeploymentPipelineFunnel({ stages }: { stages: DeploymentStage[] }) {
  return (
    <div className="flex flex-wrap items-stretch gap-2">
      {stages.map((s, i) => (
        <div key={s.key} className="flex flex-1 items-stretch gap-2">
          <Link
            href="/employees"
            className="flex min-w-32 flex-1 flex-col items-center justify-center gap-1 rounded-card border border-default px-4 py-4 text-center transition hover:border-strong hover:shadow-sm"
          >
            <span className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold tabular-nums ${COLORS[i]}`}>
              {s.count}
            </span>
            <span className="text-xs font-medium text-secondary">{s.label}</span>
          </Link>
          {i < stages.length - 1 && (
            <span className="flex items-center text-subtle">
              <ChevronRight className="h-4 w-4" aria-hidden />
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
