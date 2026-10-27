"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/cn";
import { EMAIL_CATEGORIES, PAUSE_CHOICES, SUMMARY_HOUR, isPaused, type Delivery, type EmailPrefs } from "@/lib/emailPrefs";
import { saveEmailPrefsAction, sendTestEmailAction } from "../notifications/actions";

const HOURS = Array.from({ length: 24 }, (_, h) => ({ value: h, label: `${h % 12 === 0 ? 12 : h % 12}:00 ${h < 12 ? "AM" : "PM"}` }));
const CHOICES: { value: Delivery; label: string }[] = [{ value: "INSTANT", label: "Instant" }, { value: "SUMMARY", label: "Daily summary" }, { value: "OFF", label: "Off" }];
const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Dubai" });
const hourLabel = (h: number) => HOURS[h].label;

function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className={cn("relative h-[26px] w-11 shrink-0 rounded-full transition", on ? "bg-[var(--brand-primary)]" : "bg-[#c9cbdb]")}>
      <span className={cn("absolute top-[3px] h-5 w-5 rounded-full bg-white shadow transition-all", on ? "left-[21px]" : "left-[3px]")} />
    </button>
  );
}

/** Which emails to get, and when. In-app notifications are not affected. */
export function NotificationSettings({ initial, email }: { initial: EmailPrefs; email: string }) {
  const [prefs, setPrefs] = useState<EmailPrefs>(initial);
  const [saved, setSaved] = useState<EmailPrefs>(initial);
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const dirty = JSON.stringify(prefs) !== JSON.stringify(saved);
  const paused = isPaused(prefs, new Date());
  const set = (patch: Partial<EmailPrefs>) => { setPrefs((p) => ({ ...p, ...patch })); setMsg(null); };

  function save() {
    setMsg(null);
    start(async () => {
      const r = await saveEmailPrefsAction(prefs);
      if (r.error || !r.prefs) { setMsg({ tone: "error", text: r.error ?? "Couldn't save." }); return; }
      setPrefs(r.prefs); setSaved(r.prefs); setMsg({ tone: "ok", text: "Saved." });
    });
  }
  function test() {
    setMsg(null);
    start(async () => {
      const r = await sendTestEmailAction();
      setMsg(r.error ? { tone: "error", text: r.error } : { tone: "ok", text: `Test email sent to ${email}.` });
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-primary">Email notifications</h2>
          <p className="mt-1 text-sm text-muted">In-app notifications are always on. Choose which emails you get, and when.</p>
        </div>
        <label className="flex items-center gap-3 text-sm font-semibold text-primary">Email me <Switch on={prefs.enabled} onChange={(v) => set({ enabled: v })} label="Email me" /></label>
      </div>

      {!prefs.enabled && <p className="rounded-lg bg-surface-sunken px-4 py-3 text-sm text-secondary">Emails are off. You will still see everything in the app, and you will still get security emails.</p>}

      <div className={cn("grid gap-3 sm:grid-cols-2", !prefs.enabled && "pointer-events-none opacity-50")}>
        <div className="rounded-2xl border border-default p-4">
          <p className="text-xs text-muted">Daily summary arrives at</p>
          <p className="mt-1 font-semibold text-primary">{hourLabel(SUMMARY_HOUR)} <span className="font-normal text-muted">UAE time, every morning</span></p>
          <p className="mt-1 text-xs text-muted">The time is fixed for now.</p>
        </div>
        <div className="rounded-2xl border border-default p-4">
          <label className="flex items-center justify-between gap-3 text-xs text-muted">Quiet hours<Switch on={prefs.quiet.enabled} onChange={(v) => set({ quiet: { ...prefs.quiet, enabled: v } })} label="Quiet hours" /></label>
          {prefs.quiet.enabled ? (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              <select aria-label="Quiet hours start" className="input h-9 w-28 text-sm" value={prefs.quiet.from} onChange={(e) => set({ quiet: { ...prefs.quiet, from: Number(e.target.value) } })}>{HOURS.map((h) => <option key={h.value} value={h.value}>{h.label}</option>)}</select>
              <span className="text-muted">to</span>
              <select aria-label="Quiet hours end" className="input h-9 w-28 text-sm" value={prefs.quiet.to} onChange={(e) => set({ quiet: { ...prefs.quiet, to: Number(e.target.value) } })}>{HOURS.map((h) => <option key={h.value} value={h.value}>{h.label}</option>)}</select>
              <p className="w-full text-xs text-muted">Emails that would arrive then wait for the morning summary. Security emails still come straight away.</p>
            </div>
          ) : <p className="mt-1 text-sm text-secondary">Off. Emails can arrive at any hour.</p>}
        </div>
        <div className="rounded-2xl border border-default p-4">
          <label className="block text-xs text-muted">Weekends (Saturday and Sunday)
            <select className="input mt-1 h-9 w-full text-sm" value={prefs.weekends} onChange={(e) => set({ weekends: e.target.value === "HOLD" ? "HOLD" : "SEND" })}>
              <option value="SEND">Send as usual</option>
              <option value="HOLD">Hold until Monday</option>
            </select>
          </label>
        </div>
        <div className="rounded-2xl border border-default p-4">
          <label className="block text-xs text-muted">Pause all emails
            <select className="input mt-1 h-9 w-full text-sm" value={paused ? "keep" : "0"} onChange={(e) => { const h = Number(e.target.value); if (e.target.value !== "keep") set({ pausedUntil: h > 0 ? new Date(Date.now() + h * 3_600_000).toISOString() : null }); }}>
              {paused && prefs.pausedUntil && <option value="keep">Paused until {when(prefs.pausedUntil)}</option>}
              {PAUSE_CHOICES.map((c) => <option key={c.hours} value={c.hours}>{c.label}</option>)}
            </select>
          </label>
          {paused && <button type="button" className="mt-2 text-xs font-medium text-[var(--brand-primary)] hover:underline" onClick={() => set({ pausedUntil: null })}>Resume now</button>}
        </div>
      </div>

      <div className={cn(!prefs.enabled && "opacity-60")}>
        <p className="mb-1 text-xs font-semibold tracking-wide text-muted uppercase">What to email me about</p>
        <ul>
          {EMAIL_CATEGORIES.map((c) => {
            const locked = !!c.locked;
            const value = locked ? "INSTANT" : prefs.categories[c.id];
            return (
              <li key={c.id} className="flex flex-wrap items-center gap-4 border-t border-default py-4 first:border-t-0">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--brand-primary-soft)] text-lg" aria-hidden>{c.icon}</span>
                <div className="min-w-[14rem] flex-1">
                  <p className="font-semibold text-primary">{c.label}</p>
                  <p className="text-sm text-muted">{c.description}</p>
                  {c.note && <p className="text-xs text-muted">{c.note}</p>}
                </div>
                {locked ? (
                  <span className="rounded-lg bg-surface-sunken px-3 py-2 text-sm font-medium text-secondary">Always instant</span>
                ) : (
                  <div role="radiogroup" aria-label={c.label} className="flex gap-0.5 rounded-xl bg-surface-sunken p-1">
                    {CHOICES.map((o) => (
                      <button key={o.value} type="button" role="radio" aria-checked={value === o.value} onClick={() => set({ categories: { ...prefs.categories, [c.id]: o.value } })} className={cn("rounded-lg px-3.5 py-1.5 text-sm transition", value === o.value ? "bg-surface font-semibold text-[var(--brand-primary)] shadow-sm" : "text-muted hover:text-primary")}>{o.label}</button>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-default pt-5">
        <button type="button" className="btn btn-primary" disabled={pending || !dirty} onClick={save}>{pending ? "Working…" : "Save"}</button>
        <button type="button" className="btn btn-secondary" disabled={pending} onClick={test}>Send me a test email</button>
        {msg && <p role={msg.tone === "error" ? "alert" : "status"} className={cn("text-sm", msg.tone === "error" ? "text-[var(--error)]" : "text-[var(--success)]")}>{msg.text}</p>}
        <p className="ml-auto text-xs text-muted">Emails go to {email}</p>
      </div>
      {dirty && <p className="text-xs text-muted">You have changes that are not saved yet.</p>}
    </div>
  );
}
