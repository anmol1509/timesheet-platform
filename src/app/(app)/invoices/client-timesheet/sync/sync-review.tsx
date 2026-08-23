"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/Badge";
import { Select } from "@/components/ui/Select";
import type { Divergence } from "@/lib/attendanceTimesheetSync";
import { applyDivergencesAction } from "./actions";

function formatDate(iso: string) {
  return new Date(iso + "T00:00:00.000Z").toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  });
}

/** A blank cell means the sheet has nothing for that day, which reads badly as "". */
function cellText(value: string | null) {
  if (value === null) return "no row";
  return value.trim() === "" ? "blank" : value;
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under review",
  CLIENT_APPROVED: "Client approved",
  REJECTED: "Rejected",
  LOCKED: "Locked",
};

export function SyncReview({
  month,
  clientId,
  projectId,
  clients,
  projects,
  divergences,
  emptyState,
}: {
  month: string;
  clientId: string;
  projectId: string;
  clients: { id: string; name: string }[];
  projects: { id: string; label: string; clientId: string }[];
  divergences: Divergence[];
  emptyState: React.ReactNode;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [applying, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);

  const visibleProjects = useMemo(
    () => (clientId ? projects.filter((p) => p.clientId === clientId) : projects),
    [projects, clientId]
  );

  const fixable = divergences.filter((d) => d.fixable);
  const sent = divergences.filter((d) => !d.fixable);

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    // Changing the client can strand a project chosen under the previous one.
    if (key === "clientId") next.delete("projectId");
    router.push(`?${next.toString()}`);
  }

  function apply() {
    const body = new FormData();
    body.append("month", month);
    if (clientId) body.append("clientId", clientId);
    if (projectId) body.append("projectId", projectId);
    startTransition(async () => {
      const res = await applyDivergencesAction(body);
      if (res.error) setResult(res.error);
      else {
        const r = res.result;
        const parts = [`Updated ${r?.written ?? 0} day(s)`];
        if (r?.created) parts.push(`created ${r.created} timesheet row(s)`);
        if (r?.createdWithoutRate) parts.push(`${r.createdWithoutRate} still need a rate`);
        if (r?.diverged) parts.push(`${r.diverged} left alone on sheets already sent`);
        setResult(`${parts.join(", ")}.`);
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-end gap-3 p-4">
        <label className="w-44">
          <span className="mb-1 block text-xs font-medium text-muted">Month</span>
          <input
            type="month"
            value={month}
            onChange={(e) => setParam("month", e.target.value)}
            className="input w-full"
          />
        </label>
        <label className="w-52">
          <span className="mb-1 block text-xs font-medium text-muted">Client</span>
          <Select
            value={clientId}
            onChange={(v) => setParam("clientId", v)}
            placeholder="All clients"
            options={[
              { value: "", label: "All clients" },
              ...clients.map((c) => ({ value: c.id, label: c.name })),
            ]}
          />
        </label>
        <label className="w-52">
          <span className="mb-1 block text-xs font-medium text-muted">Project</span>
          <Select
            value={visibleProjects.some((p) => p.id === projectId) ? projectId : ""}
            onChange={(v) => setParam("projectId", v)}
            placeholder="All projects"
            options={[
              { value: "", label: "All projects" },
              ...visibleProjects.map((p) => ({ value: p.id, label: p.label })),
            ]}
          />
        </label>
        <div className="ml-auto flex items-center gap-3">
          {result && <span className="text-xs text-muted">{result}</span>}
          <button
            type="button"
            onClick={apply}
            disabled={applying || fixable.length === 0}
            className="btn btn-primary btn-sm"
            title={
              fixable.length === 0
                ? "Nothing here can be written — the sheets have gone to the client"
                : "Writes attendance into every sheet still open"
            }
          >
            {applying ? "Syncing…" : `Sync ${fixable.length || ""} day(s)`}
          </button>
        </div>
      </div>

      {divergences.length === 0 ? (
        emptyState
      ) : (
        <>
          {sent.length > 0 && (
            <p className="rounded-card border border-[var(--warning-border)] bg-[var(--warning-soft)] px-4 py-3 text-sm text-[var(--warning)]">
              {sent.length} day(s) sit on sheets already sent to the client. They are
              listed below but will not be rewritten — correct the sheet through the
              normal workflow, or reject it back to draft first.
            </p>
          )}

          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[52rem] text-sm">
                <thead className="border-b border-default bg-surface-subtle text-left text-xs font-medium tracking-wide text-muted uppercase">
                  <tr>
                    <th className="px-4 py-3">Worker</th>
                    <th className="px-4 py-3">Trade</th>
                    <th className="px-4 py-3">Client</th>
                    <th className="px-4 py-3">Project</th>
                    <th className="px-4 py-3">Day</th>
                    <th className="px-4 py-3">Attendance</th>
                    <th className="px-4 py-3">Timesheet</th>
                    <th className="px-4 py-3">Sheet</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {divergences.map((d) => (
                    <tr key={`${d.employeeId}-${d.date}-${d.trade}`}>
                      <td className="px-4 py-3">
                        <span className="font-medium text-primary">{d.employeeName}</span>
                        <span className="tabular ml-2 text-xs text-subtle">
                          {d.employeeIdNo}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-secondary">{d.trade}</td>
                      <td className="px-4 py-3 text-secondary">
                        {d.clientName ?? <span className="text-subtle">—</span>}
                      </td>
                      <td className="px-4 py-3 text-secondary">
                        {d.projectLabel ?? <span className="text-subtle">—</span>}
                      </td>
                      <td className="tabular px-4 py-3 text-secondary">
                        {formatDate(d.date)}
                      </td>
                      <td className="tabular px-4 py-3 font-medium text-primary">
                        {d.attendanceValue}
                      </td>
                      <td className="tabular px-4 py-3 text-secondary">
                        {cellText(d.timesheetValue)}
                      </td>
                      <td className="px-4 py-3">
                        {d.entryStatus === null ? (
                          <Badge color="blue">Will be created</Badge>
                        ) : (
                          <Badge color={d.fixable ? "amber" : "red"}>
                            {STATUS_LABEL[d.entryStatus] ?? d.entryStatus}
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
