"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { TIMESHEET_TEMPLATES, type TimesheetTemplateKey } from "@/lib/timesheetTemplates";

/** A small drawn sketch of each layout, so the choice is visual. */
export function TemplatePreview({ k, className = "" }: { k: TimesheetTemplateKey; className?: string }) {
  const bar = (w: string, strong = false) => <div className={`h-1 rounded-full ${strong ? "bg-[var(--brand-primary)]" : "bg-[var(--border-strong,#cbd5e1)]"}`} style={{ width: w }} />;
  const landscape = k === "standard";
  return (
    <div className={`mx-auto rounded-md border border-default bg-white p-2 shadow-sm ${landscape ? "aspect-[1.41/1] w-full" : "aspect-[1/1.2] w-[78%]"} ${className}`} aria-hidden>
      <div className="mb-1.5 flex items-center gap-1.5">
        <div className="h-3 w-3 rounded-sm bg-[var(--brand-primary)]" />
        <div className="flex-1 space-y-0.5">{bar("55%", true)}{bar("35%")}</div>
      </div>
      <div className="mb-1.5 h-px bg-[var(--brand-primary)]" />
      {k === "standard" && (
        <div className="space-y-[3px]">
          <div className="grid grid-cols-[repeat(16,1fr)] gap-px">
            {Array.from({ length: 16 * 6 }, (_, i) => (
              <div key={i} className={`h-1.5 ${i < 16 ? "bg-indigo-200" : i % 23 === 0 ? "bg-amber-300" : "bg-slate-200"}`} />
            ))}
          </div>
          <div className="flex justify-between pt-1">{bar("30%")}{bar("25%", true)}</div>
        </div>
      )}
      {k === "summary" && (
        <div className="space-y-[3px]">
          <div className="grid grid-cols-6 gap-px">{Array.from({ length: 6 * 7 }, (_, i) => <div key={i} className={`h-1.5 ${i < 6 ? "bg-indigo-200" : "bg-slate-200"}`} />)}</div>
          <div className="ml-auto w-1/2 space-y-0.5 pt-1">{bar("100%")}{bar("100%")}{bar("100%", true)}</div>
        </div>
      )}
      {k === "trade" && (
        <div className="space-y-[3px]">
          <div className="grid grid-cols-5 gap-px">{Array.from({ length: 5 * 4 }, (_, i) => <div key={i} className={`h-2 ${i < 5 ? "bg-indigo-200" : i >= 15 ? "bg-slate-300" : "bg-slate-200"}`} />)}</div>
          <div className="ml-auto w-1/2 space-y-0.5 pt-1">{bar("100%")}{bar("100%", true)}</div>
        </div>
      )}
      {k === "signoff" && (
        <div className="space-y-[3px]">
          <div className="grid grid-cols-[1fr_1fr_1fr_1.4fr] gap-px">{Array.from({ length: 4 * 7 }, (_, i) => <div key={i} className={`h-1.5 ${i < 4 ? "bg-indigo-200" : i % 4 === 3 ? "bg-white outline outline-1 outline-slate-300" : "bg-slate-200"}`} />)}</div>
          <div className="grid grid-cols-3 gap-2 pt-3">{[0, 1, 2].map((i) => <div key={i} className="border-t border-slate-400" />)}</div>
        </div>
      )}
    </div>
  );
}

type Custom = { value: string; name: string; baseKey: TimesheetTemplateKey };
let customCache: Custom[] | null = null;

/** The company's own templates, fetched once per page load. A failure just means only the built-in layouts show. */
function useCustomTemplates(): Custom[] {
  const [list, setList] = useState<Custom[]>(customCache ?? []);
  useEffect(() => {
    let live = true;
    fetch("/api/timesheet-templates", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (live && d?.templates) { customCache = d.templates; setList(d.templates); } })
      .catch(() => {});
    return () => { live = false; };
  }, []);
  return list;
}

export function TemplatePicker({ value, onChange, compact = false }: { value: string; onChange: (k: string) => void; compact?: boolean }) {
  const custom = useCustomTemplates();
  const options: { value: string; name: string; tagline: string; k: TimesheetTemplateKey }[] = [
    ...TIMESHEET_TEMPLATES.map((t) => ({ value: t.key as string, name: t.name, tagline: t.tagline, k: t.key })),
    ...custom.map((c) => ({ value: c.value, name: c.name, tagline: "Your template", k: c.baseKey })),
  ];
  // A template that was deleted since the page loaded falls back to the standard layout.
  useEffect(() => { if (custom.length >= 0 && value.startsWith("custom:") && customCache && !customCache.some((c) => c.value === value)) onChange("standard"); }, [value, custom, onChange]);
  return (
    <div role="radiogroup" aria-label="Timesheet layout" className={`grid gap-3 ${compact ? "grid-cols-2" : "grid-cols-2 lg:grid-cols-4"}`}>
      {options.map((t) => {
        const on = t.value === value;
        return (
          <button
            key={t.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(t.value)}
            className={`relative rounded-card border p-3 text-left transition ${on ? "border-[var(--brand-primary)] bg-[var(--brand-primary-soft,#eef2ff)] ring-1 ring-[var(--brand-primary)]" : "border-default bg-surface hover:bg-surface-hover"}`}
          >
            {on && <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--brand-primary)] text-white"><Check className="h-3 w-3" aria-hidden /></span>}
            <TemplatePreview k={t.k} className={compact ? "max-h-24" : ""} />
            <p className="mt-2 text-sm font-semibold text-primary">{t.name}</p>
            <p className="text-xs text-muted">{t.tagline}</p>
          </button>
        );
      })}
    </div>
  );
}
