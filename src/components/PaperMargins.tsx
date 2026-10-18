"use client";

import { useState, useTransition } from "react";
import { useLetterheadImage } from "@/components/useLetterheadImage";
import { DEFAULT_PLAIN, DEFAULT_SIDE_ON_LETTERHEAD, MARGIN_LIMITS, type Margins } from "@/lib/paperMargins";
import { DEFAULT_BOTTOM_MM, DEFAULT_TOP_MM } from "@/components/LetterheadMargins";
import { cn } from "@/lib/cn";

type Action = (fd: FormData) => Promise<{ error?: string | null } | void>;

/**
 * The company's page margins for printed letters, in one place: plain paper (no header from us, margins on all four
 * sides) and pre-printed letterhead (top and bottom clearance for the header and footer, plus the sides). A small A4
 * sheet shows the area the text will use.
 */
export function PaperMargins({
  branchId, letterheadUrl, plain, letterhead, savePlain, saveLetterhead,
}: {
  branchId: string;
  letterheadUrl: string | null;
  plain: Margins;
  letterhead: Margins;
  savePlain: Action;
  saveLetterhead: Action;
}) {
  const [tab, setTab] = useState<"plain" | "letterhead">("plain");
  const [values, setValues] = useState<{ plain: Margins; letterhead: Margins }>({ plain, letterhead });
  const [saved, setSaved] = useState<{ plain: Margins; letterhead: Margins }>({ plain, letterhead });
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const image = useLetterheadImage(tab === "letterhead" ? letterheadUrl : null);

  const m = values[tab];
  const dirty = (["top", "bottom", "left", "right"] as const).some((k) => m[k] !== saved[tab][k]);
  const set = (k: keyof Margins, v: number) => setValues((all) => ({ ...all, [tab]: { ...all[tab], [k]: v } }));
  const limits = (k: keyof Margins) =>
    tab === "plain" ? MARGIN_LIMITS.plain : k === "top" ? { min: 15, max: 140 } : k === "bottom" ? { min: 10, max: 100 } : MARGIN_LIMITS.side;
  const standard: Margins = tab === "plain" ? DEFAULT_PLAIN : { top: DEFAULT_TOP_MM, bottom: DEFAULT_BOTTOM_MM, left: DEFAULT_SIDE_ON_LETTERHEAD, right: DEFAULT_SIDE_ON_LETTERHEAD };

  function save() {
    setError(null);
    start(async () => {
      const fd = new FormData();
      fd.set("branchId", branchId);
      fd.set("topMm", String(m.top)); fd.set("bottomMm", String(m.bottom)); fd.set("leftMm", String(m.left)); fd.set("rightMm", String(m.right));
      const res = await (tab === "plain" ? savePlain : saveLetterhead)(fd);
      if (res && res.error) setError(res.error);
      else setSaved((all) => ({ ...all, [tab]: m }));
    });
  }

  const slider = (k: keyof Margins, label: string) => (
    <label key={k} className="block">
      <span className="flex items-center justify-between text-xs font-medium text-muted">
        {label}
        <span className="tabular text-secondary">{m[k]} mm</span>
      </span>
      <input type="range" min={limits(k).min} max={limits(k).max} step={1} value={m[k]} onChange={(e) => set(k, Number(e.target.value))} className="mt-1 w-full" />
    </label>
  );

  return (
    <div className="space-y-4">
      <div role="tablist" className="inline-flex overflow-hidden rounded-lg border border-default">
        {([["plain", "Plain paper"], ["letterhead", "Pre-printed letterhead"]] as const).map(([k, l]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => { setTab(k); setError(null); }} className={cn("px-4 py-1.5 text-sm", tab === k ? "bg-brand-soft font-semibold text-brand" : "text-secondary hover:bg-surface-hover")}>{l}</button>
        ))}
      </div>
      <div className="flex flex-wrap items-start gap-5">
        <div
          className="relative h-[255px] w-[180px] shrink-0 overflow-hidden rounded-sm border border-default bg-white shadow-sm"
          style={image ? { backgroundImage: `url(${image})`, backgroundSize: "100% 100%", backgroundRepeat: "no-repeat" } : undefined}
          aria-label="A4 page and the area the letter text will use"
        >
          <div
            className="absolute border border-dashed border-[var(--brand-primary)] bg-[var(--brand-primary)]/10"
            style={{ top: `${(m.top / 297) * 100}%`, bottom: `${(m.bottom / 297) * 100}%`, left: `${(m.left / 210) * 100}%`, right: `${(m.right / 210) * 100}%` }}
          >
            <span className="absolute left-1 top-1 text-[8px] font-medium text-[var(--brand-primary)]">Letter text</span>
          </div>
          {tab === "letterhead" && !letterheadUrl && <span className="absolute inset-x-0 top-2 text-center text-[8px] text-neutral-400">Pre-printed paper</span>}
        </div>
        <div className="min-w-[14rem] flex-1 space-y-3">
          {tab === "letterhead" ? (
            <>
              {slider("top", "Space left clear at the top")}
              {slider("bottom", "Space left clear at the bottom")}
            </>
          ) : (
            <>
              {slider("top", "Top")}
              {slider("bottom", "Bottom")}
            </>
          )}
          {slider("left", "Left")}
          {slider("right", "Right")}
          <p className="text-xs text-muted">
            {tab === "plain"
              ? "Letters on plain paper print no header from us: just the reference, date, title, wording and signature, inside these margins. Also used for payslips, payroll documents, NOCs and quotations printed on plain or blank paper."
              : "Letters printed on pre-printed letterhead start below the top margin and stop above the bottom one, so nothing prints over your header or footer. Leave a little more than the artwork needs. The sides apply to payslips, NOCs and quotations on letterhead too."}
          </p>
          <div className="flex items-center gap-2">
            <button type="button" className="btn btn-primary btn-sm" disabled={!dirty || pending} onClick={save}>{pending ? "Saving…" : "Save margins"}</button>
            {dirty && <button type="button" className="btn btn-secondary btn-sm" onClick={() => setValues((all) => ({ ...all, [tab]: saved[tab] }))}>Reset</button>}
            {!dirty && !pending && <span className="text-xs text-muted">Saved</span>}
            <button type="button" className="ml-auto text-xs text-[var(--brand-primary)] hover:underline" onClick={() => setValues((all) => ({ ...all, [tab]: standard }))}>Standard ({standard.top} / {standard.bottom} / {standard.left} / {standard.right})</button>
          </div>
          {error && <p role="alert" className="text-xs text-[var(--error)]">{error}</p>}
        </div>
      </div>
    </div>
  );
}
