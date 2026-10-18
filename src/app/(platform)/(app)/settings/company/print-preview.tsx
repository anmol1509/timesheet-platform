"use client";

import { useEffect, useState } from "react";

type Live = { name: string; address: string; trn: string; emirate: string; country: string };

/**
 * How the company details print: the letterhead block as it appears on a letter, following what is typed in the
 * form (company:preview events from CompanyForm) until it is saved. With a letterhead uploaded, that artwork is the page.
 */
export function PrintPreview({ initial, logoUrl, letterheadUrl, signatureUrl, stampUrl }: { initial: Live; logoUrl: string | null; letterheadUrl: string | null; signatureUrl: string | null; stampUrl: string | null }) {
  const [v, setV] = useState<Live>(initial);
  useEffect(() => {
    const on = (e: Event) => setV((e as CustomEvent<Live>).detail);
    window.addEventListener("company:preview", on);
    return () => window.removeEventListener("company:preview", on);
  }, []);
  const place = [v.emirate, v.country].filter(Boolean).join(", ");
  return (
    <div className="card p-5">
      <p className="mb-3 text-xs font-semibold tracking-wide text-muted uppercase">How it prints</p>
      <div className="relative aspect-[1/1.2] overflow-hidden rounded-lg border border-default bg-white text-slate-900 shadow-sm">
        {letterheadUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- our own image route
          <img src={letterheadUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
        )}
        <div className="relative p-4">
          {!letterheadUrl && (
            <div className="flex items-center gap-3 border-b-2 border-[var(--brand-primary)] pb-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-md bg-slate-100 text-sm font-bold text-slate-500">
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- our own image route
                  <img src={logoUrl} alt="" className="h-full w-full object-contain" />
                ) : (
                  (v.name || "?").slice(0, 2).toUpperCase()
                )}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">{v.name || "Company name"}</p>
                <p className="truncate text-[11px] text-slate-500">{[v.address || "Address not set", place].filter(Boolean).join(" · ")}</p>
                <p className={v.trn ? "text-[11px] text-slate-500" : "text-[11px] text-amber-600"}>{v.trn ? `TRN ${v.trn}` : "TRN not set"}</p>
              </div>
            </div>
          )}
          <div className="mt-6 space-y-1.5 text-[10px] text-slate-300" aria-hidden>
            <p>Letter text…</p>
            <div className="h-1.5 w-11/12 rounded bg-slate-100" />
            <div className="h-1.5 w-10/12 rounded bg-slate-100" />
            <div className="h-1.5 w-9/12 rounded bg-slate-100" />
          </div>
        </div>
        {(signatureUrl || stampUrl) && (
          <div className="absolute right-4 bottom-4 flex items-end gap-2">
            {signatureUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- our own image route
              <img src={signatureUrl} alt="" className="h-10 w-auto object-contain" />
            )}
            {stampUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- our own image route
              <img src={stampUrl} alt="" className="h-14 w-14 object-contain" />
            )}
          </div>
        )}
      </div>
      <p className="mt-2 text-[11px] text-muted">{letterheadUrl ? "Your letterhead artwork is the page; the signature and stamp print only when ticked on a letter." : "The header block on timesheets, invoices and letters."}</p>
    </div>
  );
}
