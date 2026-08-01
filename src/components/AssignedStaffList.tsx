import Link from "next/link";
import { Badge } from "@/components/Badge";
import type { AssignedStaffRow } from "@/lib/assignedStaff";

const STATUS_BADGE = {
  valid: { label: "Compliant", color: "green" as const },
  expiring: { label: "Expiring soon", color: "amber" as const },
  expired: { label: "Expired", color: "red" as const },
  not_set: { label: "No records", color: "slate" as const },
};

const AVATAR_COLORS = [
  "from-rose-400 to-rose-600",
  "from-amber-400 to-amber-600",
  "from-sky-400 to-sky-600",
  "from-violet-400 to-violet-600",
];

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "?";
}

export function AssignedStaffList({ staff }: { staff: AssignedStaffRow[] }) {
  if (staff.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        No employees currently assigned to a project.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {staff.map((s, i) => {
        const badge = STATUS_BADGE[s.status];
        return (
          <Link
            key={s.id}
            href={`/employees/${s.id}`}
            className="flex items-center gap-3 hover:opacity-90"
          >
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-xs font-semibold text-white ${
                AVATAR_COLORS[i % AVATAR_COLORS.length]
              }`}
            >
              {initials(s.name)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-900">{s.name}</p>
              <p className="truncate text-xs text-slate-500">
                Working on{" "}
                <span className="font-medium text-slate-700">{s.projectName}</span>
              </p>
            </div>
            <Badge color={badge.color}>{badge.label}</Badge>
          </Link>
        );
      })}
    </div>
  );
}
