"use client";

import { useEffect, useRef, useState } from "react";
import { DEFAULT_LETTER_COLUMNS, LETTER_TABLE_COLUMNS } from "@/lib/letterLayout";
import { EMPLOYEE_MERGE_FIELDS, fieldsFor, type Audience } from "@/lib/letterFields";
import { ASK_PREFIX, splitAtWorkerTable } from "@/lib/letterHtml";
import { SAMPLE_VALUES, SAMPLE_WORKERS } from "@/lib/letterSample";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function sampleTable(): string {
  const cols = LETTER_TABLE_COLUMNS.filter((c) => (DEFAULT_LETTER_COLUMNS as readonly string[]).includes(c.key));
  const cell = (key: string, i: number) => {
    const w = SAMPLE_WORKERS[i];
    return ({ SNO: String(i + 1), NAME: w.name.toUpperCase(), COMPANY: SAMPLE_VALUES.COMPANYNAME, DESIGNATION: w.trade ?? "", NATIONALITY: (w.nationality ?? "").toUpperCase(), PASSPORT: w.passportNumber ?? "", ID_NUMBER: w.emiratesId ?? "" } as Record<string, string>)[key] ?? "";
  };
  return `<table class="letter-sample-table"><thead><tr>${cols.map((c) => `<th>${c.label}</th>`).join("")}</tr></thead><tbody>${SAMPLE_WORKERS.map((_, i) => `<tr>${cols.map((c) => `<td>${esc(cell(c.key, i))}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
}

/** Turns the editor's HTML into preview HTML: fields become coloured sample values, the worker marker becomes a sample table. */
function toPreviewHtml(html: string, audience: Audience): string {
  const fields = new Map(fieldsFor(audience).map((f) => [f.key, f]));
  const chip = (cls: string, text: string, title: string) => `<span class="${cls}" title="${esc(title)}" style="border-radius:4px;padding:0 3px;${cls === "ok" ? "background:#dbeafe;color:#1e40af" : cls === "ask" ? "background:#fef3c7;color:#92400e" : "background:#fee2e2;color:#b91c1c"}">${esc(text)}</span>`;
  const fill = (h: string) =>
    h.replace(/%%([^%<>\n]+?)%%/g, (_m, raw: string) => {
      const key = raw.trim();
      if (key.startsWith(ASK_PREFIX)) return chip("ask", `[${key.slice(ASK_PREFIX.length)}]`, "Filled in when the letter is issued");
      const f = fields.get(key) ?? (key === "SPONSORSHIPCOMPANYNAME" ? fields.get("COMPANYNAME") : undefined);
      return f ? chip("ok", f.example, `${f.label} — filled in automatically`) : chip("bad", `⚠ %%${key}%%`, "Not a real field — it would print blank");
    });
  if (audience !== "SITE") return fill(html);
  const { before, after } = splitAtWorkerTable(html);
  return fill(before) + sampleTable() + fill(after);
}

/**
 * A4 portrait sheets, as many as the content needs. The content is laid out once
 * at the sheet's width, measured, and each sheet shows its own slice of it, so
 * nothing runs off the bottom: what doesn't fit continues on the next sheet,
 * as it does in the printed PDF.
 */
function PagedPaper({ children, padX = 28, padTop: padTopPx = 28, padBottom: padBottomPx = 28, padTopRatio, padBottomRatio, background }: { children: React.ReactNode; padX?: number; padTop?: number; padBottom?: number; padTopRatio?: number; padBottomRatio?: number; background?: React.CSSProperties }) {
  const outer = useRef<HTMLDivElement>(null);
  const measure = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(544);
  const [contentH, setContentH] = useState(0);

  useEffect(() => {
    const o = outer.current;
    if (!o) return;
    const ro = new ResizeObserver(() => setWidth(o.clientWidth || 544));
    ro.observe(o);
    setWidth(o.clientWidth || 544);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    const m = measure.current;
    if (!m) return;
    const ro = new ResizeObserver(() => setContentH(m.scrollHeight));
    ro.observe(m);
    setContentH(m.scrollHeight);
    return () => ro.disconnect();
  }, [children, width]);

  const pageH = (width * 297) / 210;
  const padTop = padTopRatio !== undefined ? pageH * padTopRatio : padTopPx;
  const padBottom = padBottomRatio !== undefined ? pageH * padBottomRatio : padBottomPx;
  const bodyH = pageH - padTop - padBottom;
  const pages = Math.max(1, Math.ceil(contentH / bodyH));
  const inner = width - padX * 2;
  const frame = "letter-paper relative overflow-hidden rounded-sm bg-white text-[11px] leading-relaxed text-black shadow-[0_1px_6px_rgba(0,0,0,0.15)] ring-1 ring-black/5";

  return (
    <div ref={outer} className="mx-auto w-full max-w-[34rem] space-y-4">
      {/* Off-screen copy used only to measure how tall the content is at this width. */}
      <div ref={measure} className="letter-paper pointer-events-none invisible absolute -z-10 text-[11px] leading-relaxed" style={{ width: inner }} aria-hidden>
        {children}
      </div>
      {Array.from({ length: pages }, (_, i) => (
        <div key={i} className={frame} style={{ height: pageH, ...background }}>
          <div className="absolute overflow-hidden" style={{ left: padX, top: padTop, width: inner, height: bodyH }}>
            <div style={{ transform: `translateY(${-i * bodyH}px)` }}>{children}</div>
          </div>
          {pages > 1 && <span className="absolute bottom-1.5 right-3 text-[8px] text-neutral-400">Page {i + 1} of {pages}</span>}
        </div>
      ))}
    </div>
  );
}

/**
 * A paper-style preview of the letter as it will print. Site letters show the
 * fixed parts (date, addressee, worker table, signature) around the body;
 * employee letters show a letterhead, reference and signature. Always black on
 * white, like the printed page, whatever the app theme.
 */
export function LetterPreview({ title, html, audience }: { title: string; html: string; audience: Audience }) {
  const body = toPreviewHtml(html, audience);
  return (
    <PagedPaper>
      <div>
      {audience === "SITE" ? (
        <>
          <p>Date: {SAMPLE_VALUES.DATE}</p>
          <div className="mt-3"><p>To,</p><p className="font-bold">M/s. {SAMPLE_VALUES.CLIENTNAME}</p><p>{SAMPLE_VALUES.CLIENTADDRESS}</p></div>
          <p className="mt-2 font-bold">Project: {SAMPLE_VALUES.PROJECTNAME}</p>
        </>
      ) : (
        <>
          <div className="mb-3 border-b border-black pb-2"><p className="text-sm font-bold">{SAMPLE_VALUES.COMPANYNAME}</p><p className="text-[9px] text-neutral-600">Business Bay, Dubai · Tel: +971 4 123 4567</p></div>
          <div className="flex justify-between"><p>Ref: {EMPLOYEE_MERGE_FIELDS.find((f) => f.key === "REFNO")!.example}</p><p>Date: {SAMPLE_VALUES.DATE}</p></div>
        </>
      )}
      <p className="my-3 text-center text-xs font-bold underline">{(title || "Letter title").toUpperCase()}</p>
      <div className="text-justify" dangerouslySetInnerHTML={{ __html: body }} />
      <div className="mt-6">
        <p>For and on behalf of</p>
        <p className="font-bold">{SAMPLE_VALUES.COMPANYNAME}</p>
        <p className="mt-4">Authorised Signatory</p>
      </div>
    </div>
    </PagedPaper>
  );
}

export type PaperOptions = {
  onLetterhead: boolean;
  /** URL of the letterhead artwork, if one is uploaded (drawn as the page background). */
  letterheadUrl: string | null;
  signatoryName: string;
  signatoryTitle: string;
  signatureUrl: string | null;
  stampUrl: string | null;
};

/** An employee letter with real (already filled in) content, on paper. */
export function EmployeeLetterPaper({ companyName, refNo, date, title, html, options }: { companyName: string; refNo: string; date: string; title: string; html: string; options: PaperOptions }) {
  const o = options;
  const bg = o.onLetterhead && o.letterheadUrl ? { backgroundImage: `url(${o.letterheadUrl})`, backgroundSize: "100% 100%", backgroundRepeat: "no-repeat" } : undefined;
  // On letterhead the printed header and footer artwork must stay clear, as in the PDF (185pt / 100pt of 842pt).
  const padTop = o.onLetterhead && o.letterheadUrl ? 0.22 : 28 / 770;
  const padBottom = o.onLetterhead && o.letterheadUrl ? 0.12 : 28 / 770;
  return (
    <PagedPaper padTopRatio={padTop} padBottomRatio={padBottom} background={bg}>
      <div>
      {o.onLetterhead ? (
        // Pre-printed paper (or artwork): keep the header area clear, exactly as the PDF does.
        // (With artwork the clear space is the sheet's own top margin; without, a placeholder box stands in.)
        !o.letterheadUrl && <div className="mb-3 flex h-20 items-center justify-center rounded border border-dashed border-neutral-400 text-[10px] text-neutral-500">Letterhead prints here</div>
      ) : (
        <div className="mb-3 border-b border-black pb-2"><p className="text-sm font-bold">{companyName}</p></div>
      )}
      <div className="flex justify-between"><p>Ref: {refNo}</p><p>Date: {date}</p></div>
      <p className="my-3 text-center text-xs font-bold underline">{title.toUpperCase()}</p>
      <div className="text-justify" dangerouslySetInnerHTML={{ __html: html }} />
      <div className="mt-6 flex items-end justify-between gap-3">
        <div>
          <p>For and on behalf of</p>
          <p className="font-bold">{companyName}</p>
          {o.signatureUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- our own image route
            <img src={o.signatureUrl} alt="" className="my-1 h-11 w-[7.5rem] object-contain" />
          ) : (
            <div className="h-7" />
          )}
          <p className="font-bold">{o.signatoryName || "Authorised Signatory"}</p>
          {o.signatoryTitle && <p>{o.signatoryTitle}</p>}
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element -- our own image route */}
        {o.stampUrl && <img src={o.stampUrl} alt="" className="h-[5.75rem] w-[5.75rem] object-contain" />}
      </div>
      {o.onLetterhead && !o.letterheadUrl && <div className="mt-3 flex h-10 items-center justify-center rounded border border-dashed border-neutral-400 text-[10px] text-neutral-500">Letterhead footer prints here</div>}
      </div>
    </PagedPaper>
  );
}
