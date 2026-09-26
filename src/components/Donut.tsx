import { cn } from "@/lib/cn";
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

function Rings({ slices, total }: { slices: Slice[]; total: number }) {
  const radius = 60;
  const stroke = 22;
  const circumference = 2 * Math.PI * radius;
  const lengths = slices.map((s) => (s.count / total) * circumference);
  const offsets = lengths.reduce<number[]>((acc, len, i) => {
    acc.push(i === 0 ? 0 : acc[i - 1] + lengths[i - 1]);
    return acc;
  }, []);
  return (
    <div className="relative h-[152px] w-[152px] shrink-0">
      <svg width="152" height="152" viewBox="0 0 152 152">
        <circle cx="76" cy="76" r={radius} fill="none" stroke="var(--surface-sunken)" strokeWidth={stroke} />
        {slices.map((s, i) => {
          const len = lengths[i];
          const dash = `${Math.max(0, len - 1.5)} ${circumference - len + 1.5}`;
          return (
            <circle
              key={s.key}
              cx="76"
              cy="76"
              r={radius}
              fill="none"
              stroke={s.stroke}
              strokeWidth={stroke}
              strokeDasharray={dash}
              strokeDashoffset={-offsets[i]}
              transform="rotate(-90 76 76)"
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className="tabular text-2xl font-semibold text-primary">{total}</p>
        <p className="text-xs text-muted">total</p>
      </div>
    </div>
  );
}

function Legend({ slices, total }: { slices: Slice[]; total: number }) {
  return (
    <ul className="min-w-0 flex-1 space-y-2">
      {slices.map((s) => (
        <li key={s.key} className="flex items-center justify-between gap-3 text-sm">
          <span className="flex min-w-0 items-center gap-2 text-muted">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.stroke }} aria-hidden />
            <span className="truncate">{s.label}</span>
          </span>
          <span className="tabular shrink-0 font-semibold text-primary">
            {s.count}
            <span className="ml-1.5 text-xs font-normal text-subtle">{Math.round((s.count / total) * 100)}%</span>
          </span>
        </li>
      ))}
    </ul>
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
  return (
    <div className={cn("flex flex-wrap items-center gap-6")}>
      <Rings slices={slices} total={total} />
      <Legend slices={slices} total={total} />
    </div>
  );
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
  return (
    <div className={cn("flex flex-wrap items-center gap-6")}>
      <Rings slices={slices} total={total} />
      <Legend slices={slices} total={total} />
    </div>
  );
}
