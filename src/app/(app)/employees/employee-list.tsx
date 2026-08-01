"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Pencil } from "lucide-react";
import { Badge } from "@/components/Badge";
import { Pagination } from "@/components/Pagination";
import { CsvImportDialog } from "@/components/CsvImportDialog";
import { toCsv, downloadCsv } from "@/lib/csv";
import { complianceRowClass, type ComplianceStatus } from "@/lib/compliance";
import { useRowSelection } from "@/lib/useRowSelection";
import { bulkImportEmployeesAction } from "./[id]/actions";

const PAGE_SIZE = 25;

type EmployeeRow = {
  id: string;
  employeeIdNo: string;
  name: string;
  trade: string | null;
  nationality: string | null;
  supplierName: string | null;
  projectName: string | null;
  bedLabel: string | null;
  onWork: boolean;
  worstStatus: ComplianceStatus;
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
  const [filter, setFilter] = useState<"all" | "on-work" | "bench">(
    initialFilter === "on-work" || initialFilter === "bench" ? initialFilter : "all"
  );

  const byFilter = useMemo(() => {
    if (filter === "on-work") return employees.filter((e) => e.onWork);
    if (filter === "bench") return employees.filter((e) => !e.onWork);
    return employees;
  }, [employees, filter]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return byFilter;
    return byFilter.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.employeeIdNo.toLowerCase().includes(q) ||
        (e.trade || "").toLowerCase().includes(q) ||
        (e.supplierName || "").toLowerCase().includes(q)
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
      { header: "Trade", value: (e) => e.trade },
      { header: "Nationality", value: (e) => e.nationality },
      { header: "Company", value: (e) => e.supplierName },
      { header: "Project", value: (e) => e.projectName },
      { header: "Bed", value: (e) => e.bedLabel },
      { header: "Compliance", value: (e) => STATUS_BADGE[e.worstStatus].label },
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
            className="w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-900"
          />
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 text-sm">
            {(["all", "on-work", "bench"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => {
                  setFilter(f);
                  router.replace(f === "all" ? "/employees" : `/employees?filter=${f}`);
                }}
                className={`rounded-md px-3 py-1.5 font-medium transition ${
                  filter === f ? "bg-[#0B1642] text-white" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {f === "all" ? "All" : f === "on-work" ? "On work" : "Bench"}
              </button>
            ))}
          </div>
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

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium tracking-wide text-slate-500 uppercase">
            <tr>
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="h-4 w-4 rounded border-slate-300"
                />
              </th>
              <th className="px-4 py-3">ID No</th>
              <th className="px-4 py-3">Employee</th>
              <th className="px-4 py-3">Trade</th>
              <th className="px-4 py-3">Nationality</th>
              <th className="px-4 py-3">Company</th>
              <th className="px-4 py-3">Project</th>
              <th className="px-4 py-3">Bed No.</th>
              <th className="px-4 py-3">Compliance</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {pageRows.map((e) => {
              const badge = STATUS_BADGE[e.worstStatus];
              return (
                <tr key={e.id} className={complianceRowClass(e.worstStatus)}>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(e.id)}
                      onChange={() => toggle(e.id)}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    <Link href={`/employees/${e.id}`} className="block">
                      {e.employeeIdNo}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    <Link href={`/employees/${e.id}`} className="block">
                      {e.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{e.trade || "—"}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {e.nationality || "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {e.supplierName || "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{e.projectName || "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{e.bedLabel || "—"}</td>
                  <td className="px-4 py-3">
                    <Badge color={badge.color}>{badge.label}</Badge>
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
            No employees match &ldquo;{query}&rdquo;.
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
