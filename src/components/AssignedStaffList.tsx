import Link from "next/link";
import { Badge } from "@/components/Badge";
import { EmployeeAvatar } from "@/components/Avatar";
import type { AssignedStaffRow } from "@/lib/assignedStaff";

const STATUS_BADGE = {
  valid: { label: "Compliant", color: "green" as const },
  expiring: { label: "Expiring soon", color: "amber" as const },
  expired: { label: "Expired", color: "red" as const },
  not_set: { label: "No records", color: "slate" as const },
};

export function AssignedStaffList({ staff }: { staff: AssignedStaffRow[] }) {
  if (staff.length === 0) {
    return (
      <p className="text-sm text-muted">
        No employees currently assigned to a project.
      </p>
    );
  }

  return (
    <div className="space-y-1">
      {staff.map((s) => {
        const badge = STATUS_BADGE[s.status];
        return (
          <Link
            key={s.id}
            href={`/employees/${s.id}`}
            className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-1.5 transition hover:bg-surface-hover"
          >
<EmployeeAvatar employeeId={s.id} name={s.name} hasPhoto={s.hasPhoto} size="md" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-primary">{s.name}</p>
              <p className="truncate text-xs text-muted">
                Working on{" "}
                <span className="font-medium text-secondary">{s.projectName}</span>
              </p>
            </div>
            <Badge color={badge.color}>{badge.label}</Badge>
          </Link>
        );
      })}
    </div>
  );
}
