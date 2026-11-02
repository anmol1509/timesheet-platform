"use client";

import { useActionState, useMemo, useState } from "react";
import { Bookmark, BookmarkCheck, CalendarDays, FileUp, Loader2, Plus, ScanLine, Split, Trash2, UsersRound, Wand2 } from "lucide-react";
import { cleanDayValue, matchRoster, type ReadTimesheetRow } from "@/lib/timesheetRead";
import { ExportMenu, type ExportFormat } from "@/components/ExportMenu";
import { downloadXlsx, parseSpreadsheetFile } from "@/lib/spreadsheet";
import { downloadCsv } from "@/lib/csv";
import { csvCell } from "@/lib/csvExport";
import { gridHeaders, gridToCells, parseGridRecords } from "@/lib/timesheetGrid";
import { shrinkImage } from "@/lib/compressImage";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from "@/lib/constants";
import { Dialog, DialogClose, DialogContent, DialogFooter } from "@/components/ui/Dialog";
import { submitManualEntryAction } from "../actions";
import { Select } from "@/components/ui/Select";
import { Combobox } from "@/components/ui/Combobox";
import { MonthInput } from "@/components/ui/MonthInput";

import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/Alert";
type RowState = {
  id: string;
  employeeIdNo: string;
  employeeName: string;
  trade: string;
  rate: string;
  supplierName: string;
  clientName: string;
  days: string[];
  /** This worker's weekly day off (JS weekday "0"-"6", "none"), or "" to use the default above the table. */
  weekOff: string;
  /** Keep this rate as the client's rate for this trade (saved with the timesheet). */
  remember: boolean;
  /** The project the worker is on now, used for their rate when no project is chosen for the whole sheet. */
  projectId: string;
};

function currentMonthValue() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function daysInMonth(month: string) {
  const [y, m] = month.split("-").map(Number);
  if (!y || !m) return 30;
  return new Date(y, m, 0).getDate();
}

function blankRow(dayCount: number): RowState {
  return {
    id: crypto.randomUUID(),
    employeeIdNo: "",
    employeeName: "",
    trade: "",
    rate: "",
    supplierName: "",
    clientName: "",
    days: Array(dayCount).fill(""),
    weekOff: "",
    remember: false,
    projectId: "",
  };
}

type ProjectOption = { id: string; code: string; name: string; clientName: string };
type RosterPerson = { projectId: string; employeeIdNo: string; name: string; trade: string; supplierName: string; nationality: string; projectName: string; clientName: string; onWork: boolean };
type RateOption = { client: string; projectId: string | null; trade: string; rate: number };
const WEEKDAYS = [["0", "Sunday"], ["1", "Monday"], ["2", "Tuesday"], ["3", "Wednesday"], ["4", "Thursday"], ["5", "Friday"], ["6", "Saturday"]] as const;
const WD_SHORT = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
type SiteOption = { id: string; name: string; projectId: string };

export function ManualEntryForm({
  supplierNames,
  clientNames,
  projects,
  sites,
  roster,
  rates,
}: {
  supplierNames: string[];
  clientNames: string[];
  projects: ProjectOption[];
  sites: SiteOption[];
  roster: RosterPerson[];
  rates: RateOption[];
}) {
  const [state, formAction, pending] = useActionState(submitManualEntryAction, {
    error: null,
  });
  const [month, setMonth] = useState(currentMonthValue());
  const [projectId, setProjectId] = useState("");
  const [siteId, setSiteId] = useState("");
  const siteOptions = sites
    .filter((s) => s.projectId === projectId)
    .map((s) => ({ value: s.id, label: s.name }));
  const dayCount = useMemo(() => daysInMonth(month), [month]);
  const [rows, setRows] = useState<RowState[]>(() => [blankRow(dayCount)]);

  function updateMonth(next: string) {
    setMonth(next);
    setHolidays(new Set()); // holidays are days of one month
    const nextDayCount = daysInMonth(next);
    setRows((prev) =>
      prev.map((r) => ({
        ...r,
        days: Array.from({ length: nextDayCount }, (_, i) => r.days[i] || ""),
      }))
    );
  }

  function updateRow(id: string, patch: Partial<RowState>) {
    setAckNoRate(false);
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function updateDay(id: string, dayIndex: number, value: string) {
    setAckNoRate(false);
    setRows((prev) =>
      prev.map((r) =>
        r.id === id
          ? { ...r, days: r.days.map((d, i) => (i === dayIndex ? value : d)) }
          : r
      )
    );
  }

  function addRow() {
    setRows((prev) => [...prev, blankRow(dayCount)]);
  }

  /** A worker on one trade for some days and another for the rest: a second row for them, with the days they do the other trade. */
  function splitRow(id: string) {
    setRows((prev) => {
      const i = prev.findIndex((r) => r.id === id);
      if (i < 0) return prev;
      const r = prev[i];
      const next: RowState = { ...blankRow(dayCount), employeeIdNo: r.employeeIdNo, employeeName: r.employeeName, supplierName: r.supplierName, clientName: r.clientName, projectId: r.projectId, weekOff: r.weekOff };
      return [...prev.slice(0, i + 1), next, ...prev.slice(i + 1)];
    });
  }

  // The same worker on two rows with hours on the same day would be paid and billed twice.
  const doubleBooked = useMemo(() => {
    const out = new Set<string>();
    const byWorker = new Map<string, RowState[]>();
    for (const r of rows) { const k = r.employeeIdNo.trim().toLowerCase(); if (k) byWorker.set(k, [...(byWorker.get(k) ?? []), r]); }
    for (const list of byWorker.values()) {
      if (list.length < 2) continue;
      for (let d = 0; d < dayCount; d++) {
        const worked = list.filter((r) => /^\d/.test((r.days[d] ?? "").trim()) && Number(r.days[d]) > 0);
        if (worked.length > 1) for (const r of worked) out.add(`${r.id}:${d}`);
      }
    }
    return out;
  }, [rows, dayCount]);

  // ---- Keyboard: move around the days, type A or O for absent / off, copy from above or the left, paste a block from Excel ----
  function focusCell(r: number, d: number) {
    const el = document.querySelector<HTMLInputElement>(`[data-cell="${r}:${d}"]`);
    if (el) { el.focus(); el.select(); }
  }
  function setCell(r: number, d: number, value: string) {
    setAckNoRate(false);
    setRows((prev) => prev.map((row, i) => (i === r ? { ...row, days: row.days.map((v, j) => (j === d ? value : v)) } : row)));
  }
  function onDayKeyDown(e: React.KeyboardEvent<HTMLInputElement>, r: number, d: number) {
    const lastRow = rows.length - 1;
    const go = (nr: number, nd: number) => { e.preventDefault(); focusCell(Math.max(0, Math.min(nr, lastRow)), Math.max(0, Math.min(nd, dayCount - 1))); };
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); e.currentTarget.form?.requestSubmit(); return; }
    if ((e.ctrlKey || e.metaKey) && (e.key === "d" || e.key === "D")) { e.preventDefault(); if (r > 0) { setCell(r, d, rows[r - 1].days[d] ?? ""); focusCell(Math.min(r + 1, lastRow), d); } return; }
    if ((e.ctrlKey || e.metaKey) && (e.key === "r" || e.key === "R")) { e.preventDefault(); if (d > 0) { setCell(r, d, rows[r].days[d - 1] ?? ""); focusCell(r, Math.min(d + 1, dayCount - 1)); } return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    switch (e.key) {
      case "ArrowDown": return go(r + 1, d);
      case "ArrowUp": return go(r - 1, d);
      case "ArrowRight": return go(r, d + 1);
      case "ArrowLeft": return go(r, d - 1);
      case "Enter": return go(e.shiftKey ? r - 1 : r + 1, d);
      case "Home": return go(r, 0);
      case "End": return go(r, dayCount - 1);
    }
    // A = absent, O = off: set and step to the next day.
    if (e.key.length === 1 && /[aA]/.test(e.key)) { e.preventDefault(); setCell(r, d, "A"); focusCell(r, Math.min(d + 1, dayCount - 1)); }
    else if (e.key.length === 1 && /[oO]/.test(e.key)) { e.preventDefault(); setCell(r, d, "OFF"); focusCell(r, Math.min(d + 1, dayCount - 1)); }
  }
  /** Pasting rows and columns copied from Excel fills a block starting at this cell; a single value pastes as usual. */
  function onDayPaste(e: React.ClipboardEvent<HTMLInputElement>, r: number, d: number) {
    const text = e.clipboardData.getData("text");
    if (!/[\t\n]/.test(text.trim())) return;
    e.preventDefault();
    const grid = text.replace(/\r/g, "").replace(/\n+$/, "").split("\n").map((line) => line.split("\t"));
    setAckNoRate(false);
    setRows((prev) => prev.map((row, i) => {
      const line = grid[i - r];
      if (!line || i < r) return row;
      return { ...row, days: row.days.map((v, j) => (j >= d && j - d < line.length ? cleanDayValue(line[j - d]) : v)) };
    }));
  }

  function removeRow(id: string) {
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : prev));
  }

  // ---- Bulk month entry: people from the roster, and a pattern for the days ----
  const [picking, setPicking] = useState(false);
  const [pickSearch, setPickSearch] = useState("");
  const [pf, setPf] = useState({ supplier: "", client: "", project: "", trade: "", nationality: "", work: "" });
  const setFilter = (k: keyof typeof pf, v: string) => setPf((f) => ({ ...f, [k]: v }));
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [hoursPerDay, setHoursPerDay] = useState("10");
  const [dayOff, setDayOff] = useState("5"); // JS weekday: 5 = Friday, 0 = Sunday, "" = none
  // Public holidays (days of the month) that are a day off for everyone.
  const [holidays, setHolidays] = useState<Set<number>>(new Set());
  const toggleHoliday = (d: number) => setHolidays((s) => { const n = new Set(s); if (n.has(d)) n.delete(d); else n.add(d); return n; });
  const weekdayOf = (d: number) => { const [y, m] = month.split("-").map(Number); return new Date(y, m - 1, d).getDay(); };
  const [onlyEmpty, setOnlyEmpty] = useState(true);
  const distinct = (get: (r: RosterPerson) => string) => [...new Set(roster.map(get).filter(Boolean))].sort((a, b) => a.localeCompare(b)).map((v) => ({ value: v, label: v }));
  const filterOptions = useMemo(() => ({
    supplier: distinct((r) => r.supplierName), client: distinct((r) => r.clientName), project: distinct((r) => r.projectName), trade: distinct((r) => r.trade), nationality: distinct((r) => r.nationality),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [roster]);
  const filtersOn = Object.values(pf).filter(Boolean).length;
  const shown = useMemo(() => {
    const q = pickSearch.trim().toLowerCase();
    return roster.filter((r) =>
      (!pf.supplier || r.supplierName === pf.supplier) && (!pf.client || r.clientName === pf.client) && (!pf.project || r.projectName === pf.project) &&
      (!pf.trade || r.trade === pf.trade) && (!pf.nationality || r.nationality === pf.nationality) &&
      (!pf.work || (pf.work === "work" ? r.onWork : !r.onWork)) &&
      (!q || r.name.toLowerCase().includes(q) || r.employeeIdNo.toLowerCase().includes(q) || r.trade.toLowerCase().includes(q)));
  }, [roster, pickSearch, pf]);
  const taken = useMemo(() => new Set(rows.map((r) => r.employeeIdNo.trim().toLowerCase()).filter(Boolean)), [rows]);
  const offered = shown.filter((r) => !taken.has(r.employeeIdNo.toLowerCase()));

  /** The client's rate for a trade: the project's own rate if it has one, else the client-wide one. */
  function rateFor(clientName: string, trade: string, project: string): string {
    const c = norm(clientName), t = norm(trade);
    if (!c) return "";
    const mine = rates.filter((r) => norm(r.client) === c && norm(r.trade) === t);
    const hit = (project && mine.find((r) => r.projectId === project)) || mine.find((r) => !r.projectId);
    if (hit) return String(hit.rate);
    // No rate for this trade: the client's general hourly rate, when it has one.
    const general = rates.find((r) => norm(r.client) === c && norm(r.trade) === "");
    return general ? String(general.rate) : "";
  }
  const projectClient = projects.find((p) => p.id === projectId)?.clientName ?? "";

  /** Fills the client and the rate where they are still empty, from the project (or the client on the row) and the row's trade. */
  function fillRates() {
    setRows((prev) => prev.map((r) => {
      const clientName = r.clientName || projectClient || roster.find((p) => p.employeeIdNo === r.employeeIdNo)?.clientName || "";
      return { ...r, clientName, rate: r.rate || rateFor(clientName, r.trade, projectId || r.projectId) };
    }));
  }

  // ---- Read a scanned sheet into the grid ----
  const [reading, setReading] = useState(false);
  const [readNote, setReadNote] = useState<{ tone: "ok" | "warn"; text: string } | null>(null);
  // Set after the missing-rate warning, so the next Save goes through; any edit asks again.
  const [ackNoRate, setAckNoRate] = useState(false);

  async function readScan(files: File[]) {
    if (files.length === 0) return;
    setReading(true);
    setReadNote(null);
    const added: RowState[] = [];
    const unmatched: string[] = [];
    let failed: string | null = null;
    for (const raw of files) {
      const file = await shrinkImage(raw);
      if (file.size > MAX_UPLOAD_BYTES) { failed = `"${file.name}" is too large: max ${MAX_UPLOAD_LABEL}.`; continue; }
      const body = new FormData();
      body.append("file", file);
      body.append("month", month);
      const res = await fetch("/api/timesheets/read", { method: "POST", body }).catch(() => null);
      const payload = res ? await res.json().catch(() => null) : null;
      if (!res?.ok || !payload) { failed = (payload && typeof payload.error === "string" && payload.error) || `"${file.name}" couldn't be read.`; continue; }
      for (const r of payload.rows as ReadTimesheetRow[]) {
        const person = matchRoster(r, roster);
        if (!person) unmatched.push(r.employeeName || r.employeeIdNo);
        const trade = person?.trade || r.trade;
        added.push({ ...blankRow(dayCount), employeeIdNo: person?.employeeIdNo ?? r.employeeIdNo, employeeName: person?.name ?? r.employeeName, trade, supplierName: person?.supplierName ?? "", clientName: projectClient, rate: rateFor(projectClient, trade, projectId), days: r.days });
      }
    }
    if (added.length > 0) {
      setRows((prev) => {
        const have = new Set(prev.map((r) => r.employeeIdNo.trim().toLowerCase()).filter(Boolean));
        const kept = prev.filter((r) => r.employeeIdNo.trim() || r.employeeName.trim() || r.days.some((d) => d.trim()));
        return [...kept, ...added.filter((r) => !r.employeeIdNo || !have.has(r.employeeIdNo.trim().toLowerCase()))];
      });
    }
    setReading(false);
    const parts = [added.length > 0 ? `Read ${added.length} ${added.length === 1 ? "row" : "rows"} into the table. Check the hours before saving.` : "", unmatched.length > 0 ? `${unmatched.length} not found on your roster (${unmatched.slice(0, 4).join(", ")}${unmatched.length > 4 ? "…" : ""}): they are added as typed and will be created on save.` : "", failed ?? ""].filter(Boolean);
    setReadNote({ tone: failed || unmatched.length > 0 ? "warn" : "ok", text: parts.join(" ") });
  }

  // ---- Export the table to a file, and import one back ----
  async function exportGrid(format: ExportFormat) {
    const headers = gridHeaders(dayCount);
    const filled = rows.filter((r) => r.employeeIdNo.trim() || r.employeeName.trim() || r.days.some((d) => d.trim()));
    const cells = gridToCells(filled, dayCount);
    const name = `timesheet-${month}`;
    if (format === "xlsx") await downloadXlsx(`${name}.xlsx`, month, headers, cells);
    else downloadCsv(`${name}.csv`, [headers, ...cells].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n");
  }

  async function importFile(files: File[]) {
    const file = files[0];
    if (!file) return;
    setReading(true);
    setReadNote(null);
    try {
      const parsed = parseGridRecords(await parseSpreadsheetFile(file), dayCount);
      if (parsed.rows.length === 0) {
        setReadNote({ tone: "warn", text: parsed.missingColumns.length > 0 ? `Nothing was imported: the file needs ${parsed.missingColumns.join(" and ")}. Use Export to get the right layout.` : "Nothing was imported: the file has no rows." });
        return;
      }
      const unmatched: string[] = [];
      const added: RowState[] = parsed.rows.map((r) => {
        const person = matchRoster({ employeeIdNo: r.employeeIdNo, employeeName: r.employeeName }, roster);
        if (!person) unmatched.push(r.employeeName || r.employeeIdNo);
        const trade = r.trade || person?.trade || "";
        const clientName = r.clientName || projectClient;
        return { ...blankRow(dayCount), employeeIdNo: person?.employeeIdNo ?? r.employeeIdNo, employeeName: person?.name ?? r.employeeName, trade, supplierName: r.supplierName || person?.supplierName || "", clientName, rate: r.rate || rateFor(clientName, trade, projectId), days: r.days };
      });
      setRows((prev) => {
        const have = new Set(prev.map((r) => r.employeeIdNo.trim().toLowerCase()).filter(Boolean));
        const kept = prev.filter((r) => r.employeeIdNo.trim() || r.employeeName.trim() || r.days.some((d) => d.trim()));
        return [...kept, ...added.filter((r) => !r.employeeIdNo || !have.has(r.employeeIdNo.trim().toLowerCase()))];
      });
      const notes = [`Imported ${added.length} ${added.length === 1 ? "row" : "rows"} for ${month}.`, unmatched.length > 0 ? `${unmatched.length} not on your roster (${unmatched.slice(0, 4).join(", ")}${unmatched.length > 4 ? "…" : ""}): added as typed and created on save.` : "", parsed.ignoredDays > 0 ? `${parsed.ignoredDays} hours in days past the end of the month were ignored.` : "", parsed.missingColumns.length > 0 ? `No ${parsed.missingColumns.join(" or ")} found.` : ""].filter(Boolean);
      setReadNote({ tone: unmatched.length > 0 || parsed.ignoredDays > 0 || parsed.missingColumns.length > 0 ? "warn" : "ok", text: notes.join(" ") });
    } catch {
      setReadNote({ tone: "warn", text: "That file couldn't be read. Use an .xlsx or .csv file from Export." });
    } finally {
      setReading(false);
    }
  }

  function addPicked() {
    const chosen = roster.filter((r) => picked.has(r.employeeIdNo) && !taken.has(r.employeeIdNo.toLowerCase()));
    setRows((prev) => {
      const kept = prev.filter((r) => r.employeeIdNo.trim() || r.employeeName.trim() || r.days.some((d) => d.trim()));
      return [...kept, ...chosen.map((e) => ({ ...blankRow(dayCount), employeeIdNo: e.employeeIdNo, employeeName: e.name, trade: e.trade, supplierName: e.supplierName, projectId: e.projectId, clientName: projectClient || e.clientName, rate: rateFor(projectClient || e.clientName, e.trade, projectId || e.projectId) }))];
    });
    setPicked(new Set());
    setPicking(false);
  }

  function fillDays() {
    const [y, m] = month.split("-").map(Number);
    const hours = hoursPerDay.trim() || "10";
    const patternFor = (off: string) => Array.from({ length: dayCount }, (_, i) => (holidays.has(i + 1) || (off !== "none" && off !== "" && new Date(y, m - 1, i + 1).getDay() === Number(off)) ? "OFF" : hours));
    setRows((prev) => prev.map((r) => (onlyEmpty && r.days.some((d) => d.trim()) ? r : { ...r, days: patternFor(r.weekOff || (dayOff === "" ? "none" : dayOff)) })));
  }

  const rowsJson = JSON.stringify(
    rows.map(({ id: _id, weekOff: _w, projectId: _p, ...rest }) => rest)
  );

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        const stop = (text: string) => { e.preventDefault(); setReadNote({ tone: "warn", text }); };
        const used = rows.filter((r) => r.employeeIdNo.trim() || r.employeeName.trim() || r.days.some((d) => d.trim()));
        const incomplete = used.findIndex((r) => !r.employeeIdNo.trim() || !r.employeeName.trim() || !r.trade.trim() || !r.supplierName.trim());
        if (incomplete >= 0) return stop(`Row ${incomplete + 1}: ID, name, trade and supplier are all needed.`);
        const seen = new Map<string, number>();
        for (const [i, r] of used.entries()) {
          const k = `${r.employeeIdNo.trim().toLowerCase()}|${r.supplierName.trim().toLowerCase()}|${r.trade.trim().toLowerCase()}`;
          if (seen.has(k)) return stop(`Rows ${(seen.get(k) ?? 0) + 1} and ${i + 1} are the same worker on the same trade, so one would replace the other. Put all that trade's days in one row, or give the second row another trade.`);
          seen.set(k, i);
        }
        if (doubleBooked.size > 0) return stop("A worker has hours on the same day in two rows (marked red). Move those hours to one row, or clear one of the days, then save.");
        const noRate = used.filter((r) => !(Number(r.rate) > 0));
        if (noRate.length > 0 && !ackNoRate) {
          setAckNoRate(true);
          return stop(`${noRate.length} ${noRate.length === 1 ? "row has" : "rows have"} no rate (${noRate.slice(0, 3).map((r) => r.employeeName || r.employeeIdNo).join(", ")}${noRate.length > 3 ? "…" : ""}), so their invoice value will be 0. Fill the rates, or press Save again to save them as they are.`);
        }
      }}
      onKeyDown={(e) => {
        // Enter in a box must not save the whole month by accident; Ctrl+Enter does.
        const t = e.target as HTMLElement;
        if (e.key === "Enter" && t.tagName === "INPUT" && !t.closest("[role=dialog]") && !(t as HTMLInputElement).dataset.cell) {
          e.preventDefault();
          if (e.ctrlKey || e.metaKey) e.currentTarget.requestSubmit();
        }
      }}
      className="space-y-4"
    >
      <input type="hidden" name="month" value={month} />
      <input type="hidden" name="rowsJson" value={rowsJson} readOnly />
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="siteId" value={siteId} />

      {state.error && (
        <Alert>
          {state.error}
        </Alert>
      )}

      <div className="card flex flex-wrap items-end justify-between gap-3 p-4">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">
            Month
          </span>
          <MonthInput value={month} onChange={(v) => updateMonth(v)} required />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">
            Project (optional: enables Approved Rates on the invoice)
          </span>
          <Select
            value={projectId}
            onChange={(v) => {
              setProjectId(v);
              setSiteId("");
            }}
            placeholder="No project"
            options={projects.map((p) => ({ value: p.id, label: `${p.code}: ${p.name}` }))}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">
            Site (optional)
          </span>
          <Select
            value={siteId}
            onChange={setSiteId}
            placeholder={projectId ? "No site" : "Select a project first"}
            disabled={!projectId}
            options={siteOptions}
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setPicking(true)} className="btn btn-primary flex gap-1.5 px-3">
            <UsersRound className="h-4 w-4" /> Add from roster
          </button>
          <label className={`btn btn-secondary flex cursor-pointer gap-1.5 px-3 ${reading ? "pointer-events-none opacity-60" : ""}`} title="Import an Excel or CSV file with one row per worker and one column per day (Export gives you the layout)">
            <FileUp className="h-4 w-4" aria-hidden /> Import file
            <input type="file" accept=".xlsx,.csv,text/csv" className="sr-only" aria-label="Choose a timesheet Excel or CSV file" disabled={reading} onChange={(e) => { void importFile([...(e.target.files ?? [])]); e.target.value = ""; }} />
          </label>
          <ExportMenu onExport={exportGrid} onError={(m) => setReadNote({ tone: "warn", text: m })} className="btn btn-secondary flex gap-1.5 px-3" />
          <label className={`btn btn-secondary flex cursor-pointer gap-1.5 px-3 ${reading ? "pointer-events-none opacity-60" : ""}`} title="Upload a photo, scan or PDF of the monthly sheet and its hours are filled in for you">
            {reading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <ScanLine className="h-4 w-4" aria-hidden />} {reading ? "Reading…" : "Read from a scan"}
            <input type="file" multiple accept="application/pdf,image/*" className="sr-only" aria-label="Choose a scanned timesheet" disabled={reading} onChange={(e) => { void readScan([...(e.target.files ?? [])]); e.target.value = ""; }} />
          </label>
          <button type="button" onClick={addRow} className="btn btn-secondary flex gap-1.5 px-3">
            <Plus className="h-4 w-4" /> Add Row
          </button>
        </div>
      </div>

      {readNote && <Alert tone={readNote.tone === "ok" ? "success" : "warning"}>{readNote.text}</Alert>}

      <div className="card flex flex-wrap items-end gap-3 p-4">
        <p className="flex w-full items-center gap-2 text-xs font-semibold tracking-wide text-muted uppercase"><Wand2 className="h-3.5 w-3.5" aria-hidden /> Fill the month</p>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">Hours on a working day</span>
          <input value={hoursPerDay} onChange={(e) => setHoursPerDay(e.target.value)} inputMode="decimal" className="input w-24" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">Weekly day off</span>
          <Select value={dayOff} onChange={setDayOff} searchable={false} options={[{ value: "5", label: "Friday" }, { value: "0", label: "Sunday" }, { value: "", label: "None" }]} />
        </label>
        <label className="flex items-center gap-2 pb-2 text-sm text-secondary">
          <input type="checkbox" checked={onlyEmpty} onChange={(e) => setOnlyEmpty(e.target.checked)} /> Only rows with no hours yet
        </label>
        <button type="button" onClick={fillDays} className="btn btn-secondary flex gap-1.5 px-3"><CalendarDays className="h-4 w-4" /> Fill the days</button>
        <button type="button" onClick={fillRates} className="btn btn-secondary flex gap-1.5 px-3" title="Fills the client and the hourly rate from the project and each row's trade, where they are empty">Fill the rates</button>
        <p className="w-full text-xs text-subtle">The weekly day off here is the default; pick another for a worker in their row. Click a day number above the grid to mark a public holiday for everyone ({holidays.size === 0 ? "none marked" : `${holidays.size} marked`}). Then change any day by hand: a different number of hours, A for absent, or OFF.</p>
      </div>

      <Dialog open={picking} onOpenChange={setPicking}>
        <DialogContent icon={<UsersRound className="h-[18px] w-[18px]" />} title="Add people from the roster" description="Tick the workers to add. Their ID, name, trade and supplier are filled in for you." className="max-w-2xl">
          <div className="mt-5 flex flex-wrap gap-2">
            <input value={pickSearch} onChange={(e) => setPickSearch(e.target.value)} placeholder="Search name, ID or trade" className="input min-w-[12rem] flex-1" />
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Select value={pf.supplier} onChange={(v) => setFilter("supplier", v)} placeholder="All suppliers" searchable options={[{ value: "", label: "All suppliers" }, ...filterOptions.supplier]} />
            <Select value={pf.client} onChange={(v) => setFilter("client", v)} placeholder="All clients" searchable options={[{ value: "", label: "All clients" }, ...filterOptions.client]} />
            <Select value={pf.project} onChange={(v) => setFilter("project", v)} placeholder="All projects" searchable options={[{ value: "", label: "All projects" }, ...filterOptions.project]} />
            <Select value={pf.trade} onChange={(v) => setFilter("trade", v)} placeholder="All trades" searchable options={[{ value: "", label: "All trades" }, ...filterOptions.trade]} />
            <Select value={pf.nationality} onChange={(v) => setFilter("nationality", v)} placeholder="All nationalities" searchable options={[{ value: "", label: "All nationalities" }, ...filterOptions.nationality]} />
            <Select value={pf.work} onChange={(v) => setFilter("work", v)} searchable={false} placeholder="On work or bench" options={[{ value: "", label: "On work or bench" }, { value: "work", label: "On work (deployed)" }, { value: "bench", label: "On bench" }]} />
          </div>
          {filtersOn > 0 && <button type="button" className="mt-2 text-xs font-medium text-[var(--brand-primary)] hover:underline" onClick={() => setPf({ supplier: "", client: "", project: "", trade: "", nationality: "", work: "" })}>Clear {filtersOn} {filtersOn === 1 ? "filter" : "filters"}</button>}
          <div className="mt-3 flex items-center justify-between text-xs">
            <span className="text-muted">{offered.length} shown{shown.length !== offered.length ? `, ${shown.length - offered.length} already in the table` : ""} · {picked.size} ticked</span>
            <button type="button" className="font-medium text-[var(--brand-primary)] hover:underline" onClick={() => setPicked((p) => (offered.every((o) => p.has(o.employeeIdNo)) ? new Set([...p].filter((id) => !offered.some((o) => o.employeeIdNo === id))) : new Set([...p, ...offered.map((o) => o.employeeIdNo)])))}>
              {offered.length > 0 && offered.every((o) => picked.has(o.employeeIdNo)) ? "Untick these" : "Tick all shown"}
            </button>
          </div>
          <ul className="mt-2 max-h-72 divide-y divide-[var(--border)] overflow-y-auto rounded-card border border-default">
            {offered.slice(0, 300).map((r) => (
              <li key={r.employeeIdNo}>
                <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-surface-hover">
                  <input type="checkbox" checked={picked.has(r.employeeIdNo)} onChange={() => setPicked((p) => { const n = new Set(p); if (n.has(r.employeeIdNo)) n.delete(r.employeeIdNo); else n.add(r.employeeIdNo); return n; })} />
                  <span className="min-w-0 flex-1 truncate text-sm text-primary">{r.name} <span className="tabular ml-1 text-xs text-subtle">{r.employeeIdNo}</span></span>
                  <span className="hidden text-xs text-muted sm:block">{r.trade || "No trade"}</span>
                  <span className="hidden w-36 truncate text-right text-xs text-subtle md:block">{r.supplierName}</span>
                </label>
              </li>
            ))}
            {offered.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted">Nobody matches.</li>}
            {offered.length > 300 && <li className="px-3 py-2 text-xs text-muted">Showing the first 300. Narrow it with the search or a supplier.</li>}
          </ul>
          <DialogFooter>
            <DialogClose asChild><Button size="btn" type="button" variant="secondary">Cancel</Button></DialogClose>
            <Button size="btn" type="button" onClick={addPicked} disabled={picked.size === 0}>Add {picked.size || ""} {picked.size === 1 ? "person" : "people"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-default bg-surface-subtle text-left text-xs font-medium tracking-wide text-muted uppercase">
            <tr>
              <th className="sticky left-0 z-10 bg-surface-subtle px-3 py-3">ID No</th>
              <th className="px-3 py-3">Employee Name</th>
              <th className="px-3 py-3">Trade</th>
              <th className="px-3 py-3">Rate</th>
              <th className="px-3 py-3">Supplier</th>
              <th className="px-3 py-3">Client</th>
              <th className="px-3 py-3">Week off</th>
              {Array.from({ length: dayCount }, (_, i) => {
                const wd = weekdayOf(i + 1);
                const off = holidays.has(i + 1);
                return (
                  <th key={i} className={`px-1 py-2 text-center normal-case ${off ? "bg-[var(--warning-soft)] text-[var(--warning)]" : wd === 5 || wd === 0 ? "text-[var(--brand-primary)]" : ""}`}>
                    <button type="button" onClick={() => toggleHoliday(i + 1)} title={off ? "Public holiday: click to undo" : "Click to mark this day as a public holiday for everyone"} className="block w-12 rounded py-0.5 hover:bg-surface-hover">
                      <span className="block text-sm">{i + 1}</span>
                      <span className="block text-[10px] font-normal tracking-normal">{WD_SHORT[wd]}</span>
                    </button>
                  </th>
                );
              })}
              <th className="px-2 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {rows.map((row, rowIdx) => (
              <tr key={row.id}>
                <td className="sticky left-0 z-10 bg-white px-3 py-2">
                  <input
                    value={row.employeeIdNo}
                    onChange={(e) =>
                      updateRow(row.id, { employeeIdNo: e.target.value })
                    }
                    placeholder="ID No"
                    className="input w-24 px-2 py-1.5"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    value={row.employeeName}
                    onChange={(e) =>
                      updateRow(row.id, { employeeName: e.target.value })
                    }
                    placeholder="Name"
                    className="input w-40 px-2 py-1.5"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    value={row.trade}
                    onChange={(e) => updateRow(row.id, { trade: e.target.value, rate: row.rate || rateFor(row.clientName || projectClient, e.target.value, projectId || row.projectId) })}
                    placeholder="Trade"
                    className="input w-28 px-2 py-1.5"
                  />
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1">
                    <input
                      value={row.rate}
                      onChange={(e) => updateRow(row.id, { rate: e.target.value, remember: false })}
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="Rate"
                      className="input w-20 px-2 py-1.5"
                    />
                    {/* Offered only for a rate the client doesn't already have for this trade. */}
                    {Number(row.rate) > 0 && row.clientName.trim() && row.trade.trim() && Number(rateFor(row.clientName, row.trade, projectId || row.projectId)) !== Number(row.rate) ? (
                      <button
                        type="button"
                        onClick={() => updateRow(row.id, { remember: !row.remember })}
                        aria-pressed={row.remember}
                        aria-label={`Remember ${row.rate} as ${row.clientName}'s rate for ${row.trade}`}
                        title={row.remember ? `Will be saved as ${row.clientName}'s rate for ${row.trade}. Click to undo.` : `Remember ${row.rate} as ${row.clientName}'s rate for ${row.trade}, so it is filled in next time`}
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition ${row.remember ? "border-[var(--brand-primary)] bg-brand-soft text-[var(--brand-primary)]" : "border-default text-subtle hover:bg-surface-hover hover:text-primary"}`}
                      >
                        {row.remember ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
                      </button>
                    ) : (
                      <span className="w-8 shrink-0" aria-hidden />
                    )}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <Combobox
                    value={row.supplierName}
                    onChange={(v) => updateRow(row.id, { supplierName: v })}
                    options={supplierNames.map((n) => ({ value: n, label: n }))}
                    placeholder="Supplier"
                    className="w-44 min-w-[11rem] px-2 py-1.5"
                  />
                </td>
                <td className="px-3 py-2">
                  <Combobox
                    value={row.clientName}
                    onChange={(v) => updateRow(row.id, { clientName: v })}
                    options={clientNames.map((n) => ({ value: n, label: n }))}
                    placeholder="Client"
                    className="w-40 min-w-[10rem] px-2 py-1.5"
                  />
                </td>
                <td className="px-3 py-2">
                  <select value={row.weekOff} onChange={(e) => updateRow(row.id, { weekOff: e.target.value })} aria-label="This worker's weekly day off" className="input w-32 px-2 py-1.5 text-xs">
                    <option value="">Same as above</option>
                    {WEEKDAYS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    <option value="none">No weekly day off</option>
                  </select>
                </td>
                {row.days.map((value, dayIndex) => {
                  const clash = doubleBooked.has(`${row.id}:${dayIndex}`);
                  const wd = weekdayOf(dayIndex + 1);
                  return (
                    <td key={dayIndex} className={`px-1 py-2 ${holidays.has(dayIndex + 1) ? "bg-[var(--warning-soft)]" : wd === 5 || wd === 0 ? "bg-[var(--brand-soft)]" : ""}`}>
                      <input
                        value={value}
                        data-cell={`${rowIdx}:${dayIndex}`}
                        onChange={(e) => updateDay(row.id, dayIndex, e.target.value)}
                        onFocus={(e) => e.currentTarget.select()}
                        onKeyDown={(e) => onDayKeyDown(e, rowIdx, dayIndex)}
                        onPaste={(e) => onDayPaste(e, rowIdx, dayIndex)}
                        placeholder="—"
                        title={clash ? "This worker has hours on this day in another trade row too" : "Hours worked, or A for absent, or OFF"}
                        className={`input w-12 px-1 py-1.5 text-center text-xs ${clash ? "border-[var(--error)] bg-[var(--error-soft)]" : ""}`}
                      />
                    </td>
                  );
                })}
                <td className="whitespace-nowrap px-2 py-2">
                  <button type="button" tabIndex={-1} onClick={() => splitRow(row.id)} className="rounded-lg p-1.5 text-subtle hover:bg-surface-hover hover:text-primary" title="The same worker on another trade for some days: adds a second row for them" aria-label="Add another trade for this worker">
                    <Split className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => removeRow(row.id)}
                    disabled={rows.length === 1}
                    className="rounded-lg p-1.5 text-subtle hover:bg-[var(--error-soft)] hover:text-[var(--error)] disabled:cursor-not-allowed disabled:opacity-30"
                    title="Remove row"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rows.some((r) => Number(r.rate) > 0 && r.clientName.trim() && r.trade.trim() && Number(rateFor(r.clientName, r.trade, projectId || r.projectId)) !== Number(r.rate)) && (
        <p className="flex items-center gap-1.5 text-xs text-muted"><Bookmark className="h-3.5 w-3.5" aria-hidden /> Click the bookmark beside a rate to keep it as that client&rsquo;s rate for the trade, so it is filled in next time.</p>
      )}
      <p className="text-xs text-subtle">
        <span className="font-medium text-muted">Keyboard:</span> Tab or → next day · ↓ or Enter next worker (Shift+Enter up) · type <kbd className="rounded border border-default px-1">A</kbd> for absent, <kbd className="rounded border border-default px-1">O</kbd> for off · Ctrl+D copies the day above, Ctrl+R the day to the left · paste a block copied from Excel · Ctrl+Enter saves.
      </p>
      <p className="text-xs text-subtle">
        Enter hours worked per day, &ldquo;A&rdquo; for absent, or leave blank
        / &ldquo;OFF&rdquo; for a day off. Employees, suppliers, and clients
        that don&rsquo;t exist yet are created automatically, same as an
        Excel upload.
      </p>

      <Button size="btn" type="submit" disabled={pending} loading={pending}>
        Save Timesheet Entries
      </Button>
    </form>
  );
}
