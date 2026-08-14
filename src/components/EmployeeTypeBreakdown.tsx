import Link from "next/link";
import type { EmployeeTypeCounts } from "@/lib/employeeTypeCounts";

const ROWS: { key: keyof EmployeeTypeCounts; label: string; color: string; filter: string }[] = [
  { key: "siteStaff", label: "Site Staff", color: "bg-blue-500", filter: "site-staff" },
  { key: "officeStaff", label: "Staff", color: "bg-slate-400", filter: "staff" },
  { key: "supplierLabour", label: "Supplier Labour", color: "bg-emerald-500", filter: "supplier-labour" },
  { key: "idle", label: "Idle", color: "bg-amber-500", filter: "idle" },
  { key: "onVacation", label: "Vacation", color: "bg-violet-500", filter: "vacation" },
];

export function EmployeeTypeBreakdown({ counts }: { counts: EmployeeTypeCounts }) {
  const total = counts.siteStaff + counts.officeStaff + counts.supplierLabour;
  return (
    <div className="space-y-2.5">
      {ROWS.map((r) => {
        const value = counts[r.key];
        const pct = total > 0 ? Math.round((value / total) * 100) : 0;
        return (
          <Link
            key={r.key}
            href={`/employees?filter=${r.filter}`}
            className="flex items-center gap-3 rounded-lg text-sm transition hover:bg-surface-hover"
          >
            <span className="w-28 shrink-0 text-muted">{r.label}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-sunken">
              <div className={`h-full ${r.color}`} style={{ width: `${pct}%` }} />
            </div>
            <span className="w-10 shrink-0 text-right font-medium text-primary">
              {value}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
