"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { Printer } from "lucide-react";
import { Select } from "@/components/ui/Select";

type EmployeeOption = { id: string; employeeIdNo: string; name: string; roster: string };

/**
 * "All" leads and is the default. The category used to default to Site Staff
 * and silently filter the picker, so searching a supplier's worker by name
 * returned "No results" for someone who plainly exists — and most of this
 * roster is supplier labour.
 */
const CATEGORIES = [
  { value: "ALL", label: "All" },
  { value: "SITE_STAFF", label: "Site Staff" },
  { value: "STAFF", label: "Staff" },
  { value: "SUPPLIER_LABOUR", label: "Supplier Workers" },
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
  const card = useRef<HTMLDivElement>(null);
  const categoryLabel =
    CATEGORIES.find((c) => c.value === category)?.label ?? "this category";

  return (
    // Focusing the search brings the card to the top first, so the list opens under it rather than from wherever the
    // page was scrolled to.
    <div
      ref={card}
      onFocusCapture={(e) => {
        if (e.target instanceof HTMLElement && e.target.closest("[data-picker-search]")) card.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }}
      className="card scroll-mt-24 p-5 print:hidden"
    >
      <div className="flex flex-wrap items-end gap-4">
        <fieldset className="flex flex-wrap gap-4">
          <legend className="mb-1 block text-xs font-medium text-muted">Show</legend>
          {CATEGORIES.map((c) => (
            <label
              key={c.value}
              className="flex items-center gap-1.5 text-sm text-secondary"
            >
              <input
                type="radio"
                name="category"
                // Without this the whole group announced as "radio on" — the
                // visible text isn't wired to the control for a screen reader.
                aria-label={c.label}
                checked={category === c.value}
                onChange={() => router.push(`/employees/instant-view?category=${c.value}`, { scroll: false })}
              />
              {c.label}
            </label>
          ))}
        </fieldset>

        <div className="min-w-[260px] flex-1" data-picker-search>
          <span className="mb-1 block text-xs font-medium text-muted">
            Employee ({employees.length})
          </span>
          <Select
            value={employeeId}
            onChange={(v) =>
              router.push(`/employees/instant-view?category=${category}&employeeId=${v}`, { scroll: false })
            }
            placeholder="Search by name or ID…"
            // Names the filter that's hiding people, rather than a bare "No
            // results" that reads as "this worker doesn't exist".
            emptyText={
              category === "ALL"
                ? "No employee matches."
                : `No match in ${categoryLabel}: try All.`
            }
            options={employees.map((e) => ({
              value: e.id,
              // In the mixed lists the roster is part of the label, so a site worker and an office colleague can be told apart.
              label: category === "ALL" ? `${e.employeeIdNo} · ${e.name} · ${e.roster}` : `${e.employeeIdNo} · ${e.name}`,
            }))}
          />
        </div>

        {employeeId && (
          <button type="button" onClick={() => window.print()} className="btn btn-secondary">
            <Printer className="h-3.5 w-3.5" aria-hidden />
            Print
          </button>
        )}
      </div>
    </div>
  );
}
