"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { EmployeeAvatar } from "@/components/Avatar";
import { Select } from "@/components/ui/Select";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { isOnWork } from "@/lib/employeeStage";
import {
  expandSuppliers,
  matchesFilters,
  projectsForClient,
  sitesForScope,
  type StatusFilter,
} from "@/lib/attendanceFilters";
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
  hasPhoto: boolean;
  trade: string | null;
  status: string;
  siteArrivalDate: string | null;
  supplierId: string | null;
  supplierName: string | null;
  projectId: string | null;
  /** Reached through the project — a worker has no client of their own. */
  clientId: string | null;
  projectName: string;
  siteId: string | null;
  /** Days of the week (0 = Sunday) this worker's project is off. */
  weeklyOffDays: number[];
};
type ExistingRow = { id: string; status: string; normalHours: number | null; otHours: number | null; locked: boolean };

const STATUS_OPTIONS = ["PRESENT", "ABSENT", "LEAVE", "SICK_LEAVE", "IDLE", "HOLIDAY", "OFF"];

/** The four marks that cover almost every worker on almost every day. Idle, Holiday and Off live under "more". */
const QUICK: { key: string; status: string; label: string; on: string }[] = [
  { key: "P", status: "PRESENT", label: "Present", on: "bg-[var(--success)] text-white" },
  { key: "A", status: "ABSENT", label: "Absent", on: "bg-[var(--error)] text-white" },
  { key: "L", status: "LEAVE", label: "Leave", on: "bg-[var(--warning)] text-white" },
  { key: "S", status: "SICK_LEAVE", label: "Sick", on: "bg-[var(--brand-primary)] text-white" },
];
const MORE: Record<string, string> = { IDLE: "Idle", HOLIDAY: "Holiday", OFF: "Weekly off" };

/**
 * One tap marks a worker. Tapping the mark they already have clears it, and
 * the letters P A L S work while focus is on the row.
 */
function StatusButtons({ value, disabled, name, onChange }: { value: string | null; disabled: boolean; name: string; onChange: (status: string | null) => void }) {
  return (
    <div
      role="group"
      aria-label={`Attendance for ${name}`}
      className="flex items-center gap-1.5"
      onKeyDown={(ev) => {
        const hit = QUICK.find((q) => q.key.toLowerCase() === ev.key.toLowerCase());
        if (hit && !disabled && !ev.metaKey && !ev.ctrlKey && !ev.altKey) {
          ev.preventDefault();
          onChange(value === hit.status ? null : hit.status);
        }
      }}
    >
      <div className="inline-flex overflow-hidden rounded-control border border-default">
        {QUICK.map((q) => (
          <button
            key={q.key}
            type="button"
            disabled={disabled}
            aria-pressed={value === q.status}
            aria-label={q.label}
            title={q.label}
            onClick={() => onChange(value === q.status ? null : q.status)}
            className={cn(
              "w-8 border-r border-default py-1.5 text-xs font-semibold transition last:border-r-0 disabled:cursor-not-allowed disabled:opacity-50",
              value === q.status ? q.on : "bg-surface text-muted hover:bg-surface-hover"
            )}
          >
            {q.key}
          </button>
        ))}
      </div>
      <select
        aria-label={`More marks for ${name}`}
        disabled={disabled}
        value={value && MORE[value] ? value : ""}
        onChange={(ev) => onChange(ev.target.value || null)}
        className={cn("input h-8 w-[6.75rem] px-1.5 py-0 text-xs", value && MORE[value] && "font-semibold text-primary")}
      >
        <option value="">More…</option>
        {Object.entries(MORE).map(([v, l]) => (
          <option key={v} value={v}>{l}</option>
        ))}
      </select>
    </div>
  );
}

const SUMMARY: { label: string; statuses: string[]; tone: string }[] = [
  { label: "Present", statuses: ["PRESENT"], tone: "text-[var(--success)]" },
  { label: "Absent", statuses: ["ABSENT"], tone: "text-[var(--error)]" },
  { label: "Leave / sick", statuses: ["LEAVE", "SICK_LEAVE"], tone: "text-[var(--warning)]" },
  { label: "Idle / holiday / off", statuses: ["IDLE", "HOLIDAY", "OFF"], tone: "text-secondary" },
];

/**
 * A standard site day. Pre-filled for active workers so marking a day is a
 * matter of correcting the exceptions rather than typing the same number
 * against every name.
 */
const DEFAULT_DAY_HOURS = "10";

const KEY: { code: string; name: string; text: string }[] = [
  { code: "P", name: "Present", text: `Worked. ${DEFAULT_DAY_HOURS} normal hours are filled in; change them or add OT.` },
  { code: "A", name: "Absent", text: "Didn't come, no permission. Unpaid." },
  { code: "L", name: "Leave", text: "Approved leave, such as annual leave." },
  { code: "S", name: "Sick", text: "Sick leave." },
  { code: "More", name: "Idle · Holiday · Weekly off", text: "Idle: on site with no work. Holiday and weekly off are set for the whole day above." },
];


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
  /** Narrow the roster by what has been marked today, e.g. only the people still to do. */
  const [markFilter, setMarkFilter] = useState<"all" | "todo" | "PRESENT" | "ABSENT" | "leave" | "other">("all");
  const [statuses, setStatuses] = useState<Record<string, string>>({});
  const [normalHours, setNormalHours] = useState<Record<string, string>>({});
  const [otHours, setOtHours] = useState<Record<string, string>>({});
  const [existing, setExisting] = useState<Record<string, ExistingRow>>({});
  // Who is actually being recorded today. Nothing is saved for a worker who
  // isn't ticked: the roster lists everyone on the books, and defaulting the
  // whole list to Present marks idle workers as having worked a full day.
  const [marked, setMarked] = useState<Record<string, boolean>>({});
  /** Workers pre-set to Off because the day is their project's weekly off. */
  const [autoOff, setAutoOff] = useState<Record<string, boolean>>({});
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

  const baseRows = useMemo(
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
      // The project's weekly off is filled in for anyone with nothing recorded yet; a tap changes it.
      const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
      const nextAuto: Record<string, boolean> = {};
      const nextMarked: Record<string, boolean> = {};
      for (const e of employees) {
        if (res.rows[e.id] || !e.siteArrivalDate || date < e.siteArrivalDate || !e.weeklyOffDays.includes(weekday)) continue;
        nextStatuses[e.id] = "OFF";
        nextMarked[e.id] = true;
        nextAuto[e.id] = true;
      }
      setStatuses(nextStatuses);
      setNormalHours(nextNormal);
      setOtHours(nextOt);
      setAutoOff(nextAuto);
      setMarked(nextMarked);
    });
    // `employees` is stable for the page's life; the day or a reload is what re-reads it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const markOf = (id: string) => (isMarked(id) ? statusFor(id) : null);
  const matchesMark = (id: string, f: typeof markFilter) => {
    const m = markOf(id);
    switch (f) {
      case "all": return true;
      case "todo": return m === null;
      case "PRESENT": return m === "PRESENT";
      case "ABSENT": return m === "ABSENT";
      case "leave": return m === "LEAVE" || m === "SICK_LEAVE";
      case "other": return m === "IDLE" || m === "HOLIDAY" || m === "OFF";
    }
  };
  // What the table shows: the roster filters, then the "what has been marked" chip.
  const rows = baseRows.filter((e) => matchesMark(e.id, markFilter));

  /**
   * Attendance can't predate a worker's confirmed site arrival — checking it
   * here (rather than only after Save) means the roster shows why a name is
   * greyed out instead of silently dropping the row on submit.
   */
  function isEligible(e: EmployeeOption) {
    return !!e.siteArrivalDate && date >= e.siteArrivalDate;
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

  /** One tap on a row: that status, recorded; or null to leave the worker out of today's record. */
  function setMark(employeeId: string, status: string | null) {
    if (status) setStatuses((prev) => ({ ...prev, [employeeId]: status }));
    setMarked((prev) => ({ ...prev, [employeeId]: !!status }));
  }

  /** A public holiday or weekly off applies to everyone, so it is set once for the whole list in view. */
  function markDay(status: "HOLIDAY" | "OFF") {
    const eligibleRows = rows.filter((r) => !isLocked(r.id) && (isMarked(r.id) || isEligible(r)));
    setStatuses((prev) => {
      const next = { ...prev };
      for (const r of eligibleRows) next[r.id] = status;
      return next;
    });
    setMarked((prev) => {
      const next = { ...prev };
      for (const r of eligibleRows) next[r.id] = true;
      return next;
    });
    setNormalHours((prev) => {
      const next = { ...prev };
      for (const r of eligibleRows) next[r.id] = "";
      return next;
    });
    setOtHours((prev) => {
      const next = { ...prev };
      for (const r of eligibleRows) next[r.id] = "";
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
      const skippedNote = res.skipped?.length
        ? ` Skipped: ${res.skipped.map((s) => `${s.name} (${s.reason})`).join(", ")}.`
        : "";
      setResult(res.error || `Saved ${res.saved} of ${res.requested} rows.${skippedNote}`);
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
        <label className="w-60">
          <span className="mb-1 block text-xs font-medium text-muted">Supplier</span>
          {/* Picking a parent pulls in its subsidiaries. */}
          <MultiSelect
            values={supplierIds}
            onChange={setSupplierIds}
            noun="suppliers"
            placeholder="All suppliers"
            options={suppliers.map((sup) => ({ value: sup.id, label: sup.name, indent: !!sup.parentId }))}
          />
        </label>
      </div>

      {baseRows.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {([
            ["all", "All"],
            ["todo", "Not marked"],
            ["PRESENT", "Present"],
            ["ABSENT", "Absent"],
            ["leave", "Leave / sick"],
            ["other", "Idle / holiday / off"],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setMarkFilter(key)}
              className={cn(
                "rounded-control border px-3 py-1.5 text-xs font-medium transition",
                markFilter === key ? "border-[var(--brand-primary)] bg-brand-soft text-[var(--brand-primary)]" : "border-default bg-surface text-secondary hover:bg-surface-hover"
              )}
            >
              {label} ({baseRows.filter((r) => matchesMark(r.id, key)).length})
            </button>
          ))}
        </div>
      )}

      {baseRows.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {SUMMARY.map((t) => (
            <div key={t.label} className="card px-4 py-3">
              <p className="text-xs text-muted">{t.label}</p>
              <p className={cn("tabular text-2xl font-semibold", t.tone)}>
                {baseRows.filter((r) => isMarked(r.id) && t.statuses.includes(statusFor(r.id))).length}
              </p>
            </div>
          ))}
        </div>
      )}

      {rows.length > 0 && !allLocked && (
        <div className="card flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
          <span>Is {date} a <b>public holiday</b> or a <b>weekly off</b>?</span>
          <button type="button" onClick={() => markDay("HOLIDAY")} className="btn btn-secondary btn-sm">Mark day as Holiday</button>
          <button type="button" onClick={() => markDay("OFF")} className="btn btn-secondary btn-sm">Mark day as Weekly off</button>
          <span className="text-xs text-muted">
            Applies to the {rows.length} {rows.length === 1 ? "worker" : "workers"} shown{clientId || projectId || siteId || supplierIds.length > 0 ? "" : ". Weekly off differs by client? Filter to that client first."}
          </span>
        </div>
      )}

      <div className="card p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-baseline gap-2">
            <h2 className="text-sm font-semibold text-primary">Employees</h2>
            <span className="text-xs text-muted">
              {rows.filter((r) => isMarked(r.id)).length} of {rows.length} marked
            </span>
          </div>
          {rows.length > 0 && !allLocked && (
            <div className="flex items-center gap-2">
              <span className="hidden text-xs text-muted sm:inline">Keys: P A L S</span>
              <button type="button" onClick={markAllPresent} className="btn btn-secondary btn-sm">Mark all Present</button>
              <button type="button" onClick={clearAllMarks} className="btn btn-secondary btn-sm">Clear</button>
            </div>
          )}
        </div>
        {rows.length === 0 ? (
          <p className="text-sm text-muted">No employee matches these filters.</p>
        ) : (
          <div className="overflow-x-auto">
            {allLocked && (
              <p className="mb-2 text-xs font-medium text-[var(--warning)]">
                This day is approved and locked. Use &ldquo;Request correction&rdquo; to change a row.
              </p>
            )}
            <table className="w-full text-sm">
              <thead className="border-b border-default text-left text-xs font-medium tracking-wide text-muted uppercase">
                <tr>
                  <th className="px-2 py-2">Employee</th>
                  <th className="px-2 py-2">Trade</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2">Hours</th>
                  <th className="px-2 py-2">OT</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {rows.map((e) => {
                  const locked = isLocked(e.id);
                  const on = isMarked(e.id);
                  const eligible = on || isEligible(e);
                  return (
                    <tr key={e.id} className={cn(!on && !locked && "opacity-70")}>
                      <td className="px-2 py-2 text-primary">
                        <span className="inline-flex items-center gap-2 align-middle">
                          <EmployeeAvatar employeeId={e.id} name={e.name} hasPhoto={e.hasPhoto} size="xs" />
                          <span>{e.name} <span className="text-subtle">{e.employeeIdNo}</span></span>
                        </span>
                        {autoOff[e.id] && statusFor(e.id) === "OFF" && (
                          <span className="ml-1.5 text-xs text-muted" title={e.projectName ? `Weekly off for ${e.projectName}` : "No project, so Sunday"}>weekly off</span>
                        )}
                        {!eligible && (
                          <span className="ml-1.5 text-xs text-[var(--warning)]">
                            {e.siteArrivalDate ? `not yet arrived (from ${e.siteArrivalDate})` : "arrival not recorded"}
                            {!e.siteArrivalDate && (
                              <>
                                {" "}
                                <Link href="/demand/site-arrival?tab=unrecorded" className="underline" title="Mobilisation confirms when a worker reached site; attendance follows that date">mobilisation to confirm</Link>
                              </>
                            )}
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-secondary">{e.trade || "—"}</td>
                      <td className="px-2 py-2">
                        <StatusButtons name={e.name} value={on ? statusFor(e.id) : null} disabled={locked || !eligible} onChange={(v) => setMark(e.id, v)} />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          value={normalFor(e)}
                          disabled={locked || !on}
                          onChange={(ev) => setNormalHours((prev) => ({ ...prev, [e.id]: ev.target.value }))}
                          type="number"
                          min={0}
                          step="0.25"
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
                          step="0.25"
                          className="input w-20 px-2 py-1.5 disabled:opacity-50"
                        />
                      </td>
                      <td className="px-2 py-2">
                        {locked ? (
                          <button
                            type="button"
                            onClick={() => setCorrectionFor(e.id)}
                            className="text-xs font-medium text-[var(--brand-primary)] hover:underline"
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

      {result && <p role="status" className="text-sm text-secondary">{result}</p>}

      <div className="card grid gap-3 p-4 text-xs sm:grid-cols-5">
        {KEY.map((k) => (
          <div key={k.code}>
            <p className="font-semibold text-primary"><span className="mr-1.5 inline-block min-w-5 rounded bg-surface-sunken px-1.5 py-0.5 text-center">{k.code}</span>{k.name}</p>
            <p className="mt-1 text-muted">{k.text}</p>
          </div>
        ))}
      </div>

      {!allLocked && (
        <div className="sticky bottom-4 z-20 flex justify-center">
          <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-[#1e1b3a] py-2.5 pr-2.5 pl-4 text-sm text-white shadow-modal">
            <span><b>{rows.filter((r) => isMarked(r.id) && !isLocked(r.id)).length} to save</b></span>
            <button type="button" onClick={handleSave} disabled={pending || rows.length === 0} className="rounded-lg border border-white/30 px-3 py-1.5 text-xs font-medium hover:bg-white/10 disabled:opacity-50">
              {pending ? "Saving…" : "Save"}
            </button>
            {!projectId && <span className="hidden text-xs text-white/70 md:inline">Pick a project to submit its day</span>}
            <button
              type="button"
              onClick={handleApproveDay}
              disabled={pending || !projectId || rows.length === 0}
              title={projectId ? undefined : "Choose a project above to submit its day"}
              className="btn btn-primary"
            >
              Submit day (lock)
            </button>
          </div>
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
      <h3 className="mb-2 text-sm font-semibold text-primary">Request correction: {employeeName}</h3>
      {done ? (
        <p className="text-sm text-[var(--success)]">Correction request submitted for manager review.</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">Requested status</span>
              <Select value={requestedStatus} onChange={(v) => setRequestedStatus(v)} options={[{ value: "", label: "No change" }, ...STATUS_OPTIONS.map((s) => ({ value: s, label: s }))]} triggerClassName="w-full" />
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
