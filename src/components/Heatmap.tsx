"use client";

/** Sequential brand-hue fill by magnitude — same ramp/rule as Treemap. */
function fillFor(ratio: number) {
  if (ratio <= 0) return "var(--surface-sunken)";
  const pct = Math.round(20 + ratio * 70);
  return `color-mix(in oklab, var(--brand-primary) ${pct}%, var(--surface-sunken))`;
}

/**
 * Row × column count grid — for a magnitude that only makes sense read as a
 * cross-tab (e.g. document type × expiry status), where a bar list or donut
 * would have to pick one axis and lose the other.
 */
export function Heatmap({
  rows,
  cols,
  matrix,
  emptyLabel = "No data yet.",
}: {
  rows: string[];
  cols: string[];
  /** matrix[rowIndex][colIndex] = count */
  matrix: number[][];
  emptyLabel?: string;
}) {
  const max = Math.max(1, ...matrix.flat());
  const total = matrix.flat().reduce((s, n) => s + n, 0);
  if (total === 0 || rows.length === 0) return <p className="py-6 text-center text-sm text-muted">{emptyLabel}</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate text-xs" style={{ borderSpacing: "2px" }}>
        <thead>
          <tr>
            <th className="w-0" />
            {cols.map((c) => (
              <th key={c} className="px-1.5 pb-1.5 text-center font-medium text-subtle">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={r}>
              <th scope="row" className="max-w-32 truncate pr-2 text-left font-medium whitespace-nowrap text-secondary">
                {r}
              </th>
              {cols.map((c, ci) => {
                const value = matrix[ri]?.[ci] ?? 0;
                const ratio = value / max;
                return (
                  <td key={c} className="p-0">
                    <div
                      className="group relative flex h-9 w-full min-w-9 items-center justify-center rounded-[4px] transition-[filter] hover:brightness-110"
                      style={{ background: fillFor(ratio) }}
                    >
                      {value > 0 && (
                        <span className={`tabular text-[11px] font-medium ${ratio > 0.5 ? "text-white" : "text-primary"}`}>{value}</span>
                      )}
                      <div
                        className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 hidden -translate-x-1/2 rounded-lg bg-[var(--tooltip-bg)] px-2.5 py-1.5 text-[11px] whitespace-nowrap text-[var(--tooltip-text)] shadow-lg group-hover:block"
                        aria-hidden
                      >
                        <p className="font-semibold">
                          {r} · {c}
                        </p>
                        <p className="tabular opacity-90">{value}</p>
                      </div>
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
