"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/Badge";
import type { BadgeColor } from "@/components/Badge";
import { Pagination } from "@/components/Pagination";
import { Pencil } from "lucide-react";
import { DeleteButton } from "@/components/DeleteButton";
import { deleteProjectAction } from "./actions";

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
        className="input w-full max-w-md"
      />
      <div>
        <h2 className="mb-3 text-sm font-semibold text-primary">
          All Projects
        </h2>
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-default bg-surface-subtle text-left text-xs font-medium tracking-wide text-muted uppercase">
              <tr>
                <th className="px-4 py-3">Project</th>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Address</th>
                <th className="px-4 py-3">Project Manager</th>
                <th className="px-4 py-3">Timeline</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {pageRows.map((p) => (
                <tr key={p.id} className="hover:bg-surface-hover">
                  <td className="px-4 py-3">
                    <Link
                      href={`/projects/${p.id}`}
                      className="font-medium text-primary"
                    >
                      {p.name}
                    </Link>
                    {p.description && (
                      <p className="text-xs text-subtle">{p.description}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted">{p.code}</td>
                  <td className="px-4 py-3 text-secondary">{p.clientName}</td>
                  <td className="px-4 py-3 text-secondary">
                    {p.address || "—"}
                  </td>
                  <td className="px-4 py-3 text-secondary">
                    {p.manager || "—"}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {fmtDate(p.timelineStart)} – {fmtDate(p.timelineEnd)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge color={STATUS_COLOR[p.status] || "slate"}>
                      {p.status.replace("_", " ").toLowerCase()}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <Link
                      href={`/projects/${p.id}`}
                      className="mr-3 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
                    >
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </Link>
                    <DeleteButton
                      action={deleteProjectAction}
                      hiddenFields={{ projectId: p.id }}
                      confirmMessage={`Delete project "${p.name}"? Anyone assigned to it is unassigned. Projects with timesheet, attendance or LPO history can't be deleted — you'll be told which.`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <p className="px-4 py-10 text-center text-sm text-muted">
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
