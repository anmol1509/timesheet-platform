"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/Badge";
import { Pagination } from "@/components/Pagination";

const PAGE_SIZE = 25;

type Entry = {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  changes: Record<string, unknown> | null;
  userName: string;
  createdAt: Date;
};

const ACTION_BADGE: Record<string, { label: string; color: "green" | "amber" | "red" }> = {
  CREATE: { label: "Created", color: "green" },
  UPDATE: { label: "Updated", color: "amber" },
  DELETE: { label: "Deleted", color: "red" },
};

function formatValue(v: unknown) {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return String(v);
}

function ChangesDetail({ action, changes }: { action: string; changes: Record<string, unknown> | null }) {
  if (!changes || Object.keys(changes).length === 0) {
    return <p className="px-4 py-2 text-xs text-slate-500">No field details recorded.</p>;
  }
  if (action === "UPDATE") {
    return (
      <ul className="space-y-1 px-4 py-2 text-xs text-slate-600">
        {Object.entries(changes).map(([field, diff]) => {
          const d = diff as { from: unknown; to: unknown };
          return (
            <li key={field}>
              <span className="font-medium text-slate-900">{field}</span>: {formatValue(d.from)} →{" "}
              {formatValue(d.to)}
            </li>
          );
        })}
      </ul>
    );
  }
  return (
    <ul className="space-y-1 px-4 py-2 text-xs text-slate-600">
      {Object.entries(changes).map(([field, value]) => (
        <li key={field}>
          <span className="font-medium text-slate-900">{field}</span>: {formatValue(value)}
        </li>
      ))}
    </ul>
  );
}

export function AuditLogList({ entries }: { entries: Entry[] }) {
  const [query, setQuery] = useState("");
  const [entityType, setEntityType] = useState("all");
  const [action, setAction] = useState("all");
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const entityTypes = useMemo(
    () => Array.from(new Set(entries.map((e) => e.entityType))).sort(),
    [entries]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((e) => {
      if (entityType !== "all" && e.entityType !== entityType) return false;
      if (action !== "all" && e.action !== action) return false;
      if (q && !(e.userName.toLowerCase().includes(q) || e.entityId.toLowerCase().includes(q))) {
        return false;
      }
      return true;
    });
  }, [entries, entityType, action, query]);

  useEffect(() => {
    setPage(1);
  }, [query, entityType, action]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by user or entity ID…"
          className="w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-900"
        />
        <select
          value={entityType}
          onChange={(e) => setEntityType(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-900"
        >
          <option value="all">All entities</option>
          {entityTypes.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select
          value={action}
          onChange={(e) => setAction(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-900"
        >
          <option value="all">All actions</option>
          <option value="CREATE">Created</option>
          <option value="UPDATE">Updated</option>
          <option value="DELETE">Deleted</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium tracking-wide text-slate-500 uppercase">
            <tr>
              <th className="px-4 py-3">Timestamp</th>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Entity</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {pageRows.map((e) => {
              const badge = ACTION_BADGE[e.action] ?? { label: e.action, color: "amber" as const };
              const expanded = expandedId === e.id;
              return (
                <Fragment key={e.id}>
                  <tr>
                    <td className="px-4 py-3 text-slate-500">
                      {new Date(e.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-slate-900">{e.userName}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {e.entityType} <span className="text-slate-400">· {e.entityId.slice(0, 8)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge color={badge.color}>{badge.label}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setExpandedId(expanded ? null : e.id)}
                        className="text-xs font-medium text-blue-600 hover:underline"
                      >
                        {expanded ? "Hide" : "View changes"}
                      </button>
                    </td>
                  </tr>
                  {expanded && (
                    <tr className="bg-slate-50">
                      <td colSpan={5}>
                        <ChangesDetail action={e.action} changes={e.changes} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="px-4 py-10 text-center text-sm text-slate-500">
            No audit entries match your filters.
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
