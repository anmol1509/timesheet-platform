"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge } from "@/components/Badge";
import type { ComplianceStatus } from "@/lib/compliance";

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

  return (
    <div className="space-y-4">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search employees by name, ID, or trade…"
        className="w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-900"
      />

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
            {filtered.map((e) => {
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
      </div>
    </div>
  );
}
