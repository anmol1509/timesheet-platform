"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Select } from "@/components/ui/Select";
import { isOnWork } from "@/lib/employeeStage";
import {
  expandSuppliers,
  matchesFilters,
  projectsForClient,
  sitesForScope,
  type StatusFilter,
} from "@/lib/attendanceFilters";
import { Checkbox } from "@/components/ui/Checkbox";
import { cn } from "@/lib/cn";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  deleteAttendanceAction,
  markAttendanceAction,
  approveAttendanceDayAction,
  requestAttendanceCorrectionAction,
  loadDayAttendanceAction,
} from "./actions";

type Supplier = { id: string; name: string; parentId: string | null };
type EmployeeOption = {
  id: string;
  name: string;
  employeeIdNo: string;
  trade: string | null;
  status: string;
  supplierId: string | null;
  supplierName: string | null;
  projectId: string | null;
  /** Reached through the project — a worker has no client of their own. */
  clientId: string | null;
  projectName: string;
  siteId: string | null;
};
type ExistingRow = { id: string; status: string; normalHours: number | null; otHours: number | null; locked: boolean };

const STATUS_OPTIONS = ["PRESENT", "ABSENT", "LEAVE", "HOLIDAY", "OFF"];

/**
 * A standard site day. Pre-filled for active workers so marking a day is a
 * matter of correcting the exceptions rather than typing the same number
 * against every name.
 */
const DEFAULT_DAY_HOURS = "10";


export function AttendanceForm({
  suppliers,
  clients,
  employees,
  projects,
  sites,
  date,
}: {
  suppliers: Supplier[];
  clients: { id: string; name: string }[];
  employees: EmployeeOption[];
  projects: { id: string; label: string; clientId: string }[];
  sites: { id: string; label: string; projectId: string }[];
  /** Chosen on the calendar; the day being marked. */
  date: string;
}) {
  const [pending, startTransition] = useTransition();
  // Filters narrow the roster; they don't decide which day is being marked.
  const [supplierIds, setSupplierIds] = useState<string[]>([]);
  const [clientId, setClientId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [siteId, setSiteId] = useState("");
  // "On work" covers the whole mobilisation cycle, not just ACTIVE — see
  // ON_WORK_STAGES. Matching ACTIVE exactly hid the newly mobilised.
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("working");
  const [query, setQuery] = useState("");
  const [statuses, setStatuses] = useState<Record<string, string>>({});
  const [normalHours, setNormalHours] = useState<Record<string, string>>({});
  const [otHours, setOtHours] = useState<Record<string, string>>({});
  const [existing, setExisting] = useState<Record<string, ExistingRow>>({});
  // Who is actually being recorded today. Nothing is saved for a worker who
  // isn't ticked: the roster lists everyone on the books, and defaulting the
  // whole list to Present marks idle workers as having worked a full day.
  const [marked, setMarked] = useState<Record<string, boolean>>({});
  const [correctionFor, setCorrectionFor] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  // Bumped after a mark is deleted, to re-pull the day from the server.
  const [reloadKey, setReloadKey] = useState(0);

  const expandedSupplierIds = useMemo(
    () => expandSuppliers(supplierIds, suppliers),
    [supplierIds, suppliers]
  );

  // Each filter narrows the next. Offering every project under a chosen client,
  // or every site under a chosen project, is how you end up with a filter
  // combination that can only ever match nobody.
  const visibleProjects = useMemo(
    () => projectsForClient(projects, clientId),
    [projects, clientId]
  );
  const visibleSites = useMemo(
    () => sitesForScope(sites, visibleProjects, clientId, projectId),
    [sites, visibleProjects, clientId, projectId]
  );

  // Narrowing the client can strand a project or site chosen under the old one.
  useEffect(() => {
    if (projectId && !visibleProjects.some((p) => p.id === projectId)) setProjectId("");
  }, [visibleProjects, projectId]);
  useEffect(() => {
    if (siteId && !visibleSites.some((x) => x.id === siteId)) setSiteId("");
  }, [visibleSites, siteId]);

  const rows = useMemo(
    () =>
      employees.filter((e) =>
        matchesFilters(e, {
          supplierIds: expandedSupplierIds,
          clientId,
          projectId,
          siteId,
          status: statusFilter,
          query,
        })
      ),
    [employees, expandedSupplierIds, clientId, projectId, siteId, statusFilter, query]
  );

  useEffect(() => {
    // `date` is always set — the form is only rendered once a day is picked.
    const formData = new FormData();
    formData.append("date", date);
    loadDayAttendanceAction(formData).then((res) => {
      setExisting(res.rows);
      const nextStatuses: Record<string, string> = {};
      const nextNormal: Record<string, string> = {};
      const nextOt: Record<string, string> = {};
      for (const [employeeId, row] of Object.entries(res.rows)) {
        nextStatuses[employeeId] = row.status;
        nextNormal[employeeId] = row.normalHours != null ? String(row.normalHours) : "";
        nextOt[employeeId] = row.otHours != null ? String(row.otHours) : "";
      }
      setStatuses(nextStatuses);
      setNormalHours(nextNormal);
      setOtHours(nextOt);
    });
  }, [date, reloadKey]);

  // Clears a saved mark outright, for a day recorded against the wrong worker
  // — a status can't express "this shouldn't exist".
  function clearMark(employeeId: string) {
    const row = existing[employeeId];
    if (!row) return;
    const formData = new FormData();
    formData.append("attendanceId", row.id);
    startTransition(async () => {
      const res = await deleteAttendanceAction(formData);
      setResult(res.error ?? (res.deleted ? "Mark cleared." : null));
      if (res.deleted) {
        setStatuses((prev) => {
          const next = { ...prev };
          delete next[employeeId];
          return next;
        });
        setReloadKey((k) => k + 1);
      }
    });
  }

  function statusFor(employeeId: string) {
    return statuses[employeeId] || "PRESENT";
  }

  /** Already-saved rows are ticked; everyone else has to be chosen. */
  function isMarked(employeeId: string) {
    return marked[employeeId] ?? !!existing[employeeId];
  }

  function toggleMarked(employeeId: string) {
    setMarked((prev) => ({ ...prev, [employeeId]: !isMarked(employeeId) }));
  }

  /**
   * What goes in the hours box: whatever was typed, then whatever is already
   * saved, then a standard day for an active worker who is present.
   */
  function normalFor(e: EmployeeOption) {
    const typed = normalHours[e.id];
    if (typed !== undefined) return typed;
    if (existing[e.id]) return existing[e.id].normalHours != null
      ? String(existing[e.id].normalHours)
      : "";
    if (!isMarked(e.id)) return "";
    // Anyone on a job gets the standard day prefilled, not just those already
    // promoted to ACTIVE — the first day on site is a full day like any other.
    return isOnWork(e.status) && statusFor(e.id) === "PRESENT" ? DEFAULT_DAY_HOURS : "";
  }

  function isLocked(employeeId: string) {
    return existing[employeeId]?.locked ?? false;
  }

  /** Ticks and sets Present for everyone currently filtered into view. */
  function markAllPresent() {
    setStatuses((prev) => {
      const next = { ...prev };
      for (const r of rows) if (!isLocked(r.id)) next[r.id] = "PRESENT";
      return next;
    });
    setMarked((prev) => {
      const next = { ...prev };
      for (const r of rows) if (!isLocked(r.id)) next[r.id] = true;
      return next;
    });
  }

  function clearAllMarks() {
    setMarked((prev) => {
      const next = { ...prev };
      for (const r of rows) if (!isLocked(r.id)) next[r.id] = false;
      return next;
    });
  }

  function handleSave() {
    const rowsJson = JSON.stringify(
      rows
        .filter((e) => !isLocked(e.id) && isMarked(e.id))
        .map((e) => ({
          employeeId: e.id,
          status: statusFor(e.id),
          normalHours: normalFor(e),
          otHours: otHours[e.id] || "",
        }))
    );
    const formData = new FormData();
    formData.append("date", date);
    formData.append("rowsJson", rowsJson);
    startTransition(async () => {
      const res = await markAttendanceAction(formData);
      setResult(res.error || `Saved ${res.saved} of ${res.requested} rows.`);
    });
  }

  function handleApproveDay() {
    const formData = new FormData();
    formData.append("date", date);
    formData.append("projectId", projectId);
    startTransition(async () => {
      const res = await approveAttendanceDayAction(formData);
      setResult(`Approved and locked ${res.updated} row(s) for this day.`);
    });
  }

  const allLocked = rows.length > 0 && rows.every((r) => isLocked(r.id));

  return (
    <div className="space-y-6">
      <div className="card flex flex-wrap items-end gap-3 p-4">
        <label className="min-w-[12rem] flex-1">
          <span className="mb-1 block text-xs font-medium text-muted">Search</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Name, ID or trade…"
            className="input w-full"
          />
        </label>
        <label className="w-40">
          <span className="mb-1 block text-xs font-medium text-muted">Status</span>
          <Select
            value={statusFilter}
            onChange={(v) => setStatusFilter(v as StatusFilter)}
            searchable={false}
            options={[
              { value: "working", label: "On work" },
              { value: "IDLE", label: "Idle" },
              { value: "all", label: "All" },
            ]}
          />
        </label>
        <label className="w-52">
          <span className="mb-1 block text-xs font-medium text-muted">Client</span>
          <Select
            value={clientId}
            onChange={setClientId}
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
            value={projectId}
            onChange={setProjectId}
            placeholder="All projects"
            options={[
              { value: "", label: "All projects" },
              ...visibleProjects.map((p) => ({ value: p.id, label: p.label })),
            ]}
          />
        </label>
        <label className="w-52">
          <span className="mb-1 block text-xs font-medium text-muted">Site</span>
          <Select
            value={siteId}
            onChange={setSiteId}
            placeholder="All sites"
            options={[
              { value: "", label: "All sites" },
              ...visibleSites.map((x) => ({ value: x.id, label: x.label })),
            ]}
          />
        </label>
        <div className="w-full">
          <span className="mb-1 block text-xs font-medium text-muted">
            Suppliers {supplierIds.length > 0 && `(${supplierIds.length} selected)`}
          </span>
          {/* Multi-select, and picking a parent pulls in its subsidiaries. */}
          <div className="flex flex-wrap gap-1.5">
            {suppliers.map((sup) => {
              const on = supplierIds.includes(sup.id);
              const impliedByParent =
                !on && !!sup.parentId && supplierIds.includes(sup.parentId);
              return (
                <button
                  key={sup.id}
                  type="button"
                  onClick={() =>
                    setSupplierIds((prev) =>
                      prev.includes(sup.id)
                        ? prev.filter((x) => x !== sup.id)
                        : [...prev, sup.id]
                    )
                  }
                  className={cn(
                    "rounded-control border px-2 py-1 text-xs font-medium transition",
                    on
                      ? "border-[var(--brand-primary)] bg-brand-soft text-[var(--brand-primary)]"
                      : impliedByParent
                        ? "border-[var(--brand-primary)]/40 bg-brand-soft/50 text-[var(--brand-primary)]"
                        : "border-default bg-surface text-secondary hover:bg-surface-hover"
                  )}
                >
                  {sup.parentId && <span className="mr-1 text-subtle">└</span>}
                  {sup.name}
                </button>
              );
            })}
            {supplierIds.length > 0 && (
              <button
                type="button"
                onClick={() => setSupplierIds([])}
                className="px-2 py-1 text-xs font-medium text-blue-600 hover:underline"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-primary">Employees</h2>
          {rows.length > 0 && !allLocked && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted">
                {rows.filter((r) => isMarked(r.id)).length} of {rows.length} to record
              </span>
              <button
                type="button"
                onClick={markAllPresent}
                className="btn btn-secondary btn-sm"
              >
                Mark all Present
              </button>
              <button
                type="button"
                onClick={clearAllMarks}
                className="btn btn-secondary btn-sm"
              >
                Clear
              </button>
            </div>
          )}
        </div>
        {rows.length === 0 ? (
          <p className="text-sm text-muted">No employee matches these filters.</p>
        ) : (
          <div className="overflow-x-auto">
            {allLocked && (
              <p className="mb-2 text-xs font-medium text-amber-600">
                This day is approved and locked — use &ldquo;Request correction&rdquo; to change a row.
              </p>
            )}
            <table className="w-full text-sm">
              <thead className="border-b border-default text-left text-xs font-medium tracking-wide text-muted uppercase">
                <tr>
                  <th className="w-10 px-2 py-2">Record</th>
                  <th className="px-2 py-2">Employee</th>
                  <th className="px-2 py-2">Trade</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2">Normal hrs</th>
                  <th className="px-2 py-2">OT hrs</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {rows.map((e) => {
                  const locked = isLocked(e.id);
                  const on = isMarked(e.id);
                  return (
                    <tr key={e.id} className={cn(!on && !locked && "opacity-55")}>
                      <td className="px-2 py-2">
                        <Checkbox
                          checked={on}
                          disabled={locked}
                          onCheckedChange={() => toggleMarked(e.id)}
                          aria-label={`Record attendance for ${e.name}`}
                        />
                      </td>
                      <td className="px-2 py-2 text-primary">
                        {e.name} <span className="text-subtle">{e.employeeIdNo}</span>
                      </td>
                      <td className="px-2 py-2 text-secondary">{e.trade || "—"}</td>
                      <td className="px-2 py-2">
                        <select
                          value={statusFor(e.id)}
                          disabled={locked || !on}
                          onChange={(ev) => setStatuses((prev) => ({ ...prev, [e.id]: ev.target.value }))}
                          className="input px-2 py-1.5 disabled:opacity-50"
                        >
                          {STATUS_OPTIONS.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-2">
                        <input
                          value={normalFor(e)}
                          disabled={locked || !on}
                          onChange={(ev) => setNormalHours((prev) => ({ ...prev, [e.id]: ev.target.value }))}
                          type="number"
                          min={0}
                          step="0.5"
                          className="input w-20 px-2 py-1.5 disabled:opacity-50"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          value={otHours[e.id] || ""}
                          disabled={locked || !on}
                          onChange={(ev) => setOtHours((prev) => ({ ...prev, [e.id]: ev.target.value }))}
                          type="number"
                          min={0}
                          step="0.5"
                          className="input w-20 px-2 py-1.5 disabled:opacity-50"
                        />
                      </td>
                      <td className="px-2 py-2">
                        {locked ? (
                          <button
                            type="button"
                            onClick={() => setCorrectionFor(e.id)}
                            className="text-xs font-medium text-blue-600 hover:underline"
                          >
                            Request correction
                          </button>
                        ) : (
                          existing[e.id] && (
                            <ConfirmDialog
                              title="Clear this mark?"
                              description={`Remove ${e.name}'s attendance for ${date}? The day goes back to unmarked.`}
                              confirmLabel="Clear"
                              onConfirm={() => clearMark(e.id)}
                              trigger={(open) => (
                                <button
                                  type="button"
                                  disabled={pending}
                                  onClick={open}
                                  className="text-xs font-medium text-[var(--error)] hover:underline disabled:opacity-50"
                                >
                                  Clear
                                </button>
                              )}
                            />
                          )
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {result && <p className="text-sm text-secondary">{result}</p>}

      {!allLocked && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={pending || rows.length === 0}
            className="btn btn-primary"
          >
            {pending ? "Saving…" : "Save Attendance"}
          </button>
          <button
            type="button"
            onClick={handleApproveDay}
            disabled={pending || !projectId || rows.length === 0}
            className="rounded-lg border border-emerald-300 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
          >
            Submit day for approval (lock)
          </button>
        </div>
      )}

      {correctionFor && existing[correctionFor] && (
        <CorrectionRequestPanel
          attendanceId={existing[correctionFor].id}
          employeeName={rows.find((r) => r.id === correctionFor)?.name || ""}
          onClose={() => setCorrectionFor(null)}
        />
      )}
    </div>
  );
}

function CorrectionRequestPanel({
  attendanceId,
  employeeName,
  onClose,
}: {
  attendanceId: string;
  employeeName: string;
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [reason, setReason] = useState("");
  const [requestedStatus, setRequestedStatus] = useState("");
  const [requestedNormalHours, setRequestedNormalHours] = useState("");
  const [requestedOtHours, setRequestedOtHours] = useState("");
  const [done, setDone] = useState(false);

  function submit() {
    const formData = new FormData();
    formData.append("attendanceId", attendanceId);
    formData.append("reason", reason);
    formData.append("requestedStatus", requestedStatus);
    formData.append("requestedNormalHours", requestedNormalHours);
    formData.append("requestedOtHours", requestedOtHours);
    startTransition(async () => {
      await requestAttendanceCorrectionAction(formData);
      setDone(true);
    });
  }

  return (
    <div className="empty-state p-4">
      <h3 className="mb-2 text-sm font-semibold text-primary">Request correction — {employeeName}</h3>
      {done ? (
        <p className="text-sm text-emerald-600">Correction request submitted for manager review.</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">Requested status</span>
              <select
                value={requestedStatus}
                onChange={(e) => setRequestedStatus(e.target.value)}
                className="input w-full px-2 py-1.5"
              >
                <option value="">No change</option>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">Normal hrs</span>
              <input
                value={requestedNormalHours}
                onChange={(e) => setRequestedNormalHours(e.target.value)}
                type="number"
                className="input w-full px-2 py-1.5"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">OT hrs</span>
              <input
                value={requestedOtHours}
                onChange={(e) => setRequestedOtHours(e.target.value)}
                type="number"
                className="input w-full px-2 py-1.5"
              />
            </label>
          </div>
          <label className="mt-3 block">
            <span className="mb-1 block text-xs font-medium text-muted">Reason</span>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason for correction"
              className="input w-full"
            />
          </label>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={pending || !reason.trim()}
              onClick={submit}
              className="btn btn-primary btn-sm"
            >
              {pending ? "Submitting…" : "Submit request"}
            </button>
            <button type="button" onClick={onClose} className="text-xs font-medium text-subtle hover:underline">
              Cancel
            </button>
          </div>
        </>
      )}
    </div>
  );
}
