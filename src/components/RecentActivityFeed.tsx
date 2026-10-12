import { FileText, UserPlus2, Clock3, Receipt, AlertTriangle, ListChecks } from "lucide-react";
import { activityLabel, type RecentActivityRow } from "@/lib/recentActivity";

const ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  EMPLOYEE: UserPlus2,
  TIMESHEET_ENTRY: Clock3,
  ATTENDANCE: Clock3,
  CLIENT_INVOICE: Receipt,
  SUPPLIER_BILL: Receipt,
  EXPENSE: Receipt,
  DOCUMENT: FileText,
  DEMAND_REQUEST: ListChecks,
};

function timeAgo(date: Date) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(date).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}

export function RecentActivityFeed({ rows }: { rows: RecentActivityRow[] }) {
  if (rows.length === 0) {
    return <p className="px-1 py-6 text-center text-sm text-muted">No activity recorded yet.</p>;
  }
  return (
    <ul className="space-y-1">
      {rows.map((row) => {
        const Icon = ICON[row.entityType] ?? AlertTriangle;
        return (
          <li key={row.id} className="flex items-start gap-3 rounded-control px-1 py-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-sunken text-secondary">
              <Icon className="h-3.5 w-3.5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-primary">{activityLabel(row)}</span>
              <span className="block truncate text-xs text-muted">{row.userName}</span>
            </span>
            <span className="shrink-0 text-xs text-subtle">{timeAgo(row.createdAt)}</span>
          </li>
        );
      })}
    </ul>
  );
}
