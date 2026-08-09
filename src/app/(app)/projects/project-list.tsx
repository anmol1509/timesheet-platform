"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/Badge";
import type { BadgeColor } from "@/components/Badge";
import { Pagination } from "@/components/Pagination";

const PAGE_SIZE = 25;

type ProjectRow = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  clientName: string;
  address: string | null;
  manager: string | null;
  timelineStart: string | null;
  timelineEnd: string | null;
  status: string;
};

const STATUS_COLOR: Record<string, BadgeColor> = {
  ACTIVE: "green",
  PLANNING: "amber",
  COMPLETED: "slate",
  ON_HOLD: "red",
};

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function ProjectList({ projects }: { projects: ProjectRow[] }) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        (p.address || "").toLowerCase().includes(q) ||
        (p.manager || "").toLowerCase().includes(q)
    );
  }, [projects, query]);

  useEffect(() => {
    setPage(1);
  }, [query]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-4">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search projects by name, code, site, or manager..."
        className="w-full max-w-md rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
      />
      <div>
        <h2 className="mb-3 text-sm font-semibold text-slate-900">
          All Projects
        </h2>
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium tracking-wide text-slate-500 uppercase">
              <tr>
                <th className="px-4 py-3">Project</th>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Address</th>
                <th className="px-4 py-3">Project Manager</th>
                <th className="px-4 py-3">Timeline</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pageRows.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/projects/${p.id}`}
                      className="font-medium text-slate-900"
                    >
                      {p.name}
                    </Link>
                    {p.description && (
                      <p className="text-xs text-slate-400">{p.description}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{p.code}</td>
                  <td className="px-4 py-3 text-slate-600">{p.clientName}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {p.address || "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {p.manager || "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {fmtDate(p.timelineStart)} – {fmtDate(p.timelineEnd)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge color={STATUS_COLOR[p.status] || "slate"}>
                      {p.status.replace("_", " ").toLowerCase()}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <p className="px-4 py-10 text-center text-sm text-slate-500">
              No projects match &ldquo;{query}&rdquo;.
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
    </div>
  );
}
