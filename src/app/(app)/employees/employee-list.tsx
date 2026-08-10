"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Pencil } from "lucide-react";
import { Badge } from "@/components/Badge";
import { Pagination } from "@/components/Pagination";
import { CsvImportDialog } from "@/components/CsvImportDialog";
import { SegmentedControl } from "@/components/ui/RadioGroup";
import { Checkbox } from "@/components/ui/Checkbox";
import { toCsv, downloadCsv } from "@/lib/csv";
import { complianceRowClass, type ComplianceStatus } from "@/lib/compliance";
import { useRowSelection } from "@/lib/useRowSelection";
import { bulkImportEmployeesAction } from "./[id]/actions";

const PAGE_SIZE = 25;

type EmployeeRow = {
  id: string;
  employeeIdNo: string;
  name: string;
  category: "STAFF" | "SITE_STAFF";
  trade: string | null;
  passportNumber: string | null;
  emiratesId: string | null;
  nationality: string | null;
  companyDisplayName: string | null;
  onWork: boolean;
  status: "ACTIVE" | "IDLE" | "ON_VACATION" | "TERMINATED";
  worstStatus: ComplianceStatus;
  complete: boolean;
};

type Filter =
  | "all"
  | "on-work"
  | "bench"
  | "site-staff"
  | "staff"
  | "supplier-labour"
  | "idle"
  | "vacation"
  | "incomplete";

const CATEGORY_FILTER_LABEL: Partial<Record<Filter, string>> = {
  "site-staff": "Site Staff",
  staff: "Staff",
  "supplier-labour": "Supplier Labour",
  idle: "Idle",
  vacation: "On Vacation",
  incomplete: "Incomplete",
};

const SEGMENTED_VALUES: Filter[] = ["all", "on-work", "bench"];

const CATEGORY_LABEL: Record<EmployeeRow["category"], string> = {
  SITE_STAFF: "Site Staff",
  STAFF: "Staff",
};

const STATUS_BADGE: Record<ComplianceStatus, { label: string; color: "green" | "amber" | "red" | "slate" }> = {
  valid: { label: "Compliant", color: "green" },
  expiring: { label: "Expiring soon", color: "amber" },
  expired: { label: "Expired", color: "red" },
  not_set: { label: "No records", color: "slate" },
};

const IMPORT_COLUMNS = [
  { key: "employeeIdNo", label: "Employee ID No", required: true },
  { key: "name", label: "Full name", required: true },
  { key: "category", label: "Category" },
  { key: "trade", label: "Trade" },
  { key: "nationality", label: "Nationality" },
  { key: "position", label: "Position" },
  { key: "passportNumber", label: "Passport number" },
  { key: "emiratesId", label: "Emirates ID" },
  { key: "mobileNumber", label: "Mobile number" },
];

export function EmployeeList({
  employees,
  initialFilter,
}: {
  employees: EmployeeRow[];
  initialFilter?: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const validFilters: Filter[] = [
    "on-work",
    "bench",
    "site-staff",
    "staff",
    "supplier-labour",
    "idle",
    "vacation",
    "incomplete",
  ];
  const [filter, setFilter] = useState<Filter>(
    validFilters.includes(initialFilter as Filter) ? (initialFilter as Filter) : "all"
  );

  const byFilter = useMemo(() => {
    switch (filter) {
      case "on-work":
        return employees.filter((e) => e.onWork);
      case "bench":
        return employees.filter((e) => !e.onWork);
      case "site-staff":
        return employees.filter((e) => !e.companyDisplayName && e.category === "SITE_STAFF");
      case "staff":
        return employees.filter((e) => !e.companyDisplayName && e.category === "STAFF");
      case "supplier-labour":
        return employees.filter((e) => !!e.companyDisplayName);
      case "idle":
        return employees.filter((e) => e.status === "IDLE");
      case "vacation":
        return employees.filter((e) => e.status === "ON_VACATION");
      case "incomplete":
        return employees.filter((e) => !e.complete);
      default:
        return employees;
    }
  }, [employees, filter]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return byFilter;
    return byFilter.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.employeeIdNo.toLowerCase().includes(q) ||
        (e.trade || "").toLowerCase().includes(q) ||
        (e.companyDisplayName || "").toLowerCase().includes(q)
    );
  }, [byFilter, query]);

  useEffect(() => {
    setPage(1);
  }, [query, filter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const { selected, toggle, toggleAll, allSelected, clear } = useRowSelection(
    filtered.map((e) => e.id)
  );

  function exportCsv() {
    const rows = selected.size > 0 ? filtered.filter((e) => selected.has(e.id)) : filtered;
    const csv = toCsv(rows, [
      { header: "ID No", value: (e) => e.employeeIdNo },
      { header: "Employee", value: (e) => e.name },
      { header: "Category", value: (e) => CATEGORY_LABEL[e.category] },
      { header: "Trade", value: (e) => e.trade },
      { header: "Passport No", value: (e) => e.passportNumber },
      { header: "Emirates ID", value: (e) => e.emiratesId },
      { header: "Nationality", value: (e) => e.nationality },
      { header: "Company", value: (e) => e.companyDisplayName },
      { header: "Compliance", value: (e) => STATUS_BADGE[e.worstStatus].label },
      { header: "Profile", value: (e) => (e.complete ? "Complete" : "Incomplete") },
    ]);
    downloadCsv(`employees-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search employees by name, ID, or trade…"
            className="w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-[var(--brand-primary)]"
          />
          <SegmentedControl
            value={SEGMENTED_VALUES.includes(filter) ? filter : "all"}
            onChange={(f) => {
              const next = f as Filter;
              setFilter(next);
              router.replace(next === "all" ? "/employees" : `/employees?filter=${next}`);
            }}
            options={[
              { value: "all", label: "All" },
              { value: "on-work", label: "On work" },
              { value: "bench", label: "Bench" },
            ]}
          />
          {CATEGORY_FILTER_LABEL[filter] && (
            <div className="flex items-center gap-1.5 rounded-full bg-[var(--brand-primary-soft)] py-1 pr-1 pl-3 text-xs font-medium text-[var(--brand-primary)]">
              {CATEGORY_FILTER_LABEL[filter]}
              <button
                type="button"
                onClick={() => {
                  setFilter("all");
                  router.replace("/employees");
                }}
                className="rounded-full px-1.5 py-0.5 hover:bg-white/60"
              >
                ✕
              </button>
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <CsvImportDialog
            entityLabel="employees"
            columns={IMPORT_COLUMNS}
            importAction={bulkImportEmployeesAction}
            onDone={() => router.refresh()}
          />
          <button
            type="button"
            onClick={exportCsv}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            <Download className="h-4 w-4" />
            {selected.size > 0 ? `Export selected (${selected.size})` : "Export CSV"}
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium tracking-wide text-slate-500 uppercase">
            <tr>
              <th className="w-10 px-4 py-3">
                <Checkbox checked={allSelected} onCheckedChange={() => toggleAll()} />
              </th>
              <th className="px-4 py-3">ID No</th>
              <th className="px-4 py-3">Employee</th>
              <th className="px-4 py-3">Trade</th>
              <th className="px-4 py-3">Passport No</th>
              <th className="px-4 py-3">Emirates ID</th>
              <th className="px-4 py-3">Nationality</th>
              <th className="px-4 py-3">Company</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Profile</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {pageRows.map((e) => {
              const badge = STATUS_BADGE[e.worstStatus];
              return (
                <tr key={e.id} className={complianceRowClass(e.worstStatus)}>
                  <td className="px-4 py-3">
                    <Checkbox checked={selected.has(e.id)} onCheckedChange={() => toggle(e.id)} />
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    <Link href={`/employees/${e.id}`} className="block">
                      {e.employeeIdNo}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/employees/${e.id}`} className="block">
                      <span className="font-medium text-slate-900">{e.name}</span>
                      <span className="ml-2 inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                        {CATEGORY_LABEL[e.category]}
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{e.trade || "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{e.passportNumber || "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{e.emiratesId || "—"}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {e.nationality || "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {e.companyDisplayName || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge color={badge.color}>{badge.label}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge color={e.complete ? "green" : "amber"}>
                      {e.complete ? "Complete" : "Incomplete"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/employees/${e.id}`}
                      className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
                    >
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="px-4 py-10 text-center text-sm text-slate-500">
            {query
              ? <>No employees match &ldquo;{query}&rdquo;.</>
              : "No employees match this filter."}
          </p>
        )}
        <Pagination
          page={page}
          pageCount={pageCount}
          onPageChange={setPage}
          totalItems={filtered.length}
          pageSize={PAGE_SIZE}
        />
      </div>
      {selected.size > 0 && (
        <button
          type="button"
          onClick={clear}
          className="text-xs font-medium text-slate-500 hover:underline"
        >
          Clear selection ({selected.size})
        </button>
      )}
    </div>
  );
}
