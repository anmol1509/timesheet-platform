"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import type { DeploymentStage } from "@/lib/deploymentPipeline";

const STAGE_STYLE = [
  { bar: "bg-[var(--border-strong)]", chip: "bg-surface-sunken text-secondary" },
  { bar: "bg-[var(--warning)]", chip: "bg-[var(--warning-soft)] text-[var(--warning)]" },
  { bar: "bg-[var(--info)]", chip: "bg-[var(--info-soft)] text-[var(--info)]" },
  { bar: "bg-[var(--success)]", chip: "bg-[var(--success-soft)] text-[var(--success)]" },
];

/**
 * Where the workforce sits, from "on the books" to "working a shift" — a
 * horizontal funnel: each stage is a full-width bar sized against the
 * largest stage, so the shape of the pipeline (where people are piling up)
 * reads at a glance instead of four same-size tiles with no signal.
 */
export function DeploymentPipelineFunnel({ stages }: { stages: DeploymentStage[] }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const total = stages.reduce((n, s) => n + s.count, 0);
  const max = Math.max(...stages.map((s) => s.count), 1);

  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
        <p className="text-sm font-medium text-primary">No workforce on record yet</p>
        <p className="mt-1 text-xs text-muted">Stages fill in as employees are added and mobilised.</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {stages.map((s, i) => {
        const style = STAGE_STYLE[i % STAGE_STYLE.length];
        const widthPct = Math.max(6, (s.count / max) * 100);
        const sharePct = total > 0 ? Math.round((s.count / total) * 100) : 0;
        return (
          <Link
            key={s.key}
            href="/employees"
            onMouseEnter={() => setHovered(s.key)}
            onMouseLeave={() => setHovered(null)}
            className="group flex items-center gap-3 rounded-lg px-1.5 py-2.5 transition hover:bg-surface-subtle"
          >
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] text-xs font-semibold tabular-nums ${style.chip}`}>
              {s.count}
            </span>
            <div className="min-w-0 flex-1">
              <div className="mb-1.5 flex items-baseline justify-between gap-2">
                <span className="truncate text-[13px] font-medium text-secondary">{s.label}</span>
                <span className="tabular shrink-0 text-xs text-subtle">{sharePct}%</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-surface-sunken">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${style.bar} ${hovered === s.key ? "brightness-110" : ""}`}
                  style={{ width: `${widthPct}%` }}
                />
              </div>
            </div>
            <ArrowRight className="h-3.5 w-3.5 shrink-0 text-subtle opacity-0 transition group-hover:opacity-100" aria-hidden />
          </Link>
        );
      })}
      <p className="pt-2 text-center text-xs text-subtle">
        <span className="tabular font-medium text-secondary">{total}</span> total across the pipeline
      </p>
    </div>
  );
}
