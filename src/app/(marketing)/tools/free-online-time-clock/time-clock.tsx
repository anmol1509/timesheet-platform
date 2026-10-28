"use client";

import { useEffect, useMemo, useState } from "react";
import s from "../calculator.module.css";
import { Field } from "../calc-ui";

type Entry = { id: string; start: number; end: number; note: string };
type Running = { start: number; note: string } | null;

const STORE = "manpowersync.timeclock.v1";

const hms = (ms: number) => {
  const t = Math.max(0, Math.floor(ms / 1000));
  return [Math.floor(t / 3600), Math.floor((t % 3600) / 60), t % 60].map((n) => String(n).padStart(2, "0")).join(":");
};
const hoursOf = (ms: number) => Math.round((ms / 3_600_000) * 100) / 100;
const dayKey = (t: number) => new Date(t).toLocaleDateString("en-CA");
const dayLabel = (t: number) => new Date(t).toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
const timeLabel = (t: number) => new Date(t).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

/** A punch clock that lives in the browser: entries are kept in this device's local storage and are never uploaded. */
export function TimeClock() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [running, setRunning] = useState<Running>(null);
  const [note, setNote] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE) ?? "null");
      if (saved?.entries) setEntries(saved.entries);
      if (saved?.running) setRunning(saved.running);
    } catch {
      /* private mode or corrupt data: start empty */
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORE, JSON.stringify({ entries, running }));
    } catch {
      /* storage unavailable: the clock still works for this visit */
    }
  }, [entries, running, loaded]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const byDay = useMemo(() => {
    const map = new Map<string, Entry[]>();
    for (const e of [...entries].sort((a, b) => b.start - a.start)) {
      const k = dayKey(e.start);
      map.set(k, [...(map.get(k) ?? []), e]);
    }
    return [...map.entries()];
  }, [entries]);

  const totalMs = entries.reduce((sum, e) => sum + (e.end - e.start), 0);
  const todayMs = entries.filter((e) => dayKey(e.start) === dayKey(now)).reduce((sum, e) => sum + (e.end - e.start), 0) + (running ? now - running.start : 0);

  function clockIn() {
    setRunning({ start: Date.now(), note: note.trim() });
    setNote("");
  }
  function clockOut() {
    if (!running) return;
    const end = Date.now();
    setEntries((list) => [...list, { id: `${running.start}`, start: running.start, end, note: running.note }]);
    setRunning(null);
  }
  function remove(id: string) {
    setEntries((list) => list.filter((e) => e.id !== id));
  }
  function clearAll() {
    if (window.confirm("Delete every saved entry on this device?")) {
      setEntries([]);
      setRunning(null);
    }
  }
  function download() {
    const rows = [["Date", "Clock in", "Clock out", "Hours", "Note"]];
    for (const e of [...entries].sort((a, b) => a.start - b.start)) {
      rows.push([dayKey(e.start), timeLabel(e.start), timeLabel(e.end), String(hoursOf(e.end - e.start)), e.note]);
    }
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "time-clock-entries.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className={s.layout}>
      <div className={s.panel}>
        <h2 className={s.panelTitle}>{running ? "Clocked in" : "Ready to clock in"}</h2>
        <p className={s.panelHint}>{running ? `Since ${timeLabel(running.start)}${running.note ? ` · ${running.note}` : ""}` : "Press clock in when you start, and clock out when you finish."}</p>
        <p className={s.clockFace} aria-live="off">{running ? hms(now - running.start) : hms(0)}</p>
        {!running && (
          <Field id="note" label="Note (optional)" hint="For example the site, task or client.">
            <input id="note" className={s.input} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Site A, shuttering" autoComplete="off" />
          </Field>
        )}
        <div className={s.actions}>
          {running ? (
            <button type="button" className={`${s.clockBtn} ${s.clockBtnOut}`} onClick={clockOut}>Clock out</button>
          ) : (
            <button type="button" className={s.clockBtn} onClick={clockIn}>Clock in</button>
          )}
        </div>
        <p className={s.privacy}>Saved on this device only. Nothing is uploaded, and clearing your browser data removes it.</p>
      </div>

      <div className={`${s.panel} ${s.result}`}>
        <h2 className={s.panelTitle}>Hours so far</h2>
        <p className={s.big}>{hoursOf(totalMs + (running ? now - running.start : 0)).toFixed(2)} h</p>
        <p className={s.bigLabel}>total, of which {hoursOf(todayMs).toFixed(2)} h today</p>

        {byDay.length === 0 ? (
          <p className={s.note}>No entries yet. Your clocked sessions will be listed here by day.</p>
        ) : (
          <div className={s.tableWrap}>
            <table className={s.listTable}>
              <thead>
                <tr><th>Day</th><th>In</th><th>Out</th><th>Hours</th><th /></tr>
              </thead>
              <tbody>
                {byDay.map(([k, list]) =>
                  list.map((e, i) => (
                    <tr key={e.id}>
                      <td>{i === 0 ? dayLabel(e.start) : ""}</td>
                      <td>{timeLabel(e.start)}</td>
                      <td>{timeLabel(e.end)}</td>
                      <td>{hoursOf(e.end - e.start).toFixed(2)}{e.note ? <small style={{ display: "block" }}>{e.note}</small> : null}</td>
                      <td><button type="button" className={s.linkBtn} onClick={() => remove(e.id)} aria-label={`Delete the entry on ${k} at ${timeLabel(e.start)}`}>Delete</button></td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>
        )}

        {entries.length > 0 && (
          <div className={s.actions}>
            <button type="button" className={s.linkBtn} onClick={download}>Download as CSV</button>
            <button type="button" className={s.linkBtn} onClick={clearAll}>Clear all</button>
          </div>
        )}
      </div>
    </div>
  );
}
