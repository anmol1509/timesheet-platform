"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CornerDownRight, Search } from "lucide-react";
import { Badge } from "@/components/Badge";

export type DocSummary = { missing: number; expired: number; expiring: number };
export type CompanyRow = { id: string; name: string; code: string | null; fullName: string | null; status: string; employees: number; people: number; own: DocSummary; owners: DocSummary; ownership: { owners: number; total: number; ok: boolean }; sub: boolean };

const attention = (s: DocSummary) => s.missing + s.expired + s.expiring > 0;

/** Owners hold shares that add up to 100; anything else needs fixing. */
function Ownership({ o }: { o: CompanyRow["ownership"] }) {
  if (o.owners === 0) return <span className="text-muted">No owners</span>;
  return o.ok ? <Badge color="green">100%</Badge> : <Badge color="amber">{o.total}% set</Badge>;
}

/** One compact status per area: what needs doing, worst first, or "In order". */
function Status({ s }: { s: DocSummary }) {
  if (!attention(s)) return <Badge color="green">In order</Badge>;
  return (
    <span className="flex flex-wrap gap-1">
      {s.expired > 0 && <Badge color="red">{s.expired} expired</Badge>}
      {s.missing > 0 && <Badge color="red">{s.missing} missing</Badge>}
      {s.expiring > 0 && <Badge color="amber">{s.expiring} expiring</Badge>}
    </span>
  );
}

export function CompanyTable({ rows }: { rows: CompanyRow[] }) {
  const [query, setQuery] = useState("");
  const [onlyIssues, setOnlyIssues] = useState(false);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => (!q || [r.name, r.code, r.fullName].some((v) => v?.toLowerCase().includes(q))) && (!onlyIssues || attention(r.own) || attention(r.owners) || (r.ownership.owners > 0 && !r.ownership.ok)));
  }, [rows, query, onlyIssues]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <label className="relative block w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" aria-hidden />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search companies…" className="input w-full pl-9" />
        </label>
        <label className="flex items-center gap-2 text-sm text-secondary">
          <input type="checkbox" checked={onlyIssues} onChange={(e) => setOnlyIssues(e.target.checked)} /> Needs attention only
        </label>
        <span className="tabular ml-auto text-xs text-muted">{shown.length} of {rows.length}</span>
      </div>
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-default bg-surface-subtle text-left text-xs font-medium tracking-wide text-muted uppercase">
            <tr>
              <th className="px-4 py-3">Company</th>
              <th className="px-4 py-3 text-right">Employees</th>
              <th className="px-4 py-3 text-right">Owners &amp; sponsors</th>
              <th className="px-4 py-3">Ownership</th>
              <th className="px-4 py-3">Company documents</th>
              <th className="px-4 py-3">Owner &amp; sponsor documents</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {shown.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-muted">No companies match.</td></tr>
            )}
            {shown.map((r) => (
              <tr key={r.id} className="hover:bg-surface-hover">
                <td className={`px-4 py-3 ${r.sub ? "pl-10" : ""}`}>
                  <div className="flex items-center gap-2">
                    {r.sub && <CornerDownRight className="h-3.5 w-3.5 shrink-0 text-subtle" aria-hidden />}
                    <Link href={`/suppliers/${r.id}`} className="font-medium text-primary hover:underline">{r.name}</Link>
                    {r.code && <span className="tabular rounded-md bg-surface-sunken px-1.5 py-0.5 text-xs font-medium text-secondary">{r.code}</span>}
                  </div>
                  {r.fullName && r.fullName !== r.name && <div className={`truncate text-xs text-muted ${r.sub ? "pl-5" : ""}`}>{r.fullName}</div>}
                </td>
                <td className="tabular px-4 py-3 text-right text-secondary">{r.employees}</td>
                <td className="tabular px-4 py-3 text-right text-secondary">{r.people}</td>
                <td className="px-4 py-3"><Ownership o={r.ownership} /></td>
                <td className="px-4 py-3"><Status s={r.own} /></td>
                <td className="px-4 py-3">{r.people === 0 ? <span className="text-muted">None added</span> : <Status s={r.owners} />}</td>
                <td className="px-4 py-3"><Badge color={r.status === "ACTIVE" ? "green" : "red"}>{r.status}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
