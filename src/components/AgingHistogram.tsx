const BUCKETS = [
  { label: "0–3 days", max: 3, tone: "bg-[var(--success)]" },
  { label: "4–7 days", max: 7, tone: "bg-[var(--info)]" },
  { label: "8–14 days", max: 14, tone: "bg-[var(--warning)]" },
  { label: "15+ days", max: Infinity, tone: "bg-[var(--error)]" },
];

/** How long a queue of items has been waiting — bucketed by age so a pile-up
 * of old items is visible at a glance instead of buried in a sorted list. */
export function AgingHistogram({ ageDays, emptyMessage = "Nothing waiting." }: { ageDays: number[]; emptyMessage?: string }) {
  if (ageDays.length === 0) return <p className="text-sm text-muted">{emptyMessage}</p>;
  const counts = BUCKETS.map((b, i) => {
    const min = i === 0 ? -Infinity : BUCKETS[i - 1].max + 1;
    return ageDays.filter((d) => d > min - 1 && d <= b.max).length;
  });
  const max = Math.max(...counts, 1);
  return (
    <div className="flex h-32 items-end gap-4">
      {BUCKETS.map((b, i) => (
        <div key={b.label} className="flex flex-1 flex-col items-center gap-1.5">
          {counts[i] > 0 && <span className="tabular text-xs font-semibold text-primary">{counts[i]}</span>}
          <span className={`w-full max-w-14 rounded-t-[4px] ${b.tone}`} style={{ height: `${Math.max(counts[i] > 0 ? 6 : 2, (counts[i] / max) * 88)}px` }} />
          <span className="text-center text-[11px] text-subtle">{b.label}</span>
        </div>
      ))}
    </div>
  );
}
