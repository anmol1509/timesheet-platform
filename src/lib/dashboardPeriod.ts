// The time window a dashboard section looks at, chosen with the period picker
// and kept in the URL (?period=…) so a view can be bookmarked or shared.

export type PeriodKey = "this-month" | "last-month" | "30d" | "90d" | "custom";

export const PERIOD_OPTIONS: { value: PeriodKey; label: string }[] = [
  { value: "this-month", label: "This month" },
  { value: "last-month", label: "Last month" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "custom", label: "Custom dates…" },
];

export type Period = { key: PeriodKey; label: string; from: Date; to: Date };

const DAY = 86_400_000;

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const shortLabel = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/**
 * `to` is exclusive (the start of the next day), so a range is `from <= x < to`.
 * A custom range needs two valid dates, in order, within a year; anything else
 * falls back to `fallback` rather than showing an empty page.
 */
export function resolvePeriod(
  param: string | undefined,
  fallback: Exclude<PeriodKey, "custom"> = "this-month",
  custom?: { from?: string; to?: string },
  now = new Date(),
): Period {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  if (param === "custom" && custom?.from && custom?.to && YMD.test(custom.from) && YMD.test(custom.to)) {
    const from = new Date(`${custom.from}T00:00:00.000Z`);
    const last = new Date(`${custom.to}T00:00:00.000Z`);
    if (!Number.isNaN(from.getTime()) && !Number.isNaN(last.getTime()) && from <= last && (last.getTime() - from.getTime()) / DAY <= 366) {
      const label = custom.from === custom.to ? shortLabel(from) : `${shortLabel(from)} – ${shortLabel(last)}`;
      return { key: "custom", label, from, to: new Date(last.getTime() + DAY) };
    }
  }
  const key = (PERIOD_OPTIONS.some((o) => o.value === param && o.value !== "custom") ? param : fallback) as Exclude<PeriodKey, "custom">;
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

/** YYYY-MM keys of every calendar month a period touches (oldest first). */
export function monthKeysIn(period: Period): string[] {
  const keys: string[] = [];
  const last = new Date(period.to.getTime() - 1);
  for (let d = new Date(Date.UTC(period.from.getUTCFullYear(), period.from.getUTCMonth(), 1)); d <= last; d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))) {
    keys.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return keys;
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
