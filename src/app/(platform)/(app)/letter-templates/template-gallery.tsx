"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Copy, Eye, Search } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { RowMenu } from "@/components/ui/RowMenu";
import { duplicateTemplateAction, updateToLatestWordingAction } from "./actions";

import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/Alert";
export type TemplateCard = {
  id: string;
  name: string;
  category: string;
  audience: "EMPLOYEE" | "SITE";
  /** Ready-made and unchanged, ready-made and edited, or one of your own. */
  state: "original" | "update" | "edited" | "own";
  /** The heading printed on the letter. */
  title: string;
  /** The wording with sample details filled in. */
  html: string;
  issued: number;
  lastUsed: string | null;
  asks: string[];
  versions: number;
};

/** One letter on a sheet of paper. The sheet is laid out at 794px (A4 at 96dpi) and scaled, so the picture matches the printed page. */
function PaperThumb({ title, html, width, employee }: { title: string; html: string; width: number; employee: boolean }) {
  const scale = width / 794;
  return (
    <div className="paper-thumb relative overflow-hidden rounded-[3px] border border-[#e3e6ee] bg-white shadow-[0_2px_8px_rgba(16,24,40,.12)]" style={{ width, height: Math.round(width * 1.414) }} aria-hidden>
      <div style={{ width: 794, transform: `scale(${scale})`, transformOrigin: "top left", padding: "72px 76px", boxSizing: "border-box", fontFamily: "Helvetica, Arial, sans-serif", fontSize: 13.5, lineHeight: 1.5, color: "#111" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#555", marginBottom: 16 }}><span>Ref: LTR-000123</span><span>Date: 18-10-2026</span></div>
        <div style={{ textAlign: "center", fontWeight: 800, letterSpacing: 1.5, fontSize: 17, marginBottom: 16 }}>{title.toUpperCase()}</div>
        <div className="tpl-body" dangerouslySetInnerHTML={{ __html: html }} />
        {employee && (
          <div style={{ marginTop: 34, fontSize: 12.5 }}>
            <div>For and on behalf of</div>
            <div style={{ fontWeight: 700 }}>ACME CONCRETE CARPENTER CONT</div>
            <div style={{ borderTop: "1px solid #111", width: 170, marginTop: 34, paddingTop: 4, fontWeight: 700 }}>Authorised Signatory</div>
          </div>
        )}
      </div>
    </div>
  );
}

const STATE_LABEL = { original: "Ready-made", update: "New wording", edited: "Edited", own: "Yours" } as const;
const stateChip = (s: TemplateCard["state"]) => (
  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${s === "edited" || s === "update" ? "bg-brand-soft text-brand" : "bg-surface-sunken text-muted"}`}>{STATE_LABEL[s]}</span>
);

/** Where "Use letter" goes: an employee letter opens the Letters screen with it chosen; a NOC starts a new NOC. Other client letters are made from a demand. */
const startHref = (c: TemplateCard) => (c.audience === "EMPLOYEE" ? `/letters?template=${encodeURIComponent(c.name)}` : c.category === "No Objection Letter" ? "/operations/nocs/new" : c.category === "Check-in List" ? "/accommodation/checkin" : null);

function Duplicate({ id, children }: { id: string; children: React.ReactNode }) {
  return <form action={duplicateTemplateAction}><input type="hidden" name="id" value={id} />{children}</form>;
}

export function TemplateGallery({ cards }: { cards: TemplateCard[] }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<TemplateCard | null>(null);
  const shown = useMemo(() => cards.filter((c) => `${c.name} ${c.category}`.toLowerCase().includes(q.trim().toLowerCase())), [cards, q]);

  return (
    <div className="space-y-6">
      <label className="relative block max-w-xs">
        <Search className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-muted" aria-hidden />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search templates…" aria-label="Search templates" className="input h-9 w-full pl-9" />
      </label>
      {shown.length === 0 && <p className="text-sm text-muted">No template matches “{q}”.</p>}
      {/* One grid, in letter-type order, so versions of the same letter sit side by side. */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {shown.map((c) => {
          const href = startHref(c);
          const same = shown.filter((x) => x.category === c.category);
          return (
            <article key={c.id} className="card flex flex-col p-3">
              <button type="button" onClick={() => setOpen(c)} className="group/p relative flex h-[13.5rem] justify-center overflow-hidden rounded-lg bg-surface-sunken pt-3" aria-label={`Preview ${c.name}`}>
                <PaperThumb title={c.title} html={c.html} width={152} employee={c.audience === "EMPLOYEE"} />
                <span className="absolute inset-0 flex items-end justify-center bg-gradient-to-t from-black/25 to-transparent pb-2 text-xs font-semibold text-white opacity-0 transition-opacity group-hover/p:opacity-100"><span className="inline-flex items-center gap-1"><Eye className="h-3.5 w-3.5" aria-hidden /> Preview</span></span>
              </button>
              <p className="mt-2.5 flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-muted uppercase">
                {c.category}
                {same.length > 1 && <span className="rounded-full bg-brand-soft px-1.5 py-px text-[10px] font-semibold text-brand normal-case">Version {same.indexOf(c) + 1} of {same.length}</span>}
              </p>
              <div className="mt-0.5 flex items-start justify-between gap-2">
                <div className="min-w-0"><h3 className="text-sm font-semibold text-primary">{c.name}</h3><p className="mt-0.5 text-xs text-muted">{c.issued > 0 ? `${c.issued} issued` : "Not used yet"}</p></div>
                {stateChip(c.state)}
              </div>
              <div className="mt-auto flex items-center gap-2 pt-2.5">
                {href ? <Link href={href} className="btn btn-primary btn-sm flex-1 justify-center">Use letter</Link> : <button type="button" onClick={() => setOpen(c)} className="btn btn-secondary btn-sm flex-1 justify-center">Preview</button>}
                <Link href={`/letter-templates/${c.id}`} className="btn btn-secondary btn-sm flex-1 justify-center">Edit</Link>
                <DuplicateMenu id={c.id} />
              </div>
            </article>
          );
        })}
      </div>

      <Dialog open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        {open && (
          <DialogContent title={open.name} className="sm:max-w-3xl" description={open.audience === "EMPLOYEE" ? "Employee letter" : "Client letter"}>
            <div className="mt-4 flex flex-col gap-6 sm:flex-row">
              <div className="flex max-h-[70vh] justify-center overflow-y-auto rounded-lg bg-surface-sunken p-3"><PaperThumb title={open.title} html={open.html} width={340} employee={open.audience === "EMPLOYEE"} /></div>
              <div className="min-w-0 flex-1 space-y-4 text-sm">
                <div className="flex flex-wrap gap-1.5">{stateChip(open.state)}<span className="rounded-full bg-surface-sunken px-2 py-0.5 text-[11px] font-semibold text-muted">{open.category}</span></div>
                <dl className="divide-y divide-[var(--border)]">
                  <div className="flex justify-between gap-3 py-2"><dt className="text-muted">Issued</dt><dd className="font-semibold text-primary">{open.issued === 0 ? "Not yet" : `${open.issued} time${open.issued === 1 ? "" : "s"}`}</dd></div>
                  <div className="flex justify-between gap-3 py-2"><dt className="text-muted">Last used</dt><dd className="font-semibold text-primary">{open.lastUsed ?? "—"}</dd></div>
                  <div className="flex justify-between gap-3 py-2"><dt className="shrink-0 text-muted">Asks when issuing</dt><dd className="text-right font-semibold text-primary">{open.asks.length ? open.asks.join(", ") : "Nothing"}</dd></div>
                  <div className="flex justify-between gap-3 py-2"><dt className="text-muted">Versions of this letter</dt><dd className="font-semibold text-primary">{open.versions}</dd></div>
                </dl>
                {open.state === "update" && <UpdateWording id={open.id} onDone={() => setOpen(null)} />}
                <p className="text-xs text-muted">The picture uses sample details and shows the first page. Real letters fill in each person&apos;s own.</p>
                <div className="flex flex-wrap gap-2">
                  {startHref(open) && <Link href={startHref(open)!} className="btn btn-primary">Use letter</Link>}
                  <Link href={`/letter-templates/${open.id}`} className="btn btn-secondary">Edit</Link>
                  <Duplicate id={open.id}><button type="submit" className="btn btn-secondary"><Copy className="h-3.5 w-3.5" aria-hidden /> Duplicate</button></Duplicate>
                </div>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}

/** ⋯ on a card: the occasional actions. */
function DuplicateMenu({ id }: { id: string }) {
  return <RowMenu items={[{ label: "Add another version", onSelect: () => { const fd = new FormData(); fd.set("id", id); void duplicateTemplateAction(fd); } }]} />;
}

/** An untouched ready-made template with newer wording available: one click brings it up to date. */
function UpdateWording({ id, onDone }: { id: string; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run() {
    setBusy(true);
    setError(null);
    const fd = new FormData();
    fd.set("id", id);
    const r = await updateToLatestWordingAction(fd).catch(() => ({ error: "Could not update." }));
    setBusy(false);
    if (r.error) setError(r.error); else onDone();
  }
  return (
    <div className="rounded-lg border border-[var(--brand-primary-border)] bg-brand-soft px-3 py-2.5 text-xs text-secondary">
      <p><b className="text-primary">Newer wording is available.</b> This template has never been edited, so it can be updated to the latest ready-made wording, with a details table.</p>
      <Button size="btn-sm" className="mt-2" type="button" disabled={busy} onClick={run} loading={busy}>Update to the new wording</Button>
      {error && <Alert className="mt-1">{error}</Alert>}
    </div>
  );
}
