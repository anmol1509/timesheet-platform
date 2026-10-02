"use client";

import { useState, useTransition } from "react";
import { useLetterheadImage } from "@/components/useLetterheadImage";

export const DEFAULT_TOP_MM = 65;
export const DEFAULT_BOTTOM_MM = 35;

/**
 * Sets how much of the page a letter leaves clear at the top and bottom when it
 * is printed on this letterhead. The mock-up is an A4 page with the letterhead
 * on it and the area the text will use shaded, so the margin is set by eye.
 */
export function LetterheadMargins({
  letterheadUrl,
  topMm,
  bottomMm,
  action,
  extraFields,
}: {
  letterheadUrl: string | null;
  topMm: number;
  bottomMm: number;
  action: (fd: FormData) => Promise<{ error?: string | null } | void>;
  extraFields: Record<string, string>;
}) {
  const [top, setTop] = useState(topMm);
  const [bottom, setBottom] = useState(bottomMm);
  const [saved, setSaved] = useState({ top: topMm, bottom: bottomMm });
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const image = useLetterheadImage(letterheadUrl);
  const dirty = top !== saved.top || bottom !== saved.bottom;

  function save() {
    setError(null);
    start(async () => {
      const fd = new FormData();
      for (const [k, v] of Object.entries(extraFields)) fd.set(k, v);
      fd.set("topMm", String(top));
      fd.set("bottomMm", String(bottom));
      const res = await action(fd);
      if (res && res.error) setError(res.error);
      else setSaved({ top, bottom });
    });
  }

  const Slider = ({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (n: number) => void }) => (
    <label className="block">
      <span className="flex items-center justify-between text-xs font-medium text-muted">
        {label}
        <span className="tabular text-secondary">{value} mm</span>
      </span>
      <input type="range" min={min} max={max} step={1} value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-1 w-full" />
    </label>
  );

  return (
    <div className="flex flex-wrap items-start gap-5">
      <div
        className="relative h-[255px] w-[180px] shrink-0 overflow-hidden rounded-sm border border-default bg-white shadow-sm"
        style={image ? { backgroundImage: `url(${image})`, backgroundSize: "100% 100%", backgroundRepeat: "no-repeat" } : undefined}
        aria-label="A4 page with the letterhead and the area the letter text will use"
      >
        <div className="absolute inset-x-[7%] border border-dashed border-[var(--brand-primary)] bg-[var(--brand-primary)]/10" style={{ top: `${(top / 297) * 100}%`, bottom: `${(bottom / 297) * 100}%` }}>
          <span className="absolute left-1 top-1 text-[8px] font-medium text-[var(--brand-primary)]">Letter text</span>
        </div>
        {!letterheadUrl && <span className="absolute inset-x-0 top-2 text-center text-[8px] text-neutral-400">No letterhead uploaded</span>}
      </div>
      <div className="min-w-[14rem] flex-1 space-y-3">
        <Slider label="Space left clear at the top" value={top} min={15} max={140} onChange={setTop} />
        <Slider label="Space left clear at the bottom" value={bottom} min={10} max={100} onChange={setBottom} />
        <p className="text-xs text-muted">Letters printed on this letterhead start below the top margin and stop above the bottom one, so nothing prints over your header or footer. Leave a little more than the artwork needs.</p>
        <div className="flex items-center gap-2">
          <button type="button" className="btn btn-primary btn-sm" disabled={!dirty || pending} onClick={save}>{pending ? "Saving…" : "Save margins"}</button>
          {dirty && <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setTop(saved.top); setBottom(saved.bottom); }}>Reset</button>}
          {!dirty && !pending && saved.top === topMm && <span className="text-xs text-muted">Saved</span>}
          <button type="button" className="ml-auto text-xs text-[var(--brand-primary)] hover:underline" onClick={() => { setTop(DEFAULT_TOP_MM); setBottom(DEFAULT_BOTTOM_MM); }}>Standard (65 / 35)</button>
        </div>
        {error && <p role="alert" className="text-xs text-[var(--error)]">{error}</p>}
      </div>
    </div>
  );
}
