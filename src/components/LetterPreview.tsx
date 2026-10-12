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
export function PagedPaper({ children, padX: padXPx, padTop: padTopPx = 28, padBottom: padBottomPx = 28, padTopRatio, padBottomRatio, background }: { children: React.ReactNode; padX?: number; padTop?: number; padBottom?: number; padTopRatio?: number; padBottomRatio?: number; background?: React.CSSProperties }) {
  const outer = useRef<HTMLDivElement>(null);
  const measure = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(544);
  const [layout, setLayout] = useState<{ height: number; blocks: { top: number; bottom: number; keep: boolean }[] }>({ height: 0, blocks: [] });

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
    const read = () => {
      const base = m.getBoundingClientRect().top;
      // The places a page may safely end: paragraphs, list items and table rows, plus blocks that must stay whole.
      const blocks = [...m.querySelectorAll<HTMLElement>("p, li, tr, h1, h2, h3, blockquote, [data-keep]")].map((el) => {
        const r = el.getBoundingClientRect();
        return { top: r.top - base, bottom: r.bottom - base, keep: el.hasAttribute("data-keep") };
      });
      setLayout({ height: m.scrollHeight, blocks });
    };
    const ro = new ResizeObserver(read);
    ro.observe(m);
    read();
    return () => ro.disconnect();
  }, [children, width]);

  const pageH = (width * 297) / 210;
  // Type and side margins scale with the sheet so a line breaks where it does in the PDF (9pt on a 595pt page, 52pt margins).
  const padX = padXPx ?? (width * 52) / 595;
  const fontPx = (width * 9) / 595;
  const padTop = padTopRatio !== undefined ? pageH * padTopRatio : padTopPx;
  const padBottom = padBottomRatio !== undefined ? pageH * padBottomRatio : padBottomPx;
  const bodyH = pageH - padTop - padBottom;
  const inner = width - padX * 2;

  // Where each sheet starts in the content. A page ends before a block that would be cut by the
  // bottom margin, so a paragraph, table row or signature block moves whole onto the next sheet.
  const starts: number[] = [0];
  for (let guard = 0; guard < 40; guard++) {
    const start = starts[starts.length - 1];
    const limit = start + bodyH;
    if (layout.height <= limit + 1) break;
    const cut = layout.blocks.filter((b) => b.top > start + 1 && b.top < limit && b.bottom > limit + 0.5);
    const keep = cut.filter((b) => b.keep).sort((a, c) => a.top - c.top)[0];
    const innermost = [...cut].sort((a, c) => c.top - a.top)[0];
    const next = keep?.top ?? innermost?.top ?? limit;
    starts.push(next > start + 20 ? next : limit);
  }
  const pages = starts.length;
  const frame = "letter-paper relative overflow-hidden rounded-sm bg-white leading-relaxed text-black shadow-[0_1px_6px_rgba(0,0,0,0.15)] ring-1 ring-black/5";

  return (
    <div ref={outer} className="mx-auto w-full max-w-[34rem] space-y-4">
      {/* Off-screen copy used only to measure how tall the content is at this width. */}
      <div ref={measure} className="letter-paper pointer-events-none invisible absolute -z-10 leading-relaxed" style={{ width: inner, fontSize: fontPx }} aria-hidden>
        {children}
      </div>
      {starts.map((start, i) => {
        const end = starts[i + 1] ?? layout.height;
        return (
          <div key={i} className={frame} style={{ height: pageH, fontSize: fontPx, ...background }}>
            <div className="absolute overflow-hidden" style={{ left: padX, top: padTop, width: inner, height: Math.min(bodyH, Math.max(end - start, 0)) }}>
              <div style={{ transform: `translateY(${-start}px)` }}>{children}</div>
            </div>
            {pages > 1 && <span className="absolute bottom-1.5 right-3 text-[8px] text-neutral-400">Page {i + 1} of {pages}</span>}
          </div>
        );
      })}
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
          <div className="mb-3 border-b border-black pb-2"><p className="font-bold" style={{ fontSize: "1.4em" }}>{SAMPLE_VALUES.COMPANYNAME}</p><p className="text-[9px] text-neutral-600">Business Bay, Dubai · Tel: +971 4 123 4567</p></div>
          <div className="flex justify-between"><p>Ref: {EMPLOYEE_MERGE_FIELDS.find((f) => f.key === "REFNO")!.example}</p><p>Date: {SAMPLE_VALUES.DATE}</p></div>
        </>
      )}
      <p className="my-3 text-center font-bold underline" style={{ fontSize: "1.22em" }}>{(title || "Letter title").toUpperCase()}</p>
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
  /** Clear space on a letterhead, in mm (defaults 65 / 35). */
  topMm?: number;
  bottomMm?: number;
};

/** An employee letter with real (already filled in) content, on paper. */
export function EmployeeLetterPaper({ companyName, refNo, date, title, html, options }: { companyName: string; refNo: string; date: string; title: string; html: string; options: PaperOptions }) {
  const o = options;
  const bg = o.onLetterhead && o.letterheadUrl ? { backgroundImage: `url(${o.letterheadUrl})`, backgroundSize: "100% 100%", backgroundRepeat: "no-repeat" } : undefined;
  // On letterhead the printed header and footer artwork must stay clear, as in the PDF.
  const padTop = o.onLetterhead && o.letterheadUrl ? (o.topMm ?? 65) / 297 : 28 / 770;
  const padBottom = o.onLetterhead && o.letterheadUrl ? (o.bottomMm ?? 35) / 297 : 28 / 770;
  return (
    <PagedPaper padTopRatio={padTop} padBottomRatio={padBottom} background={bg}>
      <div>
      {o.onLetterhead ? (
        // Pre-printed paper (or artwork): keep the header area clear, exactly as the PDF does.
        // (With artwork the clear space is the sheet's own top margin; without, a placeholder box stands in.)
        !o.letterheadUrl && <div className="mb-3 flex h-20 items-center justify-center rounded border border-dashed border-neutral-400 text-[10px] text-neutral-500">Letterhead prints here</div>
      ) : (
        <div className="mb-3 border-b border-black pb-2"><p className="font-bold" style={{ fontSize: "1.4em" }}>{companyName}</p></div>
      )}
      <div className="flex justify-between"><p>Ref: {refNo}</p><p>Date: {date}</p></div>
      <p className="my-3 text-center font-bold underline" style={{ fontSize: "1.22em" }}>{title.toUpperCase()}</p>
      <div className="text-justify" dangerouslySetInnerHTML={{ __html: html }} />
      <div data-keep className="mt-6 flex items-end justify-between gap-3">
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


export type ClientLetterPaperProps = {
  date: string;
  clientName: string;
  clientAddress: string | null;
  projectName: string;
  title: string;
  /** The body with its merge fields already filled in. */
  bodyHtml: string;
  columns: { key: string; label: string; width: number }[];
  rows: string[][];
  issuerName: string;
  signatoryName?: string | null;
  signatoryTitle?: string | null;
  signatoryPhone?: string | null;
  signatoryEmail?: string | null;
  signatureUrl?: string | null;
  stampUrl?: string | null;
  onLetterhead: boolean;
  /** The letterhead as an image, once it is ready; null while loading or when there is none. */
  letterheadSrc: string | null;
  topMm: number;
  bottomMm: number;
};

/** A NOC or undertaking as it will print: addressee, project, title, body, the worker table, signature. */
export function ClientLetterPaper(p: ClientLetterPaperProps) {
  const { before, after } = splitAtWorkerTable(p.bodyHtml);
  const withArt = p.onLetterhead && !!p.letterheadSrc;
  const bg = withArt ? { backgroundImage: `url(${p.letterheadSrc})`, backgroundSize: "100% 100%", backgroundRepeat: "no-repeat" } : undefined;
  const total = p.columns.reduce((a, c) => a + c.width, 0);
  const table = (
    <table className="letter-sample-table">
      <colgroup>{p.columns.map((c) => <col key={c.key} style={{ width: `${(c.width / total) * 100}%` }} />)}</colgroup>
      <thead><tr>{p.columns.map((c) => <th key={c.key}>{c.label}</th>)}</tr></thead>
      <tbody>{p.rows.map((r, i) => <tr key={i}>{r.map((v, j) => <td key={j}>{v}</td>)}</tr>)}</tbody>
    </table>
  );
  return (
    <PagedPaper padTopRatio={withArt ? p.topMm / 297 : 28 / 770} padBottomRatio={withArt ? p.bottomMm / 297 : 28 / 770} background={bg}>
      <div>
        {p.onLetterhead && !withArt && <div className="mb-3 flex h-16 items-center justify-center rounded border border-dashed border-neutral-400 text-[10px] text-neutral-500">Letterhead prints here</div>}
        <p>Date: {p.date}</p>
        <div className="mt-3"><p>To,</p><p className="font-bold">M/s. {p.clientName.toUpperCase()}</p>{p.clientAddress && <p>{p.clientAddress}</p>}</div>
        <p className="mt-2 font-bold">Project: {p.projectName}</p>
        <p className="my-3 text-center font-bold underline" style={{ fontSize: "1.22em" }}>{p.title.toUpperCase()}</p>
        <div className="text-justify" dangerouslySetInnerHTML={{ __html: before }} />
        {p.rows.length > 0 && table}
        {after && <div className="text-justify" dangerouslySetInnerHTML={{ __html: after }} />}
        <div data-keep className="mt-6 flex items-end justify-between gap-3">
          <div>
            <p>For and on behalf of</p>
            <p className="font-bold">{p.issuerName.toUpperCase()}</p>
            {/* eslint-disable-next-line @next/next/no-img-element -- our own image route */}
            {p.signatureUrl && <img src={p.signatureUrl} alt="" className="my-1 h-11 w-[7.5rem] object-contain" />}
            {p.signatoryName && <p>{p.signatoryName}</p>}
            {p.signatoryTitle && <p>{p.signatoryTitle}</p>}
            {p.signatoryPhone && <p>Mob: {p.signatoryPhone}</p>}
            {p.signatoryEmail && <p>Email: {p.signatoryEmail}</p>}
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element -- our own image route */}
          {p.stampUrl && <img src={p.stampUrl} alt="" className="h-[5.75rem] w-[5.75rem] object-contain" />}
        </div>
      </div>
    </PagedPaper>
  );
}
