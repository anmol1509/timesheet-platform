"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge, type BadgeColor } from "@/components/Badge";
import { PARTY_ROLE_LABEL } from "@/lib/documentTypes";

export type PersonStatus = "none" | "expired" | "expiring" | "missing" | "noexpiry" | "ok";
export type PersonRow = {
  id: string;
  name: string;
  nationality: string | null;
  phone: string | null;
  companies: { id: string; name: string; role: string; percent: number | null }[];
  companyCount: number;
  docs: number;
  status: PersonStatus;
  expired: number;
  expiring: number;
  missing: number;
  noExpiry: number;
  nextDays: number | null;
};

const FILTERS: { key: "all" | PersonStatus; label: string }[] = [
  { key: "all", label: "Everyone" },
  { key: "none", label: "No documents" },
  { key: "noexpiry", label: "Expiry missing" },
  { key: "missing", label: "Required missing" },
  { key: "expired", label: "Expired" },
  { key: "expiring", label: "Expiring soon" },
  { key: "ok", label: "All in order" },
];

const BADGE: Record<PersonStatus, { color: BadgeColor; label: (r: PersonRow) => string }> = {
  none: { color: "red", label: () => "No documents" },
  expired: { color: "red", label: (r) => `${r.expired} expired` },
  expiring: { color: "amber", label: (r) => `Expiring${r.nextDays !== null ? ` in ${r.nextDays}d` : ""}` },
  missing: { color: "amber", label: (r) => `${r.missing} required missing` },
  noexpiry: { color: "amber", label: (r) => `${r.noExpiry} without expiry` },
  ok: { color: "green", label: () => "In order" },
};

export function PeopleList({ rows }: { rows: PersonRow[] }) {
  const [filter, setFilter] = useState<"all" | PersonStatus>("all");
  const [role, setRole] = useState("ALL");
  const [q, setQ] = useState("");

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: rows.length };
    for (const r of rows) c[r.status] = (c[r.status] ?? 0) + 1;
    return c;
  }, [rows]);

  const shown = rows.filter((r) => {
    if (filter !== "all" && r.status !== filter) return false;
    if (role !== "ALL" && !r.companies.some((c) => c.role === role)) return false;
    const needle = q.trim().toLowerCase();
    return !needle || r.name.toLowerCase().includes(needle) || r.companies.some((c) => c.name.toLowerCase().includes(needle));
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            aria-pressed={filter === f.key}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${filter === f.key ? "border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white" : "border-default bg-surface text-muted hover:text-primary"}`}
          >
            {f.label} <span className="tabular opacity-80">{counts[f.key] ?? 0}</span>
          </button>
        ))}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <select aria-label="Role" value={role} onChange={(e) => setRole(e.target.value)} className="input w-auto py-1.5 text-sm">
            <option value="ALL">Any role</option>
            {Object.entries(PARTY_ROLE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or company" aria-label="Search people" className="input w-56 py-1.5 text-sm" />
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="card px-4 py-8 text-center text-sm text-muted">Nobody matches this filter.</p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-default text-left text-xs font-medium tracking-wide text-muted uppercase">
              <tr>
                <th className="px-4 py-2.5">Person</th>
                <th className="px-4 py-2.5">Companies</th>
                <th className="px-4 py-2.5 text-right">Linked</th>
                <th className="px-4 py-2.5 text-right">Files</th>
                <th className="px-4 py-2.5">Documents</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {shown.map((r) => {
                const b = BADGE[r.status];
                return (
                  <tr key={r.id} className="align-top">
                    <td className="px-4 py-3">
                      <Link href={`/suppliers/${r.companies[0].id}`} className="font-medium text-primary hover:underline">{r.name}</Link>
                      <p className="text-xs text-muted">{[r.nationality, r.phone].filter(Boolean).join(" · ") || "No nationality or phone"}</p>
                    </td>
                    <td className="px-4 py-3">
                      <ul className="space-y-0.5">
                        {r.companies.slice(0, 4).map((c) => (
                          <li key={`${c.id}-${c.role}`}>
                            <Link href={`/suppliers/${c.id}`} className="hover:underline">{c.name}</Link>{" "}
                            <span className="text-xs text-muted">{PARTY_ROLE_LABEL[c.role] ?? c.role}{c.percent != null ? ` · ${c.percent}%` : ""}</span>
                          </li>
                        ))}
                        {r.companies.length > 4 && <li className="text-xs text-muted">+{r.companies.length - 4} more</li>}
                      </ul>
                    </td>
                    <td className="tabular px-4 py-3 text-right">{r.companyCount}</td>
                    <td className="tabular px-4 py-3 text-right">{r.docs}</td>
                    <td className="px-4 py-3">
                      <Badge color={b.color}>{b.label(r)}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
