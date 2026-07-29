"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";
import { Badge } from "@/components/Badge";
import { Pagination } from "@/components/Pagination";
import { toCsv, downloadCsv } from "@/lib/csv";
import type { ComplianceStatus } from "@/lib/compliance";

const PAGE_SIZE = 25;

type EmployeeRow = {
  id: string;
  employeeIdNo: string;
  name: string;
  trade: string | null;
  nationality: string | null;
  supplierName: string | null;
  worstStatus: ComplianceStatus;
};

const STATUS_BADGE: Record<ComplianceStatus, { label: string; color: "green" | "amber" | "red" | "slate" }> = {
  valid: { label: "Compliant", color: "green" },
  expiring: { label: "Expiring soon", color: "amber" },
  expired: { label: "Expired", color: "red" },
  not_set: { label: "No records", color: "slate" },
};

export function EmployeeList({ employees }: { employees: EmployeeRow[] }) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.employeeIdNo.toLowerCase().includes(q) ||
        (e.trade || "").toLowerCase().includes(q) ||
        (e.supplierName || "").toLowerCase().includes(q)
    );
  }, [employees, query]);

  useEffect(() => {
    setPage(1);
  }, [query]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function exportCsv() {
    const csv = toCsv(filtered, [
      { header: "ID No", value: (e) => e.employeeIdNo },
      { header: "Employee", value: (e) => e.name },
      { header: "Trade", value: (e) => e.trade },
      { header: "Nationality", value: (e) => e.nationality },
      { header: "Company", value: (e) => e.supplierName },
      { header: "Compliance", value: (e) => STATUS_BADGE[e.worstStatus].label },
    ]);
    downloadCsv(`employees-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search employees by name, ID, or trade…"
          className="w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-900"
        />
        <button
          type="button"
          onClick={exportCsv}
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          <Download className="h-4 w-4" /> Export CSV
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium tracking-wide text-slate-500 uppercase">
            <tr>
              <th className="px-4 py-3">ID No</th>
              <th className="px-4 py-3">Employee</th>
              <th className="px-4 py-3">Trade</th>
              <th className="px-4 py-3">Nationality</th>
              <th className="px-4 py-3">Company</th>
              <th className="px-4 py-3">Compliance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {pageRows.map((e) => {
              const badge = STATUS_BADGE[e.worstStatus];
              return (
                <tr key={e.id} className="hover:bg-slate-50">
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
                  <td className="px-4 py-3">
                    <Badge color={badge.color}>{badge.label}</Badge>
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
    </div>
  );
}
