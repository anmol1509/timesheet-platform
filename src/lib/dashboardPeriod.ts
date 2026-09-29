// The time window a dashboard section looks at, chosen with the period picker
// and kept in the URL (?period=…) so a view can be bookmarked or shared.

export type PeriodKey = "this-month" | "last-month" | "30d" | "90d";

export const PERIOD_OPTIONS: { value: PeriodKey; label: string }[] = [
  { value: "this-month", label: "This month" },
  { value: "last-month", label: "Last month" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
];

export type Period = { key: PeriodKey; label: string; from: Date; to: Date };

const DAY = 86_400_000;

export function resolvePeriod(param: string | undefined, fallback: PeriodKey = "this-month", now = new Date()): Period {
  const key = (PERIOD_OPTIONS.some((o) => o.value === param) ? param : fallback) as PeriodKey;
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const label = PERIOD_OPTIONS.find((o) => o.value === key)!.label;
  switch (key) {
    case "last-month":
      return { key, label, from: new Date(Date.UTC(y, m - 1, 1)), to: new Date(Date.UTC(y, m, 1)) };
    case "30d":
      return { key, label, from: new Date(now.getTime() - 30 * DAY), to: now };
    case "90d":
      return { key, label, from: new Date(now.getTime() - 90 * DAY), to: now };
    default:
      return { key, label, from: new Date(Date.UTC(y, m, 1)), to: new Date(Date.UTC(y, m + 1, 1)) };
  }
}

/** The last `count` calendar months (newest first) as YYYY-MM keys with readable labels. */
export function recentMonths(count = 12, now = new Date()): { value: string; label: string }[] {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    return {
      value: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }),
    };
  });
}
