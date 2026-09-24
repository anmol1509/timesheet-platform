import { cn } from "@/lib/cn";

type Tone = "success" | "warning" | "danger" | "brand" | "neutral";

const BAR: Record<Tone, string> = {
  success: "bg-[var(--success)]",
  warning: "bg-[var(--warning)]",
  danger: "bg-[var(--error)]",
  brand: "bg-[var(--brand-primary)]",
  neutral: "bg-[var(--border-strong)]",
};

/** Maps a raw status string onto the palette so every dashboard colours the same word the same way. */
export function toneForStatus(status: string): Tone {
  const s = status.toUpperCase();
  if (
    [
      "PAID",
      "ACTIVE",
      "CONVERTED",
      "APPROVED",
      "CLIENT_APPROVED",
      "COMPLETED",
    ].includes(s)
  )
    return "success";
  if (
    [
      "SENT",
      "NEGOTIATION",
      "MAINTENANCE",
      "ON_HOLD",
      "PENDING",
      "UNDER_REVIEW",
    ].includes(s)
  )
    return "warning";
  if (
    [
      "OVERDUE",
      "REJECTED",
      "BLACKLISTED",
      "EXPIRED",
      "LOST",
      "CANCELLED",
    ].includes(s)
  )
    return "danger";
  if (["OPEN", "SUBMITTED", "LOCKED"].includes(s)) return "brand";
  return "neutral";
}

function pretty(status: string) {
  const t = status.replace(/_/g, " ").toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/**
 * Total + one segmented bar + a legend, the same shape as the timesheet
 * pipeline. Replaces the "badge … number" lists, which said what the counts
 * were but not how they related to each other.
 */
export function StatusBreakdown({
  items,
  unit = "total",
  emptyMessage = "Nothing here yet.",
}: {
  items: { status: string; count: number }[];
  unit?: string;
  emptyMessage?: string;
}) {
  const total = items.reduce((s, i) => s + i.count, 0);
  if (total === 0) return <p className="text-sm text-muted">{emptyMessage}</p>;

  return (
    <div className="space-y-4">
      <div>
        <span className="tabular text-3xl font-semibold tracking-tight text-primary">
          {total}
        </span>
        <span className="ml-2 text-sm text-muted">{unit}</span>
      </div>
      <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-[var(--surface-sunken)]">
        {items.map((i) =>
          i.count > 0 ? (
            <span
              key={i.status}
              title={`${pretty(i.status)}: ${i.count}`}
              className={cn(
                "h-full first:rounded-l-full last:rounded-r-full",
                BAR[toneForStatus(i.status)],
              )}
              style={{ width: `${(i.count / total) * 100}%` }}
            />
          ) : null,
        )}
      </div>
      <ul className="grid grid-cols-2 gap-x-6 gap-y-2">
        {items.map((i) => (
          <li
            key={i.status}
            className="flex items-center justify-between gap-2 text-sm"
          >
            <span className="flex items-center gap-2 text-muted">
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  BAR[toneForStatus(i.status)],
                )}
                aria-hidden
              />
              {pretty(i.status)}
            </span>
            <span className="tabular font-semibold text-primary">
              {i.count}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
