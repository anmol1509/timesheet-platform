"use client";

import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/Select";

type EmployeeOption = { id: string; employeeIdNo: string; name: string };

const CATEGORIES = [
  { value: "SITE_STAFF", label: "Site Staff" },
  { value: "STAFF", label: "Staff" },
  { value: "SUPPLIER_LABOUR", label: "Supplier Labour" },
];

export function InstantViewPicker({
  category,
  employeeId,
  employees,
}: {
  category: string;
  employeeId: string;
  employees: EmployeeOption[];
}) {
  const router = useRouter();

  return (
    <div className="card p-5">
      <h2 className="mb-3 text-sm font-semibold text-primary">Instant View</h2>
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex gap-4">
          {CATEGORIES.map((c) => (
            <label key={c.value} className="flex items-center gap-1.5 text-sm text-secondary">
              <input
                type="radio"
                name="category"
                checked={category === c.value}
                onChange={() => router.push(`/employees/instant-view?category=${c.value}`)}
              />
              {c.label}
            </label>
          ))}
        </div>
        <div className="min-w-[260px] flex-1">
          <span className="mb-1 block text-xs font-medium text-muted">Employee Selection</span>
          <Select
            value={employeeId}
            onChange={(v) =>
              router.push(`/employees/instant-view?category=${category}&employeeId=${v}`)
            }
            placeholder="Search employee…"
            options={employees.map((e) => ({ value: e.id, label: `${e.employeeIdNo} · ${e.name}` }))}
          />
        </div>
        {employeeId && (
          <button
            type="button"
            onClick={() => window.print()}
            className="btn btn-secondary print:hidden"
          >
            Print
          </button>
        )}
      </div>
    </div>
  );
}
