"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import * as RadixDialog from "@radix-ui/react-dialog";
import { ArrowRight, Check, ChevronLeft, ChevronRight, ExternalLink, X } from "lucide-react";
import { EmployeeAvatar } from "@/components/Avatar";
import { DatePicker } from "@/components/ui/DatePicker";
import { CountrySelect } from "@/components/ui/CountrySelect";
import { Select } from "@/components/ui/Select";
import { MaskedInput } from "@/components/ui/MaskedInput";
import { PhoneField } from "@/components/ui/PhoneField";
import { complianceStatus, daysUntil } from "@/lib/compliance";
import { cn } from "@/lib/cn";
import type { ExtractedDocumentFields } from "@/app/api/documents/extract/route";
import { InlineDocumentUpload } from "./[id]/inline-document-upload";
import { loadQuickViewAction, saveEmployeeFieldAction, type QuickView, type SaveResult } from "./quick-view";
import { BLOOD_GROUPS } from "./quick-view-fields";

export type DrawerPerson = { id: string; name: string; complete: boolean };

type TabId = "overview" | "documents" | "missing";
type Kind = "text" | "phone" | "passport" | "eid";
type Save = (field: string, value: string | null, label: string, confirm?: boolean) => Promise<SaveResult>;

const STATUS_PILL: Record<string, string> = { ACTIVE: "Active", IDLE: "On bench", UNDER_MOBILISATION: "Mobilising", ON_SITE: "On site", ON_VACATION: "On leave", TERMINATED: "Terminated" };
const DOCS = [
  { type: "VISA", label: "Visa", field: "visaExpiry" },
  { type: "LABOR_CARD", label: "Labour card", field: "laborCardExpiry" },
  { type: "MEDICAL", label: "Medical", field: "medicalExpiry" },
  { type: "PASSPORT", label: "Passport", field: "passportExpiry" },
  { type: "EMIRATES_ID", label: "Emirates ID", field: "emiratesIdExpiry" },
] as const;
const SCAN_TYPES = new Set(["PASSPORT", "VISA", "EMIRATES_ID"]);
const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }) : "—");

/** What the person still has to supply, in the order the profile form asks for it. */
function gapsFor(d: QuickView) {
  const hasScan = d.docs.some((x) => SCAN_TYPES.has(x.type));
  const items: { key: string; label: string; done: boolean; level: "Required" | "Recommended" }[] = [
    { key: "passportNumber", label: "Passport number", done: !!d.passportNumber, level: "Required" },
    { key: "emiratesId", label: "Emirates ID", done: !!d.emiratesId, level: "Required" },
    { key: "nationality", label: "Nationality", done: !!d.nationality, level: "Required" },
    { key: "dateOfBirth", label: "Date of birth", done: !!d.dateOfBirth, level: "Required" },
    { key: "scan", label: "Passport, visa or Emirates ID scan", done: hasScan, level: "Required" },
    { key: "mobileNumber", label: "Mobile number", done: !!d.mobileNumber, level: "Recommended" },
  ];
  if (d.category === "SITE_STAFF") items.push({ key: "projectId", label: "Project", done: !!d.projectId, level: "Recommended" });
  return items;
}

function applyField(d: QuickView, field: string, value: string | null): QuickView {
  if (field in d.expiry) return { ...d, expiry: { ...d.expiry, [field]: value } };
  if (field === "projectId") return { ...d, projectId: value, projectName: d.projects.find((p) => p.id === value)?.name ?? null };
  return { ...d, [field]: value };
}

/** Runs a save, holding on to the busy flag and any message that needs the person's attention. */
function useFieldFlow(onSave: (value: string | null, confirm?: boolean) => Promise<SaveResult>) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ error?: string; warnings?: string[]; value?: string | null } | null>(null);
  async function run(value: string | null, confirm = false) {
    setBusy(true);
    setMsg(null);
    try {
      const r = await onSave(value, confirm);
      if (r.ok) return true;
      setMsg({ error: r.error, warnings: r.warnings, value });
      return false;
    } catch {
      setMsg({ error: "That didn't save. Please try again." });
      return false;
    } finally {
      setBusy(false);
    }
  }
  return { busy, msg, run, clear: () => setMsg(null) };
}

function Notice({ msg, onConfirm, onDismiss }: { msg: { error?: string; warnings?: string[] } | null; onConfirm: () => void; onDismiss: () => void }) {
  if (!msg) return null;
  if (msg.error) return <p role="alert" className="mt-1 text-xs text-[var(--error)]">{msg.error}</p>;
  if (!msg.warnings?.length) return null;
  return (
    <div role="alert" className="mt-1.5 rounded-lg border border-[var(--warning-border)] bg-[var(--warning-soft)] p-2 text-xs text-primary">
      <ul className="list-disc space-y-0.5 pl-4">{msg.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
      <div className="mt-1.5 flex gap-3 font-medium">
        <button type="button" className="text-[var(--brand-primary)] hover:underline" onClick={onConfirm}>Save anyway</button>
        <button type="button" className="text-secondary hover:underline" onClick={onDismiss}>Change it</button>
      </div>
    </div>
  );
}

function TextEditor({ kind, value, onChange, autoFocus }: { kind: Kind; value: string; onChange: (v: string) => void; autoFocus?: boolean }) {
  if (kind === "phone") return <PhoneField value={value} onChange={onChange} />;
  if (kind === "passport" || kind === "eid") return <MaskedInput kind={kind} value={value} onChange={(e) => onChange(e.target.value)} autoFocus={autoFocus} className="input w-full" />;
  return <input value={value} onChange={(e) => onChange(e.target.value)} autoFocus={autoFocus} className="input w-full" />;
}

/** A value that turns into an input when clicked: Enter saves, Esc cancels. */
function ClickToEdit({ label, value, kind = "text", placeholder = "Add", onSave }: { label: string; value: string | null; kind?: Kind; placeholder?: string; onSave: (v: string | null, confirm?: boolean) => Promise<SaveResult> }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const flow = useFieldFlow(onSave);
  // The panel's own Esc handler stands down while a field is open; this closes the field instead.
  useEffect(() => {
    if (!editing) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") { setEditing(false); flow.clear(); } };
    document.addEventListener("keydown", esc, true);
    return () => document.removeEventListener("keydown", esc, true);
  }, [editing, flow]);
  async function commit(confirm = false) {
    if (draft.trim() === (value ?? "")) return setEditing(false);
    if (await flow.run(draft.trim() || null, confirm)) setEditing(false);
  }
  if (!editing) {
    return (
      <button type="button" aria-label={`Edit ${label}`} onClick={() => { setDraft(value ?? ""); setEditing(true); }} className="-ml-2 max-w-full truncate rounded-lg border border-transparent px-2 py-1 text-left font-medium text-primary hover:border-default hover:bg-surface-hover">
        {value || <span className="font-normal text-subtle">{placeholder}</span>}
      </button>
    );
  }
  return (
    <form data-editing onSubmit={(e) => { e.preventDefault(); void commit(); }} >
      <div className="flex items-center gap-1.5">
        <div className="min-w-0 flex-1"><TextEditor kind={kind} value={draft} onChange={setDraft} autoFocus /></div>
        <button type="submit" disabled={flow.busy} aria-label={`Save ${label}`} className="btn btn-primary btn-sm px-2"><Check className="h-3.5 w-3.5" aria-hidden /></button>
        <button type="button" aria-label="Cancel" onClick={() => { setEditing(false); flow.clear(); }} className="btn btn-secondary btn-sm px-2"><X className="h-3.5 w-3.5" aria-hidden /></button>
      </div>
      <p className="mt-0.5 text-[10.5px] text-subtle">Enter to save · Esc to cancel</p>
      <Notice msg={flow.msg} onConfirm={() => void commit(true)} onDismiss={flow.clear} />
    </form>
  );
}

/** Dropdowns, countries and dates save the moment a choice is made. */
function ChoiceField({ kind, value, options, onSave, placeholder }: { kind: "select" | "country" | "date" | "project"; value: string | null; options?: { value: string; label: string }[]; onSave: (v: string | null, confirm?: boolean) => Promise<SaveResult>; placeholder?: string }) {
  const flow = useFieldFlow(onSave);
  const change = (v: string) => { if (v !== (value ?? "")) void flow.run(v || null); };
  return (
    <div className="min-w-0">
      {kind === "country" && <CountrySelect value={value ?? ""} onChange={change} />}
      {(kind === "select" || kind === "project") && <Select value={value ?? ""} onChange={change} options={[{ value: "", label: placeholder ?? "Not set" }, ...(options ?? [])]} searchable={kind === "project"} placeholder={placeholder ?? "Not set"} />}
      {kind === "date" && <DatePicker value={value ?? ""} onChange={change} fromYear={1940} toYear={new Date().getFullYear() + 12} />}
      <Notice msg={flow.msg} onConfirm={() => void flow.run(flow.msg?.value ?? null, true)} onDismiss={flow.clear} />
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[96px_minmax(0,1fr)] items-start gap-3 border-b border-default px-3 py-2 text-sm last:border-b-0">
      <dt className="pt-1.5 text-muted">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

function ReadOnly({ value, href }: { value: string | null; href: string }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1">
      <span className={cn("truncate font-medium", value ? "text-primary" : "text-subtle")}>{value ?? "Not set"}</span>
      <Link href={href} className="shrink-0 text-xs text-[var(--brand-primary)] hover:underline">Change in profile</Link>
    </div>
  );
}

function Pill({ tone, children }: { tone: "ok" | "warn" | "err" | "mute"; children: React.ReactNode }) {
  const c = { ok: "bg-[var(--success-soft)] text-[var(--success)]", warn: "bg-[var(--warning-soft)] text-[var(--warning)]", err: "bg-[var(--error-soft)] text-[var(--error)]", mute: "bg-surface-sunken text-muted" }[tone];
  return <span className={cn("inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10.5px] font-semibold", c)}>{children}</span>;
}

function docState(iso: string | null): { tone: "ok" | "warn" | "err" | "mute"; text: string; days: number | null } {
  if (!iso) return { tone: "mute", text: "Not recorded", days: null };
  const days = daysUntil(new Date(iso));
  const s = complianceStatus(new Date(iso));
  if (s === "expired") return { tone: "err", text: `Expired ${-days}d ago`, days };
  if (s === "expiring") return { tone: "warn", text: days === 0 ? "Expires today" : `Expires in ${days}d`, days };
  return { tone: "ok", text: "Valid", days };
}

export function EmployeeDrawer({ id, order, people, onNavigate, onClose }: { id: string; order: string[]; people: Map<string, DrawerPerson>; onNavigate: (id: string) => void; onClose: () => void }) {
  const router = useRouter();
  const [state, setState] = useState<{ id: string; data: QuickView | null } | null>(null);
  const [tab, setTab] = useState<TabId>("overview");
  const [openDoc, setOpenDoc] = useState<string | null>(null);
  const [suggest, setSuggest] = useState<{ id: string; map: Record<string, string> }>({ id, map: {} });
  const [undo, setUndo] = useState<{ field: string; label: string; previous: string | null } | null>(null);
  const data = state?.id === id ? state.data : undefined; // undefined while loading
  const hints = suggest.id === id ? suggest.map : {};

  useEffect(() => {
    let off = false;
    loadQuickViewAction(id).then((d) => { if (!off) setState({ id, data: d }); });
    return () => { off = true; };
  }, [id]);
  useEffect(() => {
    if (!undo) return;
    const t = setTimeout(() => setUndo(null), 7000);
    return () => clearTimeout(t);
  }, [undo]);

  const reload = () => { void loadQuickViewAction(id).then((d) => setState({ id, data: d })); router.refresh(); };

  const save: Save = async (field, value, label, confirm = false) => {
    const r = await saveEmployeeFieldAction({ id, field, value, confirm });
    if (r.ok) {
      setState((s) => (s && s.id === id && s.data ? { ...s, data: applyField(s.data, field, r.value) } : s));
      setUndo({ field, label, previous: r.previous });
      router.refresh();
    }
    return r;
  };
  const doUndo = async () => {
    if (!undo) return;
    const u = undo;
    setUndo(null);
    const r = await saveEmployeeFieldAction({ id, field: u.field, value: u.previous, confirm: true });
    if (r.ok) {
      setState((s) => (s && s.id === id && s.data ? { ...s, data: applyField(s.data, u.field, r.value) } : s));
      router.refresh();
    }
  };
  const bound = (field: string, label: string) => (v: string | null, confirm?: boolean) => save(field, v, label, confirm);

  function onExtracted(f: ExtractedDocumentFields) {
    const map: Record<string, string> = {};
    for (const k of ["passportNumber", "emiratesId", "nationality", "dateOfBirth", "passportExpiry", "emiratesIdExpiry", "laborCardExpiry"] as const) if (f[k]) map[k] = f[k] as string;
    setSuggest({ id, map: { ...hints, ...map } });
  }

  const index = order.indexOf(id);
  const go = (delta: number) => { if (order.length > 1) onNavigate(order[(index + delta + order.length) % order.length]); };
  const withGaps = order.filter((x) => people.get(x) && !people.get(x)!.complete);
  const nextGap = () => {
    const after = [...order.slice(index + 1), ...order.slice(0, index)].find((x) => x !== id && people.get(x) && !people.get(x)!.complete);
    if (after) { setTab("missing"); onNavigate(after); }
  };

  const gaps = useMemo(() => (data ? gapsFor(data) : []), [data]);
  const open = gaps.filter((g) => !g.done);
  const pct = gaps.length ? Math.round(((gaps.length - open.length) / gaps.length) * 100) : 100;
  const urgent = data ? DOCS.map((d) => ({ ...d, st: docState(data.expiry[d.field]) })).filter((d) => d.st.tone === "err" || d.st.tone === "warn").sort((a, b) => (a.st.days ?? 0) - (b.st.days ?? 0))[0] : undefined;
  const badge = data ? (data.status === "ACTIVE" || data.status === "IDLE" ? (data.projectName ? "Deployed" : "On bench") : (STATUS_PILL[data.status] ?? data.status)) : "";
  const profileHref = `/employees/${id}`;

  const tabs: { id: TabId; label: string; count?: number }[] = [
    { id: "overview", label: "Overview" },
    { id: "documents", label: "Documents" },
    { id: "missing", label: "Missing", count: open.length },
  ];

  return (
    <RadixDialog.Root open onOpenChange={(o) => !o && onClose()}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="rx-overlay fixed inset-0 z-40 bg-[#101828]/30" />
        <RadixDialog.Content
          aria-describedby={undefined}
          // Esc cancels a field being edited before it closes the panel.
          onEscapeKeyDown={(e) => { if (document.querySelector("[data-editing]")) e.preventDefault(); }}
          onKeyDown={(e) => {
            const t = e.target as HTMLElement;
            if (t.closest("input,textarea,select,[role=combobox],[contenteditable=true]")) return;
            if (e.key === "j") go(1);
            if (e.key === "k") go(-1);
          }}
          className="rx-drawer fixed top-3 right-3 bottom-3 z-50 flex w-[440px] max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-[22px] border border-default bg-surface shadow-modal outline-none"
        >
          <header className="bg-[linear-gradient(135deg,#43359f_0%,#5b49d8_55%,#7a4fe3_100%)] px-5 pt-3.5 text-white">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5">
                <button type="button" onClick={() => go(-1)} disabled={order.length < 2} aria-label="Previous person" className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/15 hover:bg-white/25 disabled:opacity-40"><ChevronLeft className="h-4 w-4" aria-hidden /></button>
                <button type="button" onClick={() => go(1)} disabled={order.length < 2} aria-label="Next person" className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/15 hover:bg-white/25 disabled:opacity-40"><ChevronRight className="h-4 w-4" aria-hidden /></button>
                {index >= 0 && <span className="ml-1 text-white/75">{index + 1} of {order.length}</span>}
              </span>
              <span className="flex items-center gap-2.5">
                <Link href={profileHref} className="flex items-center gap-1 font-medium text-white/90 hover:text-white">Open full profile<ExternalLink className="h-3 w-3" aria-hidden /></Link>
                <RadixDialog.Close aria-label="Close" className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/15 hover:bg-white/25"><X className="h-4 w-4" aria-hidden /></RadixDialog.Close>
              </span>
            </div>
            <div className="mt-3 flex items-center gap-3">
              {data && <EmployeeAvatar employeeId={data.id} name={data.name} hasPhoto={data.hasPhoto} size="lg" />}
              <div className="min-w-0 flex-1">
                <RadixDialog.Title className="truncate text-lg font-semibold tracking-tight">{data ? data.name : "Loading…"}</RadixDialog.Title>
                {data && <p className="truncate text-xs text-white/80">{data.category === "STAFF" ? (data.position ?? "Staff") : (data.trade ?? "Site staff")} · {data.employeeIdNo}{data.nationality ? ` · ${data.nationality}` : ""}</p>}
              </div>
              {data && <span className="shrink-0 rounded-full bg-white/20 px-2.5 py-0.5 text-[10.5px] font-semibold">{badge}</span>}
            </div>
            <div role="tablist" aria-label="Employee sections" className="mt-3 flex gap-0.5">
              {tabs.map((t) => (
                <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
                  className={cn("flex items-center gap-1.5 rounded-t-[10px] px-3 py-2 text-sm font-medium", tab === t.id ? "bg-surface text-[var(--brand-primary)]" : "text-white/75 hover:text-white")}>
                  {t.label}
                  {!!t.count && <span className="rounded-full bg-[#fde68a] px-1.5 text-[10px] font-bold text-[#78350f]">{t.count}</span>}
                </button>
              ))}
            </div>
          </header>

          <div className="flex-1 overflow-y-auto px-5 py-4" role="tabpanel">
            {data === undefined && <div className="space-y-3" aria-busy="true">{[0, 1, 2, 3].map((n) => <div key={n} className="h-10 animate-pulse rounded-xl bg-surface-sunken" />)}</div>}
            {data === null && <p className="py-10 text-center text-sm text-muted">This employee couldn&apos;t be found.</p>}
            {data && !data.canEdit && <p className="mb-3 rounded-lg bg-surface-sunken px-3 py-2 text-xs text-muted">You can view this person but not edit them.</p>}

            {data && tab === "overview" && (
              <div className="space-y-4">
                {urgent && (
                  <div className={cn("flex items-center gap-3 rounded-[14px] border px-3 py-2.5 text-sm", urgent.st.tone === "err" ? "border-[var(--error-border)] bg-[var(--error-soft)]" : "border-[var(--warning-border)] bg-[var(--warning-soft)]")}>
                    <span className="flex-1 text-primary"><b>{urgent.label} {urgent.st.text.toLowerCase()}.</b></span>
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => { setTab("documents"); setOpenDoc(urgent.field); }}>Renew</button>
                  </div>
                )}
                <fieldset disabled={!data.canEdit} className="min-w-0">
                  <h3 className="mb-2 text-xs font-semibold text-primary">Key details <span className="font-normal text-muted">· click a value to edit</span></h3>
                  <dl className="rounded-[14px] border border-default">
                    {data.category === "SITE_STAFF" ? (
                      <>
                        <Row label="Project"><ChoiceField kind="project" value={data.projectId} options={data.projects.map((p) => ({ value: p.id, label: p.name }))} onSave={bound("projectId", "Project")} placeholder="No project" /></Row>
                        <Row label="Trade"><ReadOnly value={data.trade} href={profileHref} /></Row>
                        <Row label="Camp / bed"><ReadOnly value={data.camp} href={profileHref} /></Row>
                      </>
                    ) : (
                      <>
                        <Row label="Position"><ReadOnly value={data.position} href={profileHref} /></Row>
                        <Row label="Department"><ReadOnly value={data.department} href={profileHref} /></Row>
                      </>
                    )}
                    <Row label="Mobile"><ClickToEdit label="mobile number" kind="phone" value={data.mobileNumber} onSave={bound("mobileNumber", "Mobile")} /></Row>
                    <Row label="Nationality"><ChoiceField kind="country" value={data.nationality} onSave={bound("nationality", "Nationality")} /></Row>
                  </dl>
                  <details className="mt-3 group">
                    <summary className="cursor-pointer text-xs font-semibold text-primary select-none">More details</summary>
                    <dl className="mt-2 rounded-[14px] border border-default">
                      <Row label="Name"><ClickToEdit label="name" value={data.name} onSave={bound("name", "Name")} /></Row>
                      <Row label="Date of birth"><ChoiceField kind="date" value={data.dateOfBirth} onSave={bound("dateOfBirth", "Date of birth")} /></Row>
                      <Row label="Gender"><ChoiceField kind="select" value={data.gender} options={[{ value: "MALE", label: "Male" }, { value: "FEMALE", label: "Female" }]} onSave={bound("gender", "Gender")} /></Row>
                      <Row label="Blood group"><ChoiceField kind="select" value={data.bloodGroup} options={BLOOD_GROUPS.map((b) => ({ value: b, label: b }))} onSave={bound("bloodGroup", "Blood group")} /></Row>
                      <Row label="Join date"><ChoiceField kind="date" value={data.joinDate} onSave={bound("joinDate", "Join date")} /></Row>
                      <Row label="Passport no."><ClickToEdit label="passport number" kind="passport" value={data.passportNumber} onSave={bound("passportNumber", "Passport number")} /></Row>
                      <Row label="Emirates ID"><ClickToEdit label="Emirates ID" kind="eid" value={data.emiratesId} onSave={bound("emiratesId", "Emirates ID")} /></Row>
                    </dl>
                  </details>
                </fieldset>
              </div>
            )}

            {data && tab === "documents" && (
              <fieldset disabled={!data.canEdit} className="min-w-0">
                <ul className="rounded-[14px] border border-default">
                  {DOCS.map((d) => {
                    const st = docState(data.expiry[d.field]);
                    const isOpen = openDoc === d.field;
                    return (
                      <li key={d.field} className="border-b border-default last:border-b-0">
                        <div className="flex items-center gap-3 px-3 py-2.5 text-sm">
                          <div className="min-w-0 flex-1"><p className="font-medium text-primary">{d.label}</p><p className="text-xs text-muted">{fmtDate(data.expiry[d.field])}</p></div>
                          <Pill tone={st.tone}>{st.text}</Pill>
                          <button type="button" aria-expanded={isOpen} onClick={() => setOpenDoc(isOpen ? null : d.field)} className="btn btn-secondary btn-sm">{data.expiry[d.field] ? "Renew" : "Add"}</button>
                        </div>
                        {isOpen && (
                          <RenewPanel key={`${d.field}-${hints[d.field] ?? ""}`} employeeId={id} doc={d} current={data.expiry[d.field]} hint={hints[d.field]} docs={data.docs.filter((x) => x.type === d.type)} onSave={(v) => save(d.field, v, `${d.label} expiry`)} onExtracted={onExtracted} onChanged={reload} onDone={() => setOpenDoc(null)} />
                        )}
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-3 text-xs text-muted">Pick the new expiry date, attach the scan if you have it, then save.</p>
              </fieldset>
            )}

            {data && tab === "missing" && (
              <fieldset disabled={!data.canEdit} className="min-w-0">
                <div className="mb-3 flex items-center gap-3 rounded-[14px] border border-default bg-brand-soft px-3 py-2.5">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full" style={{ background: `conic-gradient(var(--brand-primary) 0 ${pct}%, var(--border) ${pct}% 100%)` }}>
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-surface text-[11px] font-bold">{pct}%</span>
                  </div>
                  <p className="text-sm"><b>{gaps.length - open.length} of {gaps.length} profile items done.</b><br /><span className="text-xs text-muted">{open.length ? "Fill the gaps below without leaving this panel." : "Nothing is missing."}</span></p>
                </div>
                {open.length > 0 && (
                  <div className="rounded-[14px] border border-default">
                    {open.map((g) => (
                      <GapRow key={`${g.key}-${hints[g.key] ?? ""}`} gap={g} data={data} hint={hints[g.key]} save={save} onExtracted={onExtracted} onChanged={reload} />
                    ))}
                  </div>
                )}
                {gaps.some((g) => g.done) && (
                  <>
                    <h3 className="mt-4 mb-2 text-xs font-semibold text-primary">Already done</h3>
                    <p className="rounded-[14px] border border-default px-3 py-2.5 text-sm text-muted">{gaps.filter((g) => g.done).map((g) => `✓ ${g.label}`).join(" · ")}</p>
                  </>
                )}
              </fieldset>
            )}
          </div>

          {undo && (
            <div role="status" className="mx-5 mb-2 flex items-center justify-between rounded-xl bg-[#1e1b3a] px-3.5 py-2.5 text-sm font-medium text-white">
              <span className="flex items-center gap-2"><Check className="h-4 w-4" aria-hidden />Saved · {undo.label} updated</span>
              <button type="button" onClick={() => void doUndo()} className="font-semibold text-[#c4b8ff] hover:underline">Undo</button>
            </div>
          )}

          <footer className="flex items-center justify-between gap-3 border-t border-default px-5 py-3">
            <span className="text-xs text-muted">{tab === "missing" ? `${withGaps.length} ${withGaps.length === 1 ? "person has" : "people have"} gaps` : "Esc to close · J / K to move"}</span>
            {tab === "missing" ? (
              <button type="button" className="btn btn-primary gap-1.5" onClick={nextGap} disabled={withGaps.filter((x) => x !== id).length === 0}>Next with gaps<ArrowRight className="h-4 w-4" aria-hidden /></button>
            ) : (
              <button type="button" className="btn btn-primary gap-1.5" onClick={() => go(1)} disabled={order.length < 2}>Next person<ArrowRight className="h-4 w-4" aria-hidden /></button>
            )}
          </footer>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

function RenewPanel({ employeeId, doc, current, hint, docs, onSave, onExtracted, onChanged, onDone }: {
  employeeId: string;
  doc: (typeof DOCS)[number];
  current: string | null;
  hint?: string;
  docs: QuickView["docs"];
  onSave: (v: string | null) => Promise<SaveResult>;
  onExtracted: (f: ExtractedDocumentFields) => void;
  onChanged: () => void;
  onDone: () => void;
}) {
  const [draft, setDraft] = useState(hint ?? "");
  const flow = useFieldFlow((v) => onSave(v));
  return (
    <form
      className="space-y-3 border-t border-default bg-surface-subtle px-3 py-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!draft) return;
        if (await flow.run(draft)) onDone();
      }}
    >
      <div>
        <p className="mb-1 text-xs font-medium text-muted">New expiry date{current ? ` (now ${fmtDate(current)})` : ""}</p>
        <DatePicker name={doc.field} value={draft} onChange={setDraft} fromYear={new Date().getFullYear() - 2} toYear={new Date().getFullYear() + 15} />
      </div>
      <InlineDocumentUpload
        employeeId={employeeId}
        type={doc.type}
        documents={docs.map((d) => ({ id: d.id, filename: d.filename, expiryDate: d.expiryDate ? new Date(d.expiryDate) : null, uploadedAt: new Date(0) }))}
        expiryFieldName={doc.field}
        onExtracted={onExtracted}
        onChanged={onChanged}
      />
      <Notice msg={flow.msg} onConfirm={() => void flow.run(draft, true).then((ok) => ok && onDone())} onDismiss={flow.clear} />
      <div className="flex justify-end gap-2">
        <button type="button" className="btn btn-secondary btn-sm" onClick={onDone}>Cancel</button>
        <button type="submit" className="btn btn-primary btn-sm" disabled={!draft || flow.busy}>Save date</button>
      </div>
    </form>
  );
}

const WHY: Record<string, string> = {
  passportNumber: "Needed for visa and labour-card work",
  emiratesId: "15 digits, used on payroll files",
  nationality: "Shown on contracts and reports",
  dateOfBirth: "Needed for visa and insurance",
  scan: "Attach a copy so the details can be read from it",
  mobileNumber: "So the site team can reach them",
  projectId: "Where this worker is deployed",
};

function GapRow({ gap, data, hint, save, onExtracted, onChanged }: { gap: ReturnType<typeof gapsFor>[number]; data: QuickView; hint?: string; save: Save; onExtracted: (f: ExtractedDocumentFields) => void; onChanged: () => void }) {
  const [draft, setDraft] = useState(hint ?? "");
  const onSave = (v: string | null, confirm?: boolean) => save(gap.key, v, gap.label, confirm);
  const flow = useFieldFlow(onSave);
  const kind: Kind | null = gap.key === "passportNumber" ? "passport" : gap.key === "emiratesId" ? "eid" : gap.key === "mobileNumber" ? "phone" : null;
  const scanType = gap.key === "passportNumber" ? "PASSPORT" : gap.key === "emiratesId" ? "EMIRATES_ID" : gap.key === "scan" ? "PASSPORT" : null;
  return (
    <div className="border-b border-default px-3 py-3 last:border-b-0">
      <div className="flex items-baseline justify-between gap-2">
        <b className="text-sm font-semibold text-primary">{gap.label}</b>
        <Pill tone={gap.level === "Required" ? "err" : "warn"}>{gap.level}</Pill>
      </div>
      <p className="mt-0.5 mb-2 text-[11px] text-muted">{WHY[gap.key]}</p>
      {kind && (
        <form className="flex items-start gap-2" onSubmit={(e) => { e.preventDefault(); if (draft.trim()) void flow.run(draft.trim()); }}>
          <div className="min-w-0 flex-1"><TextEditor kind={kind} value={draft} onChange={setDraft} /></div>
          <button type="submit" className="btn btn-primary" disabled={!draft.trim() || flow.busy}>Save</button>
        </form>
      )}
      {hint && (gap.key === "nationality" || gap.key === "dateOfBirth") && (
        <p className="mb-2 flex items-center justify-between gap-2 rounded-lg bg-brand-soft px-2.5 py-1.5 text-xs">
          <span>Read from the scan: <b>{hint}</b></span>
          <button type="button" className="font-semibold text-[var(--brand-primary)] hover:underline" onClick={() => void flow.run(hint)}>Use this</button>
        </p>
      )}
      {gap.key === "nationality" && <ChoiceField kind="country" value={null} onSave={onSave} />}
      {gap.key === "dateOfBirth" && <ChoiceField kind="date" value={null} onSave={onSave} />}
      {(gap.key === "nationality" || gap.key === "dateOfBirth") && <Notice msg={flow.msg} onConfirm={() => void flow.run(hint ?? null, true)} onDismiss={flow.clear} />}
      {gap.key === "projectId" && <ChoiceField kind="project" value={null} options={data.projects.map((p) => ({ value: p.id, label: p.name }))} onSave={onSave} placeholder="Choose a project" />}
      {kind && <Notice msg={flow.msg} onConfirm={() => void flow.run(draft.trim(), true)} onDismiss={flow.clear} />}
      {scanType && (
        <div className={kind ? "mt-2" : ""}>
          <InlineDocumentUpload employeeId={data.id} type={scanType} documents={[]} onExtracted={onExtracted} onChanged={onChanged} />
        </div>
      )}
    </div>
  );
}
