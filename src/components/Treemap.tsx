"use client";

import { squarify } from "@/lib/squarify";

export type TreemapItem = { key: string; label: string; value: number };

const LOGICAL_W = 1000;
const LOGICAL_H = 480;

/** Sequential brand-hue fill by magnitude — box AREA already carries the
 * count, so color is a light secondary cue, not the identity channel (that's
 * the direct label). One hue, more-is-darker, same rule as everywhere else. */
function fillFor(ratio: number) {
  const pct = Math.round(28 + ratio * 62); // 28%..90% of the way from surface to brand-primary
  return `color-mix(in oklab, var(--brand-primary) ${pct}%, var(--surface-sunken))`;
}

/**
 * Proportional-area breakdown for a category with too many members for a
 * ranked bar list to stay legible (e.g. nationality across 15+ countries) —
 * size reads at a glance, and the direct label carries identity so color
 * only needs to encode magnitude.
 */
export function Treemap({ items, emptyLabel = "No data yet." }: { items: TreemapItem[]; emptyLabel?: string }) {
  const total = items.reduce((s, i) => s + i.value, 0);
  if (total === 0) return <p className="py-6 text-center text-sm text-muted">{emptyLabel}</p>;

  const rects = squarify(items, LOGICAL_W, LOGICAL_H);
  const max = Math.max(...items.map((i) => i.value), 1);

  return (
    <div className="relative w-full" style={{ aspectRatio: `${LOGICAL_W} / ${LOGICAL_H}` }}>
      {rects.map((r) => {
        const pctW = (r.w / LOGICAL_W) * 100;
        const pctH = (r.h / LOGICAL_H) * 100;
        const ratio = r.value / max;
        const canLabel = r.w > 70 && r.h > 30;
        const canShare = r.w > 70 && r.h > 46;
        return (
          <div
            key={r.key}
            className="group absolute rounded-[3px]"
            style={{
              left: `${(r.x / LOGICAL_W) * 100}%`,
              top: `${(r.y / LOGICAL_H) * 100}%`,
              width: `${pctW}%`,
              height: `${pctH}%`,
              padding: "1px",
            }}
          >
            <div
              className="flex h-full w-full flex-col justify-center overflow-hidden rounded-[3px] px-2 py-1 transition-[filter] duration-150 group-hover:brightness-110"
              style={{ background: fillFor(ratio) }}
            >
              {canLabel && (
                <>
                  <span className={`truncate text-[11px] leading-tight font-medium ${ratio > 0.45 ? "text-white" : "text-primary"}`}>
                    {r.label}
                  </span>
                  {canShare && (
                    <span className={`tabular truncate text-[10px] leading-tight ${ratio > 0.45 ? "text-white/80" : "text-secondary"}`}>
                      {r.value} · {Math.round((r.value / total) * 100)}%
                    </span>
                  )}
                </>
              )}
            </div>
            {/* Native tooltip covers the boxes too small for an inline label. */}
            <span className="sr-only">
              {r.label}: {r.value} ({Math.round((r.value / total) * 100)}%)
            </span>
            <div
              className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 hidden -translate-x-1/2 rounded-lg bg-[var(--tooltip-bg)] px-2.5 py-1.5 text-[11px] whitespace-nowrap text-[var(--tooltip-text)] shadow-lg group-hover:block"
              aria-hidden
            >
              <p className="font-semibold">{r.label}</p>
              <p className="tabular opacity-90">
                {r.value} · {Math.round((r.value / total) * 100)}%
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
