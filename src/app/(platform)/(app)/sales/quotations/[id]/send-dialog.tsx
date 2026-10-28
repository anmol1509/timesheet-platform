"use client";

import { Send, Trash2 } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/Dialog";
import { Select } from "@/components/ui/Select";
import { Checkbox } from "@/components/ui/Checkbox";
import { DatePicker } from "@/components/ui/DatePicker";
import { cn } from "@/lib/cn";
import { COVER_FIELDS } from "@/lib/quotationCover";
import { markQuotationSentAction } from "../actions";
import { createQuotationTemplateAction, deleteQuotationTemplateAction } from "../template-actions";

type Template = { id: string; name: string; intro: string; closing: string | null };

/** "Send to client": choose the paper and layout, preview the PDF, download it, and record that it went out. */
export function SendDialog({ quotationId, version, hasLetterhead, companyName, templates: initialTemplates, canSend, label }: { quotationId: string; version: number; hasLetterhead: boolean; companyName: string; templates: Template[]; canSend: boolean; label: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [paper, setPaper] = useState<"LETTERHEAD" | "PLAIN">(hasLetterhead ? "LETTERHEAD" : "PLAIN");
  const [templates, setTemplates] = useState(initialTemplates);
  const [layout, setLayout] = useState("standard");
  const [terms, setTerms] = useState(true);
  const [sig, setSig] = useState(true);
  const [stamp, setStamp] = useState(true);
  const [ot, setOt] = useState(true);
  // The date printed on the cover letter (YYYY-MM-DD); blank means today.
  const [coverDate, setCoverDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [editor, setEditor] = useState<null | { name: string; intro: string; closing: string }>(null);

  const query = useMemo(() => {
    const p = new URLSearchParams({ paper: paper === "LETTERHEAD" ? "letterhead" : "plain", layout, terms: terms ? "1" : "0", sig: sig ? "1" : "0", stamp: stamp ? "1" : "0", ot: ot ? "1" : "0" });
    if (coverDate) p.set("date", coverDate);
    return p.toString();
  }, [paper, layout, terms, sig, stamp, ot, coverDate]);
  const url = `/api/quotations/${quotationId}?${query}`;
  const layoutName = layout === "standard" ? "Standard" : layout === "compact" ? "Compact" : templates.find((t) => t.id === layout)?.name ?? "Custom";

  function markSent() {
    setError(null);
    start(async () => {
      const res = await markQuotationSentAction(quotationId, { paper, layout: layoutName, via: "MARKED" });
      if (res.error) return setError(res.error);
      setDone(true);
      router.refresh();
    });
  }

  async function saveTemplate() {
    if (!editor) return;
    const res = await createQuotationTemplateAction(editor.name, editor.intro, editor.closing);
    if (res.error || !res.id) return setError(res.error ?? "Couldn't save the template.");
    setError(null);
    setTemplates((t) => [...t, { id: res.id!, name: editor.name.trim(), intro: editor.intro.trim(), closing: editor.closing.trim() || null }]);
    setLayout(res.id);
    setEditor(null);
  }

  async function removeTemplate(id: string) {
    const res = await deleteQuotationTemplateAction(id);
    if (res.error) return setError(res.error);
    setTemplates((t) => t.filter((x) => x.id !== id));
    if (layout === id) setLayout("standard");
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setDone(false); setError(null); } }}>
      <DialogTrigger asChild>
        <button type="button" className="btn btn-primary gap-1.5"><Send className="h-4 w-4" aria-hidden />{label}</button>
      </DialogTrigger>
      {open && (
        <DialogContent title="Send quotation" description={`Version ${version}. Choose how it is printed, download the PDF, then record that it went out.`} className="max-w-5xl!">
          <div className="mt-4 grid grid-cols-1 gap-5 lg:grid-cols-[1fr_340px]">
            <div className="space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-muted">Letter date <span className="font-normal">(blank = today)</span></span>
                <DatePicker value={coverDate} onChange={setCoverDate} ariaLabel="Letter date" className="w-48" />
              </label>
              <div>
                <p className="mb-1.5 text-xs font-medium text-muted">Print on</p>
                <div className="grid gap-2">
                  <Option on={paper === "LETTERHEAD"} disabled={!hasLetterhead} onClick={() => setPaper("LETTERHEAD")} title="Company letterhead" body={hasLetterhead ? `${companyName}'s letterhead from Settings. The page margins are kept clear for it.` : "No letterhead is saved yet. Add one under Settings › Company."} />
                  <Option on={paper === "PLAIN"} onClick={() => setPaper("PLAIN")} title="Plain paper" body="No artwork. Prints your company name, address and logo at the top, so it can go on paper that already has a header." />
                </div>
              </div>

              <div>
                <p className="mb-1.5 text-xs font-medium text-muted">Layout</p>
                <Select
                  value={layout}
                  onChange={setLayout}
                  searchable={false}
                  options={[{ value: "standard", label: "Standard · intro, full table, terms" }, { value: "compact", label: "Compact · table only, no intro" }, ...templates.map((t) => ({ value: t.id, label: `${t.name} · your cover text` }))]}
                />
                {layout !== "standard" && layout !== "compact" && (
                  <button type="button" onClick={() => removeTemplate(layout)} className="mt-1.5 inline-flex items-center gap-1 text-xs text-subtle hover:text-[var(--error)]"><Trash2 className="h-3 w-3" aria-hidden />Delete this template</button>
                )}
                {!editor && <button type="button" onClick={() => setEditor({ name: "", intro: "Dear {CONTACT},\n\nFurther to your enquiry, we are pleased to quote as follows.", closing: "We look forward to working with you.\n\nKind regards," })} className="mt-1.5 block text-xs font-medium text-[var(--brand-primary)] hover:underline">Create a cover text template</button>}
                {editor && (
                  <div className="mt-2 space-y-2 rounded-lg border border-default p-3">
                    <input value={editor.name} onChange={(e) => setEditor({ ...editor, name: e.target.value })} placeholder="Template name, e.g. Short-form offer" className="input w-full" />
                    <textarea value={editor.intro} onChange={(e) => setEditor({ ...editor, intro: e.target.value })} rows={3} placeholder="Opening paragraph" className="input w-full" />
                    <textarea value={editor.closing} onChange={(e) => setEditor({ ...editor, closing: e.target.value })} rows={2} placeholder="Closing paragraph (optional)" className="input w-full" />
                    <p className="text-xs text-subtle">Fields filled in automatically: {COVER_FIELDS.map((f) => `{${f.key}}`).join(" ")}</p>
                    <div className="flex gap-2">
                      <button type="button" className="btn btn-primary btn-sm" onClick={saveTemplate}>Save template</button>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditor(null)}>Cancel</button>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-x-6 gap-y-2">
                <Checkbox checked={terms} onCheckedChange={setTerms} label="Terms" />
                <Checkbox checked={sig} onCheckedChange={setSig} label="Signature" />
                <Checkbox checked={stamp} onCheckedChange={setStamp} label="Company stamp" />
                <Checkbox checked={ot} onCheckedChange={setOt} label="OT rate" />
              </div>

              {error && <p role="alert" className="text-sm text-[var(--error)]">{error}</p>}
              {done && <p className="text-sm font-medium text-[var(--success)]">Recorded as sent. It is in the activity.</p>}
            </div>

            <div className="rounded-lg bg-surface-subtle p-2">
              <p className="px-1 pb-1.5 text-xs font-medium text-muted">Preview</p>
              <iframe key={query} src={`${url}&inline=1#toolbar=0&navpanes=0`} title="Quotation preview" className="h-[420px] w-full rounded bg-white" />
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-default pt-4">
            <p className="text-xs text-muted">Sending moves a draft to <b>Sent</b> and logs it in the activity.</p>
            <div className="flex gap-2">
              <a href={url} className="btn btn-secondary">Download PDF</a>
              {canSend && <button type="button" onClick={markSent} disabled={pending || done} className={cn("btn btn-primary")}>{pending ? "Saving…" : done ? "Marked as sent" : "Mark as sent"}</button>}
            </div>
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
}

function Option({ on, onClick, title, body, disabled }: { on: boolean; onClick: () => void; title: string; body: string; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-pressed={on} className={cn("flex gap-3 rounded-xl border p-3 text-left transition disabled:opacity-50", on ? "border-[var(--brand-primary)] bg-brand-soft" : "border-default hover:bg-surface-hover")}>
      <span className={cn("mt-0.5 h-4 w-4 shrink-0 rounded-full border-2", on ? "border-[5px] border-[var(--brand-primary)]" : "border-strong")} aria-hidden />
      <span><span className="block text-sm font-medium text-primary">{title}</span><span className="block text-xs text-muted">{body}</span></span>
    </button>
  );
}
