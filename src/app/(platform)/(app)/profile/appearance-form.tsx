"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Check, Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/cn";
import { ACCENTS, DEFAULT_PREFERENCES, DENSITIES, TEXT_SIZES, type Preferences } from "@/lib/preferences";
import { savePreferencesAction } from "./actions";

const THEME_CARDS = [
  { value: "light", label: "Light", icon: Sun, bg: "#f6f7fb", fg: "#0f172a", side: "#ffffff" },
  { value: "dark", label: "Dark", icon: Moon, bg: "#0b0d12", fg: "#f0f2f5", side: "#14161c" },
  { value: "system", label: "Match my device", icon: Monitor, bg: "linear-gradient(90deg,#f6f7fb 50%,#0b0d12 50%)", fg: "#64748b", side: "#cbd5e1" },
] as const;

const DENSITY_LABEL = { comfortable: "Comfortable", compact: "Compact" } as const;
const TEXT_LABEL = { small: "Small", normal: "Normal", large: "Large" } as const;

/** Shows a choice on the page straight away; it is only kept once the person saves. */
function preview(p: Preferences) {
  const el = document.documentElement;
  el.setAttribute("data-theme", p.theme);
  const set = (name: string, on: boolean, value: string) => (on ? el.setAttribute(name, value) : el.removeAttribute(name));
  set("data-accent", p.accent !== "purple", p.accent);
  set("data-density", p.density !== "comfortable", p.density);
  set("data-text", p.textSize !== "normal", p.textSize);
}

function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex overflow-hidden rounded-control border border-strong text-sm">
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}
          className={cn("px-4 py-2 transition", value === o.value ? "bg-brand-soft font-semibold text-brand" : "bg-surface text-secondary hover:bg-surface-hover")}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function AppearanceForm({ initial, startPages }: { initial: Preferences; startPages: { href: string; label: string }[] }) {
  const [p, setP] = useState<Preferences>(initial);
  const [saved, setSaved] = useState<Preferences>(initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const change = (patch: Partial<Preferences>) => { const next = { ...p, ...patch }; setP(next); preview(next); setMsg(null); };
  const dirty = JSON.stringify(p) !== JSON.stringify(saved);
  // Leaving the page without saving drops the preview, so a half-tried look doesn't stick to the app.
  const savedRef = useRef(saved);
  useEffect(() => { savedRef.current = saved; }, [saved]);
  useEffect(() => () => preview(savedRef.current), []);
  const accent = ACCENTS.find((a) => a.key === p.accent);
  return (
    <div className="space-y-5">
      <section className="card p-5">
        <h2 className="text-sm font-semibold text-primary">Theme</h2>
        <p className="mb-4 mt-1 text-sm text-muted">Light, dark, or follow your device.</p>
        <div role="radiogroup" aria-label="Theme" className="grid gap-3 sm:grid-cols-3">
          {THEME_CARDS.map((t) => (
            <button key={t.value} type="button" role="radio" aria-checked={p.theme === t.value} onClick={() => change({ theme: t.value })}
              className={cn("rounded-card border-2 p-2.5 text-left transition", p.theme === t.value ? "border-[var(--brand-primary)]" : "border-default hover:border-strong")}>
              <span className="flex h-20 overflow-hidden rounded-md border border-default" style={{ background: t.bg }}>
                <span className="w-[30%]" style={{ background: t.side }} />
                <span className="flex-1 space-y-1.5 p-2.5">
                  <span className="block h-2 w-3/5 rounded" style={{ background: t.fg, opacity: 0.7 }} />
                  <span className="block h-1.5 w-4/5 rounded" style={{ background: t.fg, opacity: 0.3 }} />
                  <span className="block h-1.5 w-1/2 rounded" style={{ background: t.fg, opacity: 0.3 }} />
                </span>
              </span>
              <span className="mt-2 flex items-center gap-1.5 text-sm font-medium text-primary"><t.icon className="h-3.5 w-3.5" aria-hidden />{t.label}{p.theme === t.value && <Check className="ml-auto h-4 w-4 text-brand" aria-hidden />}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="card p-5">
        <h2 className="text-sm font-semibold text-primary">Accent colour</h2>
        <p className="mb-4 mt-1 text-sm text-muted">Buttons, links and highlights. Only you see your choice.</p>
        <div role="radiogroup" aria-label="Accent colour" className="flex flex-wrap items-center gap-3.5">
          {ACCENTS.map((a) => (
            <button key={a.key} type="button" role="radio" aria-checked={p.accent === a.key} aria-label={a.label} title={a.label} onClick={() => change({ accent: a.key })}
              className="flex h-9 w-9 items-center justify-center rounded-full text-white transition focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{ background: a.light, boxShadow: p.accent === a.key ? `0 0 0 2px var(--surface), 0 0 0 4px ${a.light}` : undefined }}>
              {p.accent === a.key && <Check className="h-4 w-4" aria-hidden />}
            </button>
          ))}
          <span className="text-sm text-muted">{accent?.label}{p.accent === "purple" ? " (the company default)" : ""}</span>
        </div>
      </section>

      <section className="card p-5">
        <h2 className="mb-4 text-sm font-semibold text-primary">Layout</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-sm font-medium text-primary">Density</p>
            <Segmented label="Density" value={p.density} options={DENSITIES.map((d) => ({ value: d, label: DENSITY_LABEL[d] }))} onChange={(density) => change({ density })} />
            <p className="mt-1.5 text-xs text-muted">Compact fits more rows on a screen.</p>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-primary">Text size</p>
            <Segmented label="Text size" value={p.textSize} options={TEXT_SIZES.map((t) => ({ value: t, label: TEXT_LABEL[t] }))} onChange={(textSize) => change({ textSize })} />
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-primary">Sidebar</p>
            <Segmented label="Sidebar" value={p.sidebar} options={[{ value: "open", label: "Always open" }, { value: "icons", label: "Icons only" }]} onChange={(sidebar) => change({ sidebar })} />
            <p className="mt-1.5 text-xs text-muted">Applies the next time a page loads.</p>
          </div>
          <div>
            <label htmlFor="start-page" className="mb-2 block text-sm font-medium text-primary">Start page</label>
            <select id="start-page" value={p.startPage} onChange={(e) => change({ startPage: e.target.value })} className="input h-9 w-full max-w-60 text-sm">
              {startPages.map((s) => <option key={s.href} value={s.href}>{s.label}</option>)}
            </select>
            <p className="mt-1.5 text-xs text-muted">Where you land after signing in.</p>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn btn-primary" disabled={pending || !dirty} onClick={() => start(async () => {
          const r = await savePreferencesAction(p);
          if (r.error) setMsg({ ok: false, text: r.error });
          else { setSaved(p); window.dispatchEvent(new CustomEvent("theme-changed", { detail: p.theme })); setMsg({ ok: true, text: "Saved. It is applied on each device when you sign in." }); }
        })}>{pending ? "Saving…" : "Save"}</button>
        <button type="button" className="btn btn-secondary" disabled={pending} onClick={() => change({ ...DEFAULT_PREFERENCES, startPage: p.startPage })}>Back to the defaults</button>
        {dirty && !msg && <span className="text-sm text-muted">Previewing. Save to keep it.</span>}
        {msg && <p role={msg.ok ? "status" : "alert"} className={cn("text-sm", msg.ok ? "text-success" : "text-error")}>{msg.text}</p>}
      </div>
    </div>
  );
}
