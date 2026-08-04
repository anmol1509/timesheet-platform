import type { EmployeeTypeCounts } from "@/lib/employeeTypeCounts";

const ROWS: { key: keyof EmployeeTypeCounts; label: string; color: string }[] = [
  { key: "siteStaff", label: "Site Staff", color: "bg-blue-500" },
  { key: "officeStaff", label: "Staff", color: "bg-slate-400" },
  { key: "supplierLabour", label: "Supplier Labour", color: "bg-emerald-500" },
  { key: "idle", label: "Idle", color: "bg-amber-500" },
  { key: "onVacation", label: "Vacation", color: "bg-violet-500" },
];

export function EmployeeTypeBreakdown({ counts }: { counts: EmployeeTypeCounts }) {
  const total = counts.siteStaff + counts.officeStaff + counts.supplierLabour;
  return (
    <div className="space-y-2.5">
      {ROWS.map((r) => {
        const value = counts[r.key];
        const pct = total > 0 ? Math.round((value / total) * 100) : 0;
        return (
          <div key={r.key} className="flex items-center gap-3 text-sm">
            <span className="w-28 shrink-0 text-slate-500">{r.label}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
              <div className={`h-full ${r.color}`} style={{ width: `${pct}%` }} />
            </div>
            <span className="w-10 shrink-0 text-right font-medium text-slate-900">
              {value}
            </span>
          </div>
        );
      })}
    </div>
  );
}
