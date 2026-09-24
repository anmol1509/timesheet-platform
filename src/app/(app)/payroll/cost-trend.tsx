const aed = (n: number) => n.toLocaleString("en-AE", { maximumFractionDigits: 0 });

/**
 * Net payroll cost by month (latest 12, oldest first) with the change on the
 * previous run and the cost per head. Server-rendered bars; nothing to hydrate.
 */
export function CostTrend({ runs }: { runs: { month: string; total: number; headcount: number }[] }) {
  const recent = runs.slice(0, 12).reverse();
  const max = Math.max(1, ...recent.map((r) => r.total));
  const last = recent[recent.length - 1];
  const prev = recent[recent.length - 2];
  const delta = prev && prev.total > 0 ? Math.round(((last.total - prev.total) / prev.total) * 100) : null;
  const perHead = last.headcount > 0 ? last.total / last.headcount : 0;

  return (
    <section className="card p-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[13px] font-medium text-muted">Net payroll — {last.month}</p>
          <p className="tabular mt-1 text-3xl font-semibold tracking-tight text-primary">AED {aed(last.total)}</p>
          <p className="mt-1 text-xs text-subtle">
            {delta !== null && (
              <span className={delta > 0 ? "font-medium text-[var(--warning)]" : "font-medium text-[var(--success)]"}>
                {delta > 0 ? "▲" : delta < 0 ? "▼" : "–"} {Math.abs(delta)}%
              </span>
            )}
            {delta !== null && " on the previous run · "}
            {last.headcount} paid · AED {aed(perHead)} per head
          </p>
        </div>
        <div className="flex h-20 items-end gap-1.5" aria-label="Net payroll by month">
          {recent.map((r, i) => (
            <div key={r.month} className="flex w-6 flex-col items-center gap-1" title={`${r.month}: AED ${aed(r.total)}`}>
              <span
                className={`w-full rounded-t-[3px] ${i === recent.length - 1 ? "bg-[var(--brand-primary)]" : "bg-[var(--brand-primary)]/30"}`}
                style={{ height: `${Math.max(4, (r.total / max) * 60)}px` }}
              />
              <span className="text-[10px] text-subtle">{r.month.slice(5)}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
