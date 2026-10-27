"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Check, Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/cn";
import { ACCENTS, BACKGROUNDS, CORNERS, DEFAULT_PREFERENCES, DENSITIES, FONTS, HEX_RE, LAYOUTS, NAV_STYLES, TEXT_SIZES, htmlAttributes, htmlStyle, type Preferences } from "@/lib/preferences";
import { saveCompanyLookAction, savePreferencesAction } from "./actions";

const THEME_CARDS = [
  { value: "light", label: "Light", icon: Sun, bg: "#f6f7fb", fg: "#0f172a", side: "#ffffff" },
  { value: "dark", label: "Dark", icon: Moon, bg: "#0b0d12", fg: "#f0f2f5", side: "#14161c" },
  { value: "system", label: "Match my device", icon: Monitor, bg: "linear-gradient(90deg,#f6f7fb 50%,#0b0d12 50%)", fg: "#64748b", side: "#cbd5e1" },
] as const;

const DENSITY_LABEL = { comfortable: "Comfortable", compact: "Compact" } as const;
const TEXT_LABEL = { small: "Small", normal: "Normal", large: "Large" } as const;

const MANAGED = ["data-accent", "data-density", "data-text", "data-navstyle", "data-font", "data-bg", "data-corners", "data-motion", "data-contrast"];

/** Shows a choice on the page straight away; it is only kept once the person saves. */
function preview(p: Preferences) {
  const el = document.documentElement;
  const attrs = htmlAttributes(p);
  el.setAttribute("data-theme", p.theme);
  for (const name of MANAGED) (attrs[name] ? el.setAttribute(name, attrs[name]) : el.removeAttribute(name));
  const style = htmlStyle(p);
  if (style) el.style.setProperty("--accent", style["--accent"]);
  else el.style.removeProperty("--accent");
  window.dispatchEvent(new CustomEvent("layout-preview", { detail: p.layout }));
  window.dispatchEvent(new CustomEvent("autohide-preview", { detail: p.autoHide }));
}

const NAV_SWATCH: Record<(typeof NAV_STYLES)[number]["key"], string> = {
  glass: "linear-gradient(180deg,rgba(255,255,255,.9),rgba(255,255,255,.6))",
  flat: "#ffffff",
  dark: "#15171d",
  brand: "linear-gradient(160deg,var(--brand-primary),color-mix(in srgb,var(--brand-primary) 75%,black))",
};

function Toggle({ label, hint, checked, disabled, onChange }: { label: string; hint: string; checked: boolean; disabled?: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className={cn("flex items-start gap-3 text-sm", disabled && "opacity-50")}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--brand-primary)]" />
      <span><span className="font-medium text-primary">{label}</span><span className="block text-xs text-muted">{hint}</span></span>
    </label>
  );
}

/** A tiny drawing of each menu layout, for the picker. */
function LayoutThumb({ k }: { k: (typeof LAYOUTS)[number]["key"] }) {
  const bar = "rounded-sm bg-[var(--text-subtle,#94a3b8)] opacity-40";
  const side = "rounded-md bg-[var(--brand-primary)] opacity-25";
  const rows = (n: number) => Array.from({ length: n }, (_, i) => <span key={i} className={cn("block h-1 w-full", bar)} />);
  const body = <span className="flex-1 space-y-1 p-1.5"><span className={cn("block h-1.5 w-2/5", bar)} /><span className={cn("block h-6 w-full", bar)} /></span>;
  return (
    <span className="flex h-20 flex-col overflow-hidden rounded-md border border-default bg-canvas p-1">
      {k === "topbar" && <span className="mb-1 flex h-3 shrink-0 items-center gap-1 rounded-md bg-[var(--brand-primary)]/25 px-1"><span className={cn("h-1 w-4", bar)} /><span className={cn("h-1 w-4", bar)} /><span className={cn("h-1 w-4", bar)} /></span>}
      <span className="flex min-h-0 flex-1 gap-1">
        {k === "classic" && <span className={cn("flex w-[30%] flex-col gap-1 p-1", side)}>{rows(5)}</span>}
        {k === "rail" && <span className={cn("flex w-[12%] flex-col items-center gap-1 p-1", side)}>{rows(5)}</span>}
        {k === "search" && <span className={cn("flex w-[30%] flex-col gap-1 p-1", side)}><span className="block h-2 w-full rounded-sm bg-white/70" />{rows(4)}</span>}
        {k === "twolevel" && <><span className={cn("flex w-[12%] flex-col items-center gap-1 p-1", side)}>{rows(4)}</span><span className={cn("flex w-[22%] flex-col gap-1 p-1", side)}>{rows(4)}</span></>}
        {k === "tabs" && <span className={cn("flex w-[24%] flex-col gap-1 p-1", side)}>{rows(5)}</span>}
        <span className="flex min-w-0 flex-1 flex-col">
          {k === "tabs" && <span className="flex h-2.5 shrink-0 gap-1 border-b border-default"><span className="h-1 w-4 rounded-sm bg-[var(--brand-primary)]" /><span className={cn("h-1 w-4", bar)} /><span className={cn("h-1 w-4", bar)} /></span>}
          {body}
        </span>
      </span>
    </span>
  );
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

export function AppearanceForm({ initial, startPages, companyDefault, canSetCompanyDefault }: { initial: Preferences; startPages: { href: string; label: string }[]; companyDefault: Preferences | null; canSetCompanyDefault: boolean }) {
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
  const [company, setCompany] = useState<Preferences | null>(companyDefault);
  const hasHex = HEX_RE.test(p.accentHex);
  const autoHideApplies = p.layout === "classic" || p.layout === "search" || p.layout === "tabs";
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
            <button key={a.key} type="button" role="radio" aria-checked={!hasHex && p.accent === a.key} aria-label={a.label} title={a.label} onClick={() => change({ accent: a.key, accentHex: "" })}
              className="flex h-9 w-9 items-center justify-center rounded-full text-white transition focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{ background: a.light, boxShadow: !hasHex && p.accent === a.key ? `0 0 0 2px var(--surface), 0 0 0 4px ${a.light}` : undefined }}>
              {!hasHex && p.accent === a.key && <Check className="h-4 w-4" aria-hidden />}
            </button>
          ))}
          <label className="flex items-center gap-2 text-sm text-secondary">
            <span className="sr-only">Own colour</span>
            <input type="color" aria-label="Pick your own colour" value={hasHex ? p.accentHex : "#5645d4"} onChange={(e) => change({ accentHex: e.target.value })} className="h-9 w-9 cursor-pointer rounded-full border border-default bg-transparent p-0.5" />
            <input type="text" inputMode="text" aria-label="Own colour as a hex code" placeholder="#5645d4" maxLength={7} value={p.accentHex} onChange={(e) => change({ accentHex: e.target.value.trim() })}
              className={cn("input h-9 w-28 font-mono text-sm", p.accentHex && !hasHex && "border-[var(--error)]")} />
          </label>
          <span className="text-sm text-muted">{hasHex ? "Your own colour" : accent?.label}{!hasHex && p.accent === "purple" ? " (the standard colour)" : ""}</span>
        </div>
        <p className="mt-3 text-xs text-muted">The glow behind the app follows this colour. Very light colours make white text hard to read, so pick a mid or dark one.</p>
      </section>

      <section className="card p-5">
        <h2 className="text-sm font-semibold text-primary">Menu layout</h2>
        <p className="mb-4 mt-1 text-sm text-muted">How the menu is arranged on a computer. On a phone the menu always slides in from the side.</p>
        <div role="radiogroup" aria-label="Menu layout" className="grid gap-3 sm:grid-cols-3">
          {LAYOUTS.map((l) => (
            <button key={l.key} type="button" role="radio" aria-checked={p.layout === l.key} onClick={() => change({ layout: l.key })}
              className={cn("rounded-card border-2 p-2.5 text-left transition", p.layout === l.key ? "border-[var(--brand-primary)]" : "border-default hover:border-strong")}>
              <LayoutThumb k={l.key} />
              <span className="mt-2 flex items-center gap-1.5 text-sm font-medium text-primary">{l.label}{p.layout === l.key && <Check className="ml-auto h-4 w-4 text-brand" aria-hidden />}</span>
              <span className="block text-xs text-muted">{l.hint}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="card p-5">
        <h2 className="text-sm font-semibold text-primary">Menu colour</h2>
        <p className="mb-4 mt-1 text-sm text-muted">The look of the menu panel.</p>
        <div role="radiogroup" aria-label="Menu colour" className="grid gap-3 sm:grid-cols-4">
          {NAV_STYLES.map((n) => (
            <button key={n.key} type="button" role="radio" aria-checked={p.navStyle === n.key} onClick={() => change({ navStyle: n.key })}
              className={cn("rounded-card border-2 p-2.5 text-left transition", p.navStyle === n.key ? "border-[var(--brand-primary)]" : "border-default hover:border-strong")}>
              <span className="flex h-14 items-center justify-center overflow-hidden rounded-md border border-default bg-[linear-gradient(135deg,#ece9fb,#f6f7fb)]">
                <span className="h-10 w-9 rounded-lg border border-black/10 shadow-sm" style={{ background: NAV_SWATCH[n.key] }} />
              </span>
              <span className="mt-2 flex items-center text-sm font-medium text-primary">{n.label}{p.navStyle === n.key && <Check className="ml-auto h-4 w-4 text-brand" aria-hidden />}</span>
            </button>
          ))}
        </div>
        <div className="mt-4">
          <Toggle label="Hide the menu until I point at the left edge" hint={autoHideApplies ? "Gives pages the full width. Works with Classic, Search first and Modules and tabs." : "Not used by the layout you picked: it works with Classic, Search first and Modules and tabs."} checked={p.autoHide} disabled={!autoHideApplies} onChange={(autoHide) => change({ autoHide })} />
        </div>
      </section>

      <section className="card p-5">
        <h2 className="mb-4 text-sm font-semibold text-primary">Look</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="font" className="mb-2 block text-sm font-medium text-primary">Font</label>
            <select id="font" value={p.font} onChange={(e) => change({ font: e.target.value as Preferences["font"] })} className="input h-9 w-full max-w-60 text-sm">
              {FONTS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
            </select>
            <p className="mt-1.5 text-xs text-muted">Changes the typeface everywhere in the app.</p>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-primary">Background</p>
            <Segmented label="Background" value={p.background} options={BACKGROUNDS.map((b) => ({ value: b.key, label: b.label }))} onChange={(background) => change({ background })} />
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-primary">Corners</p>
            <Segmented label="Corners" value={p.corners} options={CORNERS.map((c) => ({ value: c.key, label: c.label }))} onChange={(corners) => change({ corners })} />
          </div>
          <div className="space-y-3">
            <Toggle label="Reduce motion" hint="Fewer animations and transitions." checked={p.reduceMotion} onChange={(reduceMotion) => change({ reduceMotion })} />
            <Toggle label="Higher contrast" hint="Darker text and stronger lines." checked={p.highContrast} onChange={(highContrast) => change({ highContrast })} />
          </div>
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
            <label htmlFor="start-page" className="mb-2 block text-sm font-medium text-primary">Start page</label>
            <select id="start-page" value={p.startPage} onChange={(e) => change({ startPage: e.target.value })} className="input h-9 w-full max-w-60 text-sm">
              {startPages.map((s) => <option key={s.href} value={s.href}>{s.label}</option>)}
            </select>
            <p className="mt-1.5 text-xs text-muted">Where you land after signing in.</p>
          </div>
        </div>
      </section>

      {canSetCompanyDefault && (
        <section className="card p-5">
          <h2 className="text-sm font-semibold text-primary">Company default</h2>
          <p className="mb-3 mt-1 text-sm text-muted">The look people in your company start with when they have not chosen their own. People who already chose a look keep it.{company ? " A company default is set." : " None is set."}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-secondary" disabled={pending} onClick={() => start(async () => {
              const r = await saveCompanyLookAction(p);
              if (r.error) setMsg({ ok: false, text: r.error }); else { setCompany(p); setMsg({ ok: true, text: "Saved as the company default." }); }
            })}>Use this look as the company default</button>
            {company && <button type="button" className="btn btn-secondary" disabled={pending} onClick={() => start(async () => {
              const r = await saveCompanyLookAction(null);
              if (r.error) setMsg({ ok: false, text: r.error }); else { setCompany(null); setMsg({ ok: true, text: "Company default removed." }); }
            })}>Remove the company default</button>}
          </div>
        </section>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn btn-primary" disabled={pending || !dirty} onClick={() => start(async () => {
          const r = await savePreferencesAction(p);
          if (r.error) setMsg({ ok: false, text: r.error });
          else { setSaved(p); window.dispatchEvent(new CustomEvent("theme-changed", { detail: p.theme })); setMsg({ ok: true, text: "Saved. It is applied on each device when you sign in." }); }
        })}>{pending ? "Saving…" : "Save"}</button>
        <button type="button" className="btn btn-secondary" disabled={pending} onClick={() => change({ ...(company ?? DEFAULT_PREFERENCES), startPage: p.startPage })}>{company ? "Back to the company default" : "Back to the defaults"}</button>
        {dirty && !msg && <span className="text-sm text-muted">Previewing. Save to keep it.</span>}
        {msg && <p role={msg.ok ? "status" : "alert"} className={cn("text-sm", msg.ok ? "text-success" : "text-error")}>{msg.text}</p>}
      </div>
    </div>
  );
}
