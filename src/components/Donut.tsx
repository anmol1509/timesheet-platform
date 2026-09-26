"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { CountUp } from "./CountUp";
import { toneForStatus } from "./StatusBreakdown";

const TONE_STROKE: Record<string, string> = {
  success: "var(--success)",
  warning: "var(--warning)",
  danger: "var(--error)",
  brand: "var(--brand-primary)",
  neutral: "var(--border-strong)",
};

// Fixed rotation for categorical (non-status) slices — cycles through the
// app's existing semantic tokens rather than inventing new hues, so a
// "by source"/"by category" donut still reads as a family with the rest of
// the design system instead of introducing its own palette.
const CATEGORY_STROKE = ["var(--brand-primary)", "var(--info)", "var(--success)", "var(--warning)", "var(--error)", "var(--border-strong)"];

function pretty(label: string) {
  const t = label.replace(/_/g, " ").toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

type Slice = { key: string; label: string; count: number; stroke: string };

function Rings({ slices, total, hovered, onHover }: { slices: Slice[]; total: number; hovered: string | null; onHover: (k: string | null) => void }) {
  const radius = 60;
  const stroke = 22;
  const circumference = 2 * Math.PI * radius;
  const lengths = slices.map((s) => (s.count / total) * circumference);
  const offsets = lengths.reduce<number[]>((acc, len, i) => {
    acc.push(i === 0 ? 0 : acc[i - 1] + lengths[i - 1]);
    return acc;
  }, []);
  const [swept, setSwept] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setSwept(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div className="relative h-[152px] w-[152px] shrink-0">
      <svg width="152" height="152" viewBox="0 0 152 152">
        <circle cx="76" cy="76" r={radius} fill="none" stroke="var(--surface-sunken)" strokeWidth={stroke} />
        {slices.map((s, i) => {
          const len = lengths[i];
          const dash = swept ? `${Math.max(0, len - 1.5)} ${circumference - len + 1.5}` : `0 ${circumference}`;
          const isHovered = hovered === s.key;
          const isDimmed = hovered !== null && !isHovered;
          return (
            <circle
              key={s.key}
              cx="76"
              cy="76"
              r={radius}
              fill="none"
              stroke={s.stroke}
              strokeWidth={isHovered ? stroke + 4 : stroke}
              strokeOpacity={isDimmed ? 0.35 : 1}
              strokeDasharray={dash}
              strokeDashoffset={-offsets[i]}
              strokeLinecap="round"
              transform="rotate(-90 76 76)"
              className="cursor-pointer transition-[stroke-dasharray,stroke-width,stroke-opacity] duration-700 ease-out"
              style={{ transitionDelay: swept ? "0ms" : `${i * 90}ms` }}
              onMouseEnter={() => onHover(s.key)}
              onMouseLeave={() => onHover(null)}
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <CountUp value={total} className="tabular text-2xl font-semibold text-primary" />
        <p className="text-xs text-muted">total</p>
      </div>
    </div>
  );
}

function Legend({ slices, total, hovered, onHover }: { slices: Slice[]; total: number; hovered: string | null; onHover: (k: string | null) => void }) {
  return (
    <ul className="min-w-0 flex-1 space-y-1">
      {slices.map((s) => (
        <li key={s.key}>
          <div
            onMouseEnter={() => onHover(s.key)}
            onMouseLeave={() => onHover(null)}
            className={cn(
              "-mx-2 flex cursor-default items-center justify-between gap-3 rounded-lg px-2 py-1 text-sm transition",
              hovered === s.key ? "bg-surface-hover" : "",
            )}
          >
            <span className="flex min-w-0 items-center gap-2 text-muted">
              <span className="h-2 w-2 shrink-0 rounded-full transition-transform" style={{ background: s.stroke, transform: hovered === s.key ? "scale(1.3)" : "scale(1)" }} aria-hidden />
              <span className="truncate">{s.label}</span>
            </span>
            <span className="tabular shrink-0 font-semibold text-primary">
              {s.count}
              <span className="ml-1.5 text-xs font-normal text-subtle">{Math.round((s.count / total) * 100)}%</span>
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

function DonutBody({ slices, total }: { slices: Slice[]; total: number }) {
  const [hovered, setHovered] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-6">
      <Rings slices={slices} total={total} hovered={hovered} onHover={setHovered} />
      <Legend slices={slices} total={total} hovered={hovered} onHover={setHovered} />
    </div>
  );
}

/** A donut for a status mix — same semantic colours as StatusBreakdown, just a ring instead of a segmented bar, so composition ("what share is what") reads at a glance. */
export function StatusDonut({
  items,
  emptyMessage = "Nothing here yet.",
}: {
  items: { status: string; count: number }[];
  emptyMessage?: string;
}) {
  const total = items.reduce((s, i) => s + i.count, 0);
  if (total === 0) return <p className="text-sm text-muted">{emptyMessage}</p>;
  const slices: Slice[] = items
    .filter((i) => i.count > 0)
    .map((i) => ({ key: i.status, label: pretty(i.status), count: i.count, stroke: TONE_STROKE[toneForStatus(i.status)] }));
  return <DonutBody slices={slices} total={total} />;
}

/** A donut for a plain categorical breakdown (source, category…) with no
 * inherent status/severity — colours cycle through the app's palette instead
 * of being semantically assigned. */
export function CategoryDonut({
  items,
  emptyMessage = "Nothing here yet.",
}: {
  items: { key: string; label: string; count: number }[];
  emptyMessage?: string;
}) {
  const total = items.reduce((s, i) => s + i.count, 0);
  if (total === 0) return <p className="text-sm text-muted">{emptyMessage}</p>;
  const slices: Slice[] = items
    .filter((i) => i.count > 0)
    .map((i, idx) => ({ key: i.key, label: i.label, count: i.count, stroke: CATEGORY_STROKE[idx % CATEGORY_STROKE.length] }));
  return <DonutBody slices={slices} total={total} />;
}
