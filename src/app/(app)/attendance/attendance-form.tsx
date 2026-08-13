"use client";

import { useEffect, useState, useTransition } from "react";
import { Select } from "@/components/ui/Select";
import {
  markAttendanceAction,
  approveAttendanceDayAction,
  requestAttendanceCorrectionAction,
  loadDayAttendanceAction,
} from "./actions";

type Supplier = { id: string; name: string };
type EmployeeOption = {
  id: string;
  name: string;
  employeeIdNo: string;
  trade: string | null;
  supplierId: string;
  projectId: string;
  projectName: string;
};
type ExistingRow = { id: string; status: string; normalHours: number | null; otHours: number | null; locked: boolean };

const STATUS_OPTIONS = ["PRESENT", "ABSENT", "LEAVE", "HOLIDAY", "OFF"];

function todayValue() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function AttendanceForm({
  suppliers,
  employees,
}: {
  suppliers: Supplier[];
  employees: EmployeeOption[];
}) {
  const [pending, startTransition] = useTransition();
  const [supplierId, setSupplierId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [date, setDate] = useState(todayValue());
  const [statuses, setStatuses] = useState<Record<string, string>>({});
  const [normalHours, setNormalHours] = useState<Record<string, string>>({});
  const [otHours, setOtHours] = useState<Record<string, string>>({});
  const [existing, setExisting] = useState<Record<string, ExistingRow>>({});
  const [correctionFor, setCorrectionFor] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const projectOptions = [
    ...new Map(
      employees.filter((e) => e.supplierId === supplierId).map((e) => [e.projectId, e.projectName])
    ),
  ].map(([value, label]) => ({ value, label }));

  const rows = employees.filter((e) => e.supplierId === supplierId && e.projectId === projectId);

  useEffect(() => {
    if (!projectId || !date) {
      setExisting({});
      return;
    }
    const formData = new FormData();
    formData.append("date", date);
    formData.append("projectId", projectId);
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
  }, [projectId, date]);

  function selectSupplier(id: string) {
    setSupplierId(id);
    setProjectId("");
  }

  function statusFor(employeeId: string) {
    return statuses[employeeId] || "PRESENT";
  }

  function isLocked(employeeId: string) {
    return existing[employeeId]?.locked ?? false;
  }

  function markAllPresent() {
    setStatuses((prev) => {
      const next = { ...prev };
      for (const r of rows) if (!isLocked(r.id)) next[r.id] = "PRESENT";
      return next;
    });
  }

  function handleSave() {
    const rowsJson = JSON.stringify(
      rows
        .filter((e) => !isLocked(e.id))
        .map((e) => ({
          employeeId: e.id,
          status: statusFor(e.id),
          normalHours: normalHours[e.id] || "",
          otHours: otHours[e.id] || "",
        }))
    );
    const formData = new FormData();
    formData.append("date", date);
    formData.append("supplierId", supplierId);
    formData.append("projectId", projectId);
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
      <div className="grid grid-cols-1 gap-4 rounded-3xl border border-slate-200 bg-white p-5 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-500">Supplier</span>
          <Select
            value={supplierId}
            onChange={selectSupplier}
            placeholder="Select supplier"
            options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-500">Project</span>
          <Select
            value={projectId}
            onChange={setProjectId}
            placeholder={supplierId ? "Select project" : "Select a supplier first"}
            disabled={!supplierId}
            options={projectOptions}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-500">Date</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
          />
        </label>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Employees</h2>
          {rows.length > 0 && !allLocked && (
            <button
              type="button"
              onClick={markAllPresent}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              Mark all Present
            </button>
          )}
        </div>
        {!supplierId || !projectId ? (
          <p className="text-sm text-slate-500">Select a supplier and a project first.</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-slate-500">No employees for this supplier on this project.</p>
        ) : (
          <div className="overflow-x-auto">
            {allLocked && (
              <p className="mb-2 text-xs font-medium text-amber-600">
                This day is approved and locked — use &ldquo;Request correction&rdquo; to change a row.
              </p>
            )}
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 text-left text-xs font-medium tracking-wide text-slate-500 uppercase">
                <tr>
                  <th className="px-2 py-2">Employee</th>
                  <th className="px-2 py-2">Trade</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2">Normal hrs</th>
                  <th className="px-2 py-2">OT hrs</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((e) => {
                  const locked = isLocked(e.id);
                  return (
                    <tr key={e.id}>
                      <td className="px-2 py-2 text-slate-900">
                        {e.name} <span className="text-slate-400">{e.employeeIdNo}</span>
                      </td>
                      <td className="px-2 py-2 text-slate-600">{e.trade || "—"}</td>
                      <td className="px-2 py-2">
                        <select
                          value={statusFor(e.id)}
                          disabled={locked}
                          onChange={(ev) => setStatuses((prev) => ({ ...prev, [e.id]: ev.target.value }))}
                          className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-[var(--brand-primary)] disabled:opacity-50"
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
                          value={normalHours[e.id] || ""}
                          disabled={locked}
                          onChange={(ev) => setNormalHours((prev) => ({ ...prev, [e.id]: ev.target.value }))}
                          type="number"
                          min={0}
                          step="0.5"
                          className="w-20 rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-[var(--brand-primary)] disabled:opacity-50"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          value={otHours[e.id] || ""}
                          disabled={locked}
                          onChange={(ev) => setOtHours((prev) => ({ ...prev, [e.id]: ev.target.value }))}
                          type="number"
                          min={0}
                          step="0.5"
                          className="w-20 rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-[var(--brand-primary)] disabled:opacity-50"
                        />
                      </td>
                      <td className="px-2 py-2">
                        {locked && (
                          <button
                            type="button"
                            onClick={() => setCorrectionFor(e.id)}
                            className="text-xs font-medium text-blue-600 hover:underline"
                          >
                            Request correction
                          </button>
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

      {result && <p className="text-sm text-slate-600">{result}</p>}

      {!allLocked && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={pending || !supplierId || !projectId || rows.length === 0}
            className="rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--brand-primary-hover)] disabled:opacity-50"
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
    <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-4">
      <h3 className="mb-2 text-sm font-semibold text-slate-900">Request correction — {employeeName}</h3>
      {done ? (
        <p className="text-sm text-emerald-600">Correction request submitted for manager review.</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-500">Requested status</span>
              <select
                value={requestedStatus}
                onChange={(e) => setRequestedStatus(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-[var(--brand-primary)]"
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
              <span className="mb-1 block text-xs font-medium text-slate-500">Normal hrs</span>
              <input
                value={requestedNormalHours}
                onChange={(e) => setRequestedNormalHours(e.target.value)}
                type="number"
                className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-[var(--brand-primary)]"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-500">OT hrs</span>
              <input
                value={requestedOtHours}
                onChange={(e) => setRequestedOtHours(e.target.value)}
                type="number"
                className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-[var(--brand-primary)]"
              />
            </label>
          </div>
          <label className="mt-3 block">
            <span className="mb-1 block text-xs font-medium text-slate-500">Reason</span>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason for correction"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
            />
          </label>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={pending || !reason.trim()}
              onClick={submit}
              className="rounded-lg bg-[var(--brand-primary)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--brand-primary-hover)] disabled:opacity-50"
            >
              {pending ? "Submitting…" : "Submit request"}
            </button>
            <button type="button" onClick={onClose} className="text-xs font-medium text-slate-400 hover:underline">
              Cancel
            </button>
          </div>
        </>
      )}
    </div>
  );
}
