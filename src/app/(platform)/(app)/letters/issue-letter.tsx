"use client";

import type { Margins } from "@/lib/paperMargins";
import { useEffect, useMemo, useState, useTransition } from "react";
import { FileDown, Loader2, Pencil, RotateCcw } from "lucide-react";
import { LetterEditor } from "@/components/LetterEditor";
import { Select } from "@/components/ui/Select";
import { DatePicker } from "@/components/ui/DatePicker";
import { isDateAsk, isoToLetterDate, letterDateToIso, leftoverPlaceholders } from "@/lib/letterHtml";
import { EmployeeLetterPaper } from "@/components/LetterPreview";
import { editableLetterAction, issueLetterAction, letterIssuersAction, previewLetterAction } from "./actions";
import { FixLetterDialog, type OneOff } from "./fix-letter-dialog";
import type { IssuerKey, IssuerOption } from "@/lib/employeeLetterIssuer";
import { Alert } from "@/components/Alert";

export type TemplateOption = { id: string; name: string; asks: string[]; usesSalary: boolean };
export type EmployeeOption = { id: string; name: string; idNo: string; trade: string | null };

export type BranchDefaults = { signatoryName: string; signatoryTitle: string; signatureUrl: string | null; stampUrl: string | null; letterheadUrl: string | null; topMm: number; bottomMm: number; plain: Margins; letterheadSides: { left: number; right: number } };

export type PopularTemplate = { id: string; name: string; count: number };

export function IssueLetter({ employees, templates, popular, companyName, today, canIssue, defaults, initialEmployeeId, preferTemplate, branchId, canSaveDefault }: { branchId: string; canSaveDefault: { profile: boolean; supplier: boolean }; popular: PopularTemplate[]; initialEmployeeId?: string; preferTemplate?: string; employees: EmployeeOption[]; templates: TemplateOption[]; companyName: string; today: string; canIssue: boolean; defaults: BranchDefaults }) {
  // Printing choices. All optional; signature and stamp start off so nothing is signed or stamped by accident.
  const [signatoryName, setSignatoryName] = useState(defaults.signatoryName);
  const [signatoryTitle, setSignatoryTitle] = useState(defaults.signatoryTitle);
  const [showSignature, setShowSignature] = useState(false);
  const [showStamp, setShowStamp] = useState(false);
  const [onLetterhead, setOnLetterhead] = useState(false);
  const [allowEmpty, setAllowEmpty] = useState(false);
  const [employeeId, setEmployeeId] = useState(employees.some((e) => e.id === initialEmployeeId) ? initialEmployeeId! : "");
  const [templateId, setTemplateId] = useState(templates.find((t) => preferTemplate && t.name.toLowerCase().includes(preferTemplate.toLowerCase()))?.id ?? templates[0]?.id ?? "");
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [fixOpen, setFixOpen] = useState(false);
  // Words changed for this one letter: none = as the template wrote it. The edit is tied to the employee, letter,
  // answers and letterhead it was made for; change any of them and it no longer applies. `editorKey` remounts the editor.
  const [editState, setEditState] = useState<{ scope: string; html: string; title: string; editing: boolean } | null>(null);
  const [editorKey, setEditorKey] = useState(0);
  const [openingEdit, setOpeningEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [oneOffSig, setOneOffSig] = useState<OneOff>(null);
  const [oneOffStamp, setOneOffStamp] = useState<OneOff>(null);
  const [reload, setReload] = useState(0);
  // Whose letterhead, signature and stamp: the visa company, the supplier company or the company profile.
  const [issuers, setIssuers] = useState<IssuerOption[]>([]);
  const [issuerKey, setIssuerKey] = useState<IssuerKey | "">("");
  const profileFallback: IssuerOption = { key: "PROFILE", label: companyName, name: companyName, supplierId: null, letterheadUrl: defaults.letterheadUrl, letterheadKind: defaults.letterheadUrl ? "image" : null, topMm: defaults.topMm, bottomMm: defaults.bottomMm, signatoryName: defaults.signatoryName, signatoryTitle: defaults.signatoryTitle, signatureUrl: defaults.signatureUrl, stampUrl: defaults.stampUrl, where: "Settings → Company profile → Letters" };
  const issuer = issuers.find((o) => o.key === issuerKey) ?? profileFallback;
  const signatureUrl = oneOffSig?.url ?? issuer.signatureUrl;
  const stampUrl = oneOffStamp?.url ?? issuer.stampUrl;
  const [preview, setPreview] = useState<{ html?: string; title?: string; missing?: string[]; empty?: string[]; gaps?: { key: string; label: string }[]; error?: string } | null>(null);
  // Fixing what is missing: the dialog, a signature or stamp for this letter only, and a nudge to reload the preview.
  const [loading, startPreview] = useTransition();
  const [issuing, startIssue] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const template = templates.find((t) => t.id === templateId);
  // The date printed on the letter (YYYY-MM-DD); blank means today. Part of the key, so changing it refreshes the preview and drops a stale hand-edit.
  const [letterDate, setLetterDate] = useState("");
  const key = useMemo(() => JSON.stringify([inputs, letterDate]), [inputs, letterDate]);

  function chooseIssuer(next: IssuerOption) {
    setIssuerKey(next.key);
    // The signatory and the images belong to the company chosen; nothing is signed or stamped unless ticked again.
    setSignatoryName(next.signatoryName);
    setSignatoryTitle(next.signatoryTitle);
    setShowSignature(false);
    setShowStamp(false);
    setPreview(null);
  }

  // Each employee has their own choices of letterhead; the best one is picked to start with.
  useEffect(() => {
    setIssuers([]);
    setIssuerKey("");
    if (!employeeId) return;
    let live = true;
    void letterIssuersAction(employeeId).then((r) => {
      if (!live) return;
      const list = r.options ?? [];
      setIssuers(list);
      if (list[0]) chooseIssuer(list[0]);
      else setIssuerKey("PROFILE");
    }).catch(() => { if (live) setIssuerKey("PROFILE"); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId]);

  // Debounced live preview with the person's real details.
  useEffect(() => {
    if (!employeeId || !templateId || !issuerKey) return;
    const t = setTimeout(() => startPreview(async () => setPreview(await previewLetterAction(employeeId, templateId, inputs, issuerKey, letterDate))), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId, templateId, key, issuerKey, reload]);

  const editScope = [employeeId, templateId, key, issuerKey, reload].join("|");
  const live = editState && editState.scope === editScope ? editState : null;
  const edited = live ? live.html : null;
  const editing = !!live?.editing;
  const editedTitle = live ? live.title : null;
  const setEdited = (html: string | null) => setEditState(html === null ? null : (cur) => ({ scope: editScope, html, title: cur?.scope === editScope ? cur.title : "", editing: cur?.scope === editScope ? cur.editing : false }));
  const setEditedTitle = (title: string) => setEditState((cur) => (cur && cur.scope === editScope ? { ...cur, title } : cur));
  const setEditing = (on: boolean) => setEditState((cur) => (cur && cur.scope === editScope ? { ...cur, editing: on } : cur));

  const emptyFields = preview?.empty ?? [];
  // Highlighted blanks still in edited wording hold the letter back unless the person chooses to issue with gaps.
  const leftBlanks = edited !== null ? leftoverPlaceholders(edited, emptyFields) : [];
  const ready = !!employeeId && !!template && preview?.html && !(preview.missing?.length) && (emptyFields.length === 0 || allowEmpty || edited !== null) && (leftBlanks.length === 0 || allowEmpty);
  const shown = employeeId && template ? preview : null;

  /** Opens the editor: the letter's words with each missing detail shown as a highlighted "[Label]", unless it was already edited. */
  async function openEditor(fallbackHtml: string) {
    setEditError(null);
    if (edited !== null) { setEditState({ scope: editScope, html: edited, title: editedTitle ?? "", editing: true }); setEditorKey((n) => n + 1); return; }
    setOpeningEdit(true);
    const r = await editableLetterAction(employeeId, templateId, inputs, (issuerKey || "PROFILE") as IssuerKey, letterDate).catch(() => ({ error: "Couldn't open the letter for editing." }));
    setOpeningEdit(false);
    if ("error" in r && r.error) { setEditError(r.error); return; }
    setEditState({ scope: editScope, html: ("html" in r && r.html) || fallbackHtml, title: ("title" in r && r.title) || shown?.title || "", editing: true });
    setEditorKey((n) => n + 1);
  }

  function issue() {
    setError(null);
    startIssue(async () => {
      const res = await issueLetterAction(employeeId, templateId, inputs, { letterDate, issuer: (issuerKey || "PROFILE") as IssuerKey, onLetterhead, signatoryName, signatoryTitle, showSignature, showStamp, signatureImageId: showSignature ? oneOffSig?.id ?? null : null, stampImageId: showStamp ? oneOffStamp?.id ?? null : null }, allowEmpty, edited, editedTitle);
      if (res.error) setError(res.error);
      else if (res.id) window.open(`/api/letters/${res.id}/pdf`, "_blank");
    });
  }

  if (templates.length === 0) return null;

  const cardCls = "rounded-[var(--radius-card)] border border-default bg-surface";
  const toggle = (label: string, on: boolean, available: boolean, set: (v: boolean) => void, missing: string) => (
    <label className={`flex items-center justify-between gap-2 text-sm ${available ? "cursor-pointer text-primary" : "text-subtle"}`}>
      <span className="flex items-center gap-2"><input type="checkbox" checked={on} disabled={!available} onChange={(e) => set(e.target.checked)} />{label}</span>
      {!available && (canIssue && employeeId
        ? <button type="button" onClick={(e) => { e.preventDefault(); setFixOpen(true); }} className="shrink-0 text-xs font-semibold whitespace-nowrap text-brand hover:underline" title={`Not uploaded. Saved under ${issuer.where}`}>Upload now</button>
        : <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-[11px] font-medium text-muted" title={`Add one under ${issuer.where}`}>{missing}</span>)}
    </label>
  );

  return (
    <div className="space-y-5">
      {popular.length > 0 && (
        <section aria-label="Quick start">
          <p className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">Quick start</p>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {popular.map((p) => (
              <button key={p.id} type="button" onClick={() => { setTemplateId(p.id); setInputs({}); setPreview(null); }} aria-pressed={templateId === p.id}
                className={`flex items-center gap-3 rounded-[var(--radius-card)] border px-4 py-3 text-left transition ${templateId === p.id ? "border-[var(--brand-primary)] bg-brand-soft" : "border-default bg-surface hover:border-strong hover:bg-surface-hover"}`}>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-surface-sunken text-sm font-semibold text-[var(--brand-primary)]" aria-hidden>{p.name.slice(0, 1)}</span>
                <span className="min-w-0"><span className="block truncate text-sm font-semibold text-primary">{p.name}</span><span className="block text-xs text-muted">{p.count > 0 ? `${p.count} issued` : "Not used yet"}</span></span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className={`${cardCls} grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3`}>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold tracking-wide text-muted uppercase">Employee</span>
          <Select value={employeeId} onChange={(v) => { setEmployeeId(v); setPreview(null); setAllowEmpty(false); setOneOffSig(null); setOneOffStamp(null); setShowSignature(false); setShowStamp(false); }} placeholder="Choose an employee…" searchPlaceholder="Search name or ID…" options={employees.map((e) => ({ value: e.id, label: `${e.name} · ${e.idNo}` }))} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold tracking-wide text-muted uppercase">Letter</span>
          <Select value={templateId} onChange={(v) => { setTemplateId(v); setInputs({}); setPreview(null); }} options={templates.map((t) => ({ value: t.id, label: t.name }))} triggerClassName="w-full" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold tracking-wide text-muted uppercase">Letter date <span className="font-normal normal-case">(blank = today)</span></span>
          <DatePicker value={letterDate} onChange={setLetterDate} ariaLabel="Letter date" className="w-full" />
        </label>
        {template?.asks.map((label) => (
          <label key={label} className="block">
            <span className="mb-1 block text-xs font-semibold tracking-wide text-muted uppercase">{label}</span>
            {isDateAsk(label)
              ? <DatePicker value={letterDateToIso(inputs[label] ?? "")} onChange={(iso) => setInputs((prev) => ({ ...prev, [label]: isoToLetterDate(iso) }))} ariaLabel={label} className="w-full" />
              : <input value={inputs[label] ?? ""} onChange={(e) => setInputs((prev) => ({ ...prev, [label]: e.target.value }))} className="input w-full" />}
          </label>
        ))}
        {template?.usesSalary && <p className="self-end text-xs text-muted sm:col-span-2 lg:col-span-3">This letter states the employee&apos;s salary from their Payroll &amp; WPS tab.</p>}
      </section>

      <div className="grid gap-5 lg:grid-cols-[18.5rem_minmax(0,1fr)]">
        <aside className={`${cardCls} space-y-4 self-start p-4`}>
          <div>
            <span className="mb-1.5 block text-xs font-semibold tracking-wide text-muted uppercase">Print on</span>
            <div className="inline-flex overflow-hidden rounded-[10px] border border-default" role="group" aria-label="Paper">
              {[["Plain paper", false], ["Letterhead", true]].map(([l, v]) => (
                <button key={String(l)} type="button" aria-pressed={onLetterhead === v} onClick={() => setOnLetterhead(v as boolean)} className={`px-3 py-1.5 text-sm ${onLetterhead === v ? "bg-brand-soft font-semibold text-[var(--brand-primary)]" : "text-secondary hover:bg-surface-hover"}`}>{l as string}</button>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-muted">{onLetterhead ? (issuer.letterheadKind === "image" ? `Uses the letterhead of ${issuer.name}.` : issuer.letterheadKind === "pdf" ? `Uses the PDF letterhead of ${issuer.name}. It appears on the issued PDF, not in this preview.` : `No letterhead uploaded for ${issuer.name}: the header and footer space is left clear for pre-printed paper.`) : "Plain or blank paper: no header from us, just the letter inside the margins set in Company profile › Letters."}</p>
          </div>
          {issuers.length > 1 && (
            <label className="block">
              <span className="mb-1 block text-xs font-semibold tracking-wide text-muted uppercase">Letterhead of</span>
              <Select value={issuerKey} onChange={(v) => { const o = issuers.find((x) => x.key === v); if (o) chooseIssuer(o); }} searchable={false} options={issuers.map((o) => ({ value: o.key, label: o.label }))} triggerClassName="w-full" />
            </label>
          )}
          <label className="block">
            <span className="mb-1 block text-xs font-semibold tracking-wide text-muted uppercase">Signed by</span>
            <input value={signatoryName} onChange={(e) => setSignatoryName(e.target.value)} placeholder="Authorised Signatory" className="input w-full" />
            <input value={signatoryTitle} onChange={(e) => setSignatoryTitle(e.target.value)} placeholder="Title, e.g. General Manager" aria-label="Title" className="input mt-2 w-full" />
          </label>
          <div className="space-y-2">
            {toggle("Signature", showSignature, !!signatureUrl, setShowSignature, "Not uploaded")}
            {toggle("Company stamp", showStamp, !!stampUrl, setShowStamp, "Not uploaded")}
          </div>
          <p className="text-xs text-muted">Signature and stamp are added only when ticked.</p>
        </aside>

        <div className="min-w-0 space-y-3">
          <div className="max-h-[72vh] overflow-y-auto rounded-[var(--radius-card)] bg-surface-sunken p-4">
            <div className="mb-2 flex flex-wrap items-center gap-2 text-xs font-medium text-muted">
              Preview {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
              {canIssue && shown?.html && !editing && (
                <button type="button" disabled={openingEdit} onClick={() => openEditor(shown.html ?? "")} className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-default bg-surface px-3 py-1 text-xs font-semibold text-primary transition-colors hover:border-[var(--brand-primary)]">
                  <Pencil className="h-3 w-3" aria-hidden /> {openingEdit ? "Opening…" : edited !== null ? "Edit again" : "Edit this letter"}
                </button>
              )}
            </div>
            {editError && <Alert inline className="mb-2">{editError}</Alert>}
            {edited !== null && leftBlanks.length > 0 && (
              <p className="mb-2 rounded-lg border border-[var(--warning-border)] bg-[var(--warning-soft)] px-3 py-2 text-xs text-secondary"><b className="text-primary">Still to fill in:</b> {leftBlanks.map((l) => `[${l}]`).join(", ")}. They show highlighted in the wording. Type the real details over them, or add them to the employee&apos;s record with Fix missing details and edit again.</p>
            )}
            {edited !== null && (
              <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-[var(--warning-border)] bg-[var(--warning-soft)] px-3 py-2 text-xs text-secondary">
                <p className="min-w-0 flex-1"><span className="font-semibold text-primary">{editing ? "Editing this letter only." : "This letter has been edited."}</span> The template is not changed, and the history will mark it Edited. Changing the employee, letter or answers starts again from the template.</p>
                {editing && <button type="button" className="btn btn-primary btn-sm" onClick={() => setEditing(false)}>Done</button>}
                <button type="button" className="inline-flex items-center gap-1 font-semibold text-brand hover:underline" onClick={() => { setEdited(null); setEditing(false); }}><RotateCcw className="h-3 w-3" aria-hidden /> Reset to template</button>
              </div>
            )}
            {editing && edited !== null ? (
              <div className="space-y-3">
                <label className="block"><span className="mb-1 block text-xs font-medium text-muted">Heading printed on the letter</span><input value={editedTitle ?? ""} onChange={(e) => setEditedTitle(e.target.value)} maxLength={120} className="input w-full" aria-label="Heading" /></label>
                <LetterEditor key={editorKey} html={edited} onChange={setEdited} fields={[]} audience="EMPLOYEE" oneOff />
              </div>
            ) : shown?.html ? (
              <EmployeeLetterPaper companyName={issuer.name} refNo="LTR-••••••" date={letterDate ? isoToLetterDate(letterDate) : today} title={(edited !== null && editedTitle?.trim()) || shown.title || ""} html={edited ?? shown.html} options={{ onLetterhead, letterheadUrl: issuer.letterheadUrl, topMm: issuer.topMm, bottomMm: issuer.bottomMm, margins: onLetterhead ? { top: issuer.topMm, bottom: issuer.bottomMm, ...defaults.letterheadSides } : defaults.plain, signatoryName, signatoryTitle, signatureUrl: showSignature ? signatureUrl : null, stampUrl: showStamp ? stampUrl : null }} />
            ) : (
              <p className="py-16 text-center text-sm text-muted">{employeeId ? (shown?.error ?? "Preparing…") : "Choose an employee to see the letter with their details filled in."}</p>
            )}
          </div>
          <div className={`${cardCls} sticky bottom-3 z-10 space-y-2 p-3 shadow-lg`}>
            {emptyFields.length > 0 && (
              <div className="rounded-lg border border-[var(--warning-border)] bg-[var(--warning-soft)] px-3 py-2 text-xs text-secondary">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p><span className="font-semibold text-primary">{emptyFields.length} {emptyFields.length === 1 ? "detail is" : "details are"} missing on this employee&apos;s record</span> and would print as a gap.</p>
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => setFixOpen(true)}>Fix missing details</button>
                </div>
                <details className="mt-1"><summary className="cursor-pointer text-muted hover:underline">Which ones</summary><p className="mt-1">{emptyFields.join(", ")}</p></details>
                <label className="mt-1.5 flex items-center gap-2 text-muted"><input type="checkbox" checked={allowEmpty} onChange={(e) => setAllowEmpty(e.target.checked)} /> Issue anyway, with the gaps</label>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <p className="min-w-0 flex-1 text-sm text-secondary">
                {!employeeId ? "Choose an employee to start." : shown?.missing && shown.missing.length > 0 ? `Fill in: ${shown.missing.join(", ")}` : ready ? <><b className="font-semibold text-primary">Ready to issue.</b> <span className="text-muted">Numbers the letter, saves its exact wording and records who issued it.</span></> : "Preparing the letter…"}
              </p>
              {canIssue ? (
                <button type="button" className="btn btn-primary" disabled={!ready || issuing} onClick={issue}>
                  <FileDown className="h-4 w-4" aria-hidden /> {issuing ? "Issuing…" : "Issue letter & open PDF"}
                </button>
              ) : (
                <p className="text-xs text-muted">You can preview letters but not issue them.</p>
              )}
            </div>
            {(error || shown?.error) && <Alert>{error ?? shown?.error}</Alert>}
          </div>
        </div>
      </div>
      {employeeId && template && (
        <FixLetterDialog
          open={fixOpen}
          onOpenChange={setFixOpen}
          employeeId={employeeId}
          employeeName={employees.find((e) => e.id === employeeId)?.name ?? ""}
          templateName={template.name}
          gaps={preview?.gaps ?? []}
          issuer={issuer}
          branchId={branchId}
          canSaveDefault={issuer.supplierId ? canSaveDefault.supplier : canSaveDefault.profile}
          oneOffSignature={oneOffSig}
          oneOffStamp={oneOffStamp}
          onOneOff={(kind, img) => { if (kind === "signature") { setOneOffSig(img); setShowSignature(true); } else { setOneOffStamp(img); setShowStamp(true); } }}
          onSaved={(what, kind) => {
            if (what === "details") { setReload((n) => n + 1); setAllowEmpty(false); return; }
            void letterIssuersAction(employeeId).then((r) => { if (r.options) setIssuers(r.options); });
            if (kind === "signature") setShowSignature(true); else setShowStamp(true);
          }}
        />
      )}
    </div>
  );
}
