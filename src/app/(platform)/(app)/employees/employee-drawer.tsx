"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import * as RadixDialog from "@radix-ui/react-dialog";
import { ArrowRight, Check, ChevronLeft, ChevronRight, ExternalLink, FileWarning, X } from "lucide-react";
import { EmployeeAvatar } from "@/components/Avatar";
import { DatePicker } from "@/components/ui/DatePicker";
import { CountrySelect } from "@/components/ui/CountrySelect";
import { Select } from "@/components/ui/Select";
import { MaskedInput } from "@/components/ui/MaskedInput";
import { PhoneField } from "@/components/ui/PhoneField";
import { complianceStatus, daysUntil } from "@/lib/compliance";
import { cn } from "@/lib/cn";
import { Slider } from "@/components/ui/Slider";
import { NumberInput } from "@/components/ui/NumberInput";
import { TRADES } from "@/lib/trades";
import { DEFAULT_SKILL_LEVEL, SKILL_LEVEL_MAX, SKILL_LEVEL_MIN, SKILL_LEVEL_STEP, skillLevelLabel } from "@/lib/skillLevel";
import { addSkillAction, removeSkillAction } from "./[id]/actions";
import { loadQuickViewAction, saveEmployeeFieldAction, setEmployeeTradeAction, type QuickView, type SaveResult } from "./quick-view";
import { ScanUpload, type ScanOutcome } from "./scan-upload";
import { BLOOD_GROUPS } from "./quick-view-fields";

export type DrawerPerson = { id: string; name: string; complete: boolean };

type TabId = "overview" | "documents" | "missing";
type Kind = "text" | "phone" | "passport" | "eid";
type Save = (field: string, value: string | null, label: string, confirm?: boolean) => Promise<SaveResult>;

const STATUS_PILL: Record<string, string> = { ACTIVE: "Active", IDLE: "On bench", UNDER_MOBILISATION: "Mobilising", ON_SITE: "On site", ON_VACATION: "On leave", TERMINATED: "Terminated" };
// `scan`: whether a scan of this type can be read. A medical certificate carries a date to type, nothing more.
const DOCS = [
  { type: "VISA", label: "Visa", field: "visaExpiry", scan: true },
  { type: "LABOR_CARD", label: "Labour card", field: "laborCardExpiry", scan: true },
  { type: "MEDICAL", label: "Medical", field: "medicalExpiry", scan: false },
  { type: "PASSPORT", label: "Passport", field: "passportExpiry", scan: true },
  { type: "EMIRATES_ID", label: "Emirates ID", field: "emiratesIdExpiry", scan: true },
] as const;
type DocDef = (typeof DOCS)[number];
/** Not added yet: no file of its type and no date recorded. */
const isMissingDoc = (d: QuickView, doc: DocDef) => !d.docs.some((x) => x.type === doc.type) && !d.expiry[doc.field];
const SCANNABLE_GAPS = new Set(["passportNumber", "emiratesId", "nationality", "dateOfBirth", "scan"]);
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
  const [scanState, setScanState] = useState<{ id: string; outcome: ScanOutcome } | null>(null);
  const [wizard, setWizard] = useState<{ id: string; total: number } | null>(null);
  const [undo, setUndo] = useState<{ field: string; label: string; previous: string | null } | null>(null);
  const data = state?.id === id ? state.data : undefined; // undefined while loading
  const scan = scanState?.id === id ? scanState.outcome : null;
  const wizardOn = wizard?.id === id ? wizard : null;

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

  /** A scan has already been filed and its details put on the profile; this just shows what happened and refreshes. */
  function onScanDone(outcome: ScanOutcome) {
    setScanState({ id, outcome });
    if (openDoc && outcome.applied.some((a) => a.key === openDoc)) setOpenDoc(null);
    reload();
  }
  async function useScanValue(c: { key: string; label: string; scan: string }) {
    const r = await save(c.key, c.scan, c.label, true);
    if (r.ok) setScanState((s) => (s && s.id === id ? { ...s, outcome: { ...s.outcome, conflicts: s.outcome.conflicts.filter((x) => x.key !== c.key) } } : s));
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
  const missingDocs = data ? DOCS.filter((d) => isMissingDoc(data, d)) : [];
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
                        <Row label="Trade"><TradeEditor data={data} reload={reload} /></Row>
                        <Row label="Camp / bed"><ReadOnly value={data.camp} href={profileHref} /></Row>
                      </>
                    ) : (
                      <>
                        <Row label="Position"><ClickToEdit label="position" value={data.position} onSave={bound("position", "Position")} /></Row>
                        <Row label="Department"><ClickToEdit label="department" value={data.department} onSave={bound("department", "Department")} /></Row>
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
                      <Row label="Labour card no."><ClickToEdit label="labour card number" value={data.laborCardNumber} onSave={bound("laborCardNumber", "Labour card number")} /></Row>
                      <Row label="Personal no."><ClickToEdit label="labour card personal number" value={data.laborCardPersonalNo} onSave={bound("laborCardPersonalNo", "Personal number")} /></Row>
                      <Row label="Visa file no."><ClickToEdit label="visa file number" value={data.visaNumber} onSave={bound("visaNumber", "Visa file number")} /></Row>
                      <Row label="Unified no."><ClickToEdit label="unified number" value={data.unifiedNo} onSave={bound("unifiedNo", "Unified number")} /></Row>
                    </dl>
                  </details>
                </fieldset>
              </div>
            )}

            {data && tab === "documents" && (
              <fieldset disabled={!data.canEdit} className="min-w-0 space-y-3">
                {scan && <ScanSummary outcome={scan} onUse={useScanValue} onDismiss={() => setScanState(null)} />}
                {wizardOn ? (
                  <DocWizard data={data} total={wizardOn.total} hasPhoto={data.hasPhoto} onScanDone={onScanDone} save={save} onClose={() => setWizard(null)} />
                ) : (
                  <>
                    {missingDocs.length >= 2 && (
                      <div className="rounded-[14px] border border-[var(--warning-border)] bg-[var(--warning-soft)] p-3">
                        <p className="flex items-center gap-2 text-sm font-semibold text-primary"><FileWarning className="h-4 w-4 shrink-0 text-[var(--warning)]" aria-hidden />{missingDocs.length} documents haven&apos;t been added</p>
                        <p className="mt-0.5 text-xs text-secondary">{missingDocs.map((d) => d.label).join(", ")}. Add them together or one at a time, and the details are read for you.</p>
                        <button type="button" className="btn btn-primary btn-sm mt-2.5" onClick={() => setWizard({ id, total: missingDocs.length })}>Add them step by step</button>
                      </div>
                    )}
                    <ul className="rounded-[14px] border border-default">
                      {DOCS.map((d) => {
                        const st = docState(data.expiry[d.field]);
                        const files = data.docs.filter((x) => x.type === d.type).length;
                        const isOpen = openDoc === d.field;
                        return (
                          <li key={d.field} className="border-b border-default last:border-b-0">
                            <div className="flex items-center gap-3 px-3 py-2.5 text-sm">
                              <div className="min-w-0 flex-1"><p className="font-medium text-primary">{d.label}</p><p className="text-xs text-muted">{fmtDate(data.expiry[d.field])}{files > 0 && ` · ${files} file${files === 1 ? "" : "s"}`}</p></div>
                              <Pill tone={st.tone}>{st.text}</Pill>
                              <button type="button" aria-expanded={isOpen} onClick={() => setOpenDoc(isOpen ? null : d.field)} className="btn btn-secondary btn-sm">{data.expiry[d.field] || files > 0 ? "Renew" : "Add"}</button>
                            </div>
                            {isOpen && <RenewPanel employeeId={id} doc={d} current={data.expiry[d.field]} hasPhoto={data.hasPhoto} onSave={(v) => save(d.field, v, `${d.label} expiry`)} onScanDone={onScanDone} onDone={() => setOpenDoc(null)} />}
                          </li>
                        );
                      })}
                    </ul>
                  </>
                )}
              </fieldset>
            )}

            {data && tab === "missing" && (
              <fieldset disabled={!data.canEdit} className="min-w-0 space-y-3">
                <div className="flex items-center gap-3 rounded-[14px] border border-default bg-brand-soft px-3 py-2.5">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full" style={{ background: `conic-gradient(var(--brand-primary) 0 ${pct}%, var(--border) ${pct}% 100%)` }}>
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-surface text-[11px] font-bold">{pct}%</span>
                  </div>
                  <p className="text-sm"><b>{gaps.length - open.length} of {gaps.length} profile items done.</b><br /><span className="text-xs text-muted">{open.length ? "Scan first; type only what is left." : "Nothing is missing."}</span></p>
                </div>
                {scan && <ScanSummary outcome={scan} onUse={useScanValue} onDismiss={() => setScanState(null)} />}
                {open.some((g) => SCANNABLE_GAPS.has(g.key)) && (
                  <ScanUpload employeeId={id} docType="COMBINED" multiple hasPhoto={data.hasPhoto} title="Scan the documents" hint="Passport, Emirates ID, labour card, visa. Drop them together and the details are filled in." onDone={onScanDone} />
                )}
                {open.some((g) => g.key !== "scan") && (
                  <div className="rounded-[14px] border border-default">
                    {open.filter((g) => g.key !== "scan").map((g) => <GapRow key={g.key} gap={g} data={data} save={save} />)}
                  </div>
                )}
                {gaps.some((g) => g.done) && (
                  <div>
                    <h3 className="mb-2 text-xs font-semibold text-primary">Already done</h3>
                    <p className="rounded-[14px] border border-default px-3 py-2.5 text-sm text-muted">{gaps.filter((g) => g.done).map((g) => `✓ ${g.label}`).join(" · ")}</p>
                  </div>
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

function ScanSummary({ outcome, onUse, onDismiss }: { outcome: ScanOutcome; onUse: (c: ScanOutcome["conflicts"][number]) => void; onDismiss: () => void }) {
  const nothing = outcome.applied.length === 0 && outcome.conflicts.length === 0 && !outcome.photo;
  return (
    <div role="status" className="rounded-[14px] border border-default bg-surface-subtle p-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold text-primary">
          {outcome.applied.length > 0 ? `Read ${outcome.files} file${outcome.files === 1 ? "" : "s"} and added ${outcome.applied.length} detail${outcome.applied.length === 1 ? "" : "s"}` : nothing ? "Nothing new to add" : `Read ${outcome.files} file${outcome.files === 1 ? "" : "s"}`}
        </p>
        <button type="button" onClick={onDismiss} aria-label="Dismiss" className="shrink-0 text-subtle hover:text-primary"><X className="h-4 w-4" aria-hidden /></button>
      </div>
      {outcome.applied.length > 0 && (
        <ul className="mt-1.5 flex flex-wrap gap-1.5">
          {outcome.applied.map((a) => <li key={a.key} className="rounded-full bg-[var(--success-soft)] px-2 py-0.5 text-xs text-[var(--success)]">✓ {a.label}</li>)}
          {outcome.photo && <li className="rounded-full bg-[var(--success-soft)] px-2 py-0.5 text-xs text-[var(--success)]">✓ Photo</li>}
        </ul>
      )}
      {nothing && outcome.unread === 0 && <p className="mt-1 text-xs text-muted">What the scan shows is already on the profile.</p>}
      {outcome.unread > 0 && (
        <p className="mt-1.5 text-xs text-[var(--warning)]">{outcome.unread === 1 ? "A file was saved but its details couldn't be read" : `${outcome.unread} files were saved but their details couldn't be read`}{outcome.reason ? ` (${outcome.reason})` : ""}. Enter the details by hand.</p>
      )}
      {outcome.conflicts.map((c) => (
        <div key={c.key} className="mt-2 rounded-lg border border-[var(--warning-border)] bg-[var(--warning-soft)] p-2 text-xs">
          <p className="text-primary"><b>{c.label}</b>: the profile has <b>{c.current}</b>, the scan says <b>{c.scan}</b>.</p>
          <button type="button" onClick={() => onUse(c)} className="mt-1 font-semibold text-[var(--brand-primary)] hover:underline">Use the scan value</button>
        </div>
      ))}
    </div>
  );
}

function RenewPanel({ employeeId, doc, current, hasPhoto, onSave, onScanDone, onDone }: {
  employeeId: string;
  doc: DocDef;
  current: string | null;
  hasPhoto: boolean;
  onSave: (v: string | null) => Promise<SaveResult>;
  onScanDone: (o: ScanOutcome) => void;
  onDone: () => void;
}) {
  const [draft, setDraft] = useState("");
  const flow = useFieldFlow((v) => onSave(v));
  return (
    <div className="space-y-3 border-t border-default bg-surface-subtle px-3 py-3">
      {doc.scan && <ScanUpload employeeId={employeeId} docType={doc.type} hasPhoto={hasPhoto} compact title={`Scan the new ${doc.label.toLowerCase()}`} hint="The expiry date and numbers are read and saved for you." onDone={onScanDone} />}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!draft) return;
          if (await flow.run(draft)) onDone();
        }}
      >
        <p className="mb-1 text-xs font-medium text-muted">{doc.scan ? "Or enter the new expiry date yourself" : "New expiry date"}{current ? ` (now ${fmtDate(current)})` : ""}</p>
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1"><DatePicker name={doc.field} value={draft} onChange={setDraft} fromYear={new Date().getFullYear() - 2} toYear={new Date().getFullYear() + 15} /></div>
          <button type="submit" className="btn btn-primary" disabled={!draft || flow.busy}>Save</button>
          <button type="button" className="btn btn-secondary" onClick={onDone}>Cancel</button>
        </div>
        <Notice msg={flow.msg} onConfirm={() => void flow.run(draft, true).then((ok) => ok && onDone())} onDismiss={flow.clear} />
      </form>
    </div>
  );
}

/**
 * Walks through the documents not added yet. Everything at once first (a pack is
 * read in one go), then whatever is still missing one at a time, each by scan
 * with a typed date as the fallback. A document drops off the list the moment it
 * is added, so nothing is asked for twice.
 */
function DocWizard({ data, total, hasPhoto, onScanDone, save, onClose }: { data: QuickView; total: number; hasPhoto: boolean; onScanDone: (o: ScanOutcome) => void; save: Save; onClose: () => void }) {
  const [phase, setPhase] = useState<"pack" | "single">("pack");
  const [skipped, setSkipped] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [manual, setManual] = useState(false);
  const missing = DOCS.filter((d) => isMissingDoc(data, d));
  const current = phase === "single" ? missing.find((d) => !skipped.includes(d.type)) : undefined;
  const done = total - missing.length;
  const flow = useFieldFlow((v) => (current ? save(current.field, v, `${current.label} expiry`) : Promise.resolve({ error: "Nothing to save." })));
  const finished = phase === "single" && !current;

  return (
    <div className="rounded-[14px] border border-default">
      <div className="flex items-center justify-between gap-3 border-b border-default px-3 py-2.5">
        <div>
          <p className="text-sm font-semibold text-primary">{finished ? "All done" : phase === "pack" ? "Add documents" : `${current!.label}`}</p>
          <p className="text-xs text-muted">{finished ? `${done} of ${total} added${missing.length ? `, ${missing.length} skipped` : ""}` : `${done} of ${total} added`}</p>
        </div>
        <button type="button" onClick={onClose} className="btn btn-secondary btn-sm">{finished ? "Close" : "Exit"}</button>
      </div>
      <div className="h-1 bg-surface-sunken"><div className="h-full bg-[var(--brand-primary)] transition-all" style={{ width: `${total ? (done / total) * 100 : 100}%` }} /></div>
      <div className="space-y-3 p-3">
        {phase === "pack" && (
          <>
            <p className="text-sm text-secondary">Have them all? Drop every document together: passport, Emirates ID, labour card, visa. Each is read and filed, and the details are added to the profile.</p>
            <ScanUpload employeeId={data.id} docType="COMBINED" multiple hasPhoto={hasPhoto} title="Scan everything at once" onDone={(o) => { onScanDone(o); setPhase("single"); }} />
            <button type="button" className="text-sm font-medium text-[var(--brand-primary)] hover:underline" onClick={() => setPhase("single")}>Add them one at a time instead →</button>
          </>
        )}
        {phase === "single" && current && (
          <>
            {current.scan && <ScanUpload key={current.type} employeeId={data.id} docType={current.type} hasPhoto={hasPhoto} title={`Scan the ${current.label.toLowerCase()}`} hint="Its expiry date and numbers are read and saved." onDone={(o) => { setManual(false); onScanDone(o); }} />}
            {(!current.scan || manual) ? (
              <form className="flex items-start gap-2" onSubmit={async (e) => { e.preventDefault(); if (draft && (await flow.run(draft))) setDraft(""); }}>
                <div className="min-w-0 flex-1"><DatePicker value={draft} onChange={setDraft} fromYear={new Date().getFullYear() - 2} toYear={new Date().getFullYear() + 15} ariaLabel={`${current.label} expiry date`} /></div>
                <button type="submit" className="btn btn-primary" disabled={!draft || flow.busy}>Save date</button>
              </form>
            ) : (
              <button type="button" className="text-sm text-secondary hover:underline" onClick={() => setManual(true)}>No scan? Enter the date by hand</button>
            )}
            <Notice msg={flow.msg} onConfirm={() => void flow.run(draft, true)} onDismiss={flow.clear} />
            <div className="flex justify-end">
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setSkipped((s) => [...s, current.type]); setManual(false); setDraft(""); }}>Skip this one</button>
            </div>
          </>
        )}
        {finished && <p className="text-sm text-secondary">{missing.length ? `${missing.map((d) => d.label).join(", ")} can be added later from this tab.` : "Every document is on file."}</p>}
      </div>
    </div>
  );
}

const WHY: Record<string, string> = {
  passportNumber: "Needed for visa and labour-card work",
  emiratesId: "15 digits, used on payroll files",
  nationality: "Shown on contracts and reports",
  dateOfBirth: "Needed for visa and insurance",
  mobileNumber: "So the site team can reach them",
  projectId: "Where this worker is deployed",
};

/** One thing still to type. Anything a scan could have supplied is handled by the scanner above the list, so these are only what it can't. */
function GapRow({ gap, data, save }: { gap: ReturnType<typeof gapsFor>[number]; data: QuickView; save: Save }) {
  const [draft, setDraft] = useState("");
  const onSave = (v: string | null, confirm?: boolean) => save(gap.key, v, gap.label, confirm);
  const flow = useFieldFlow(onSave);
  const kind: Kind | null = gap.key === "passportNumber" ? "passport" : gap.key === "emiratesId" ? "eid" : gap.key === "mobileNumber" ? "phone" : null;
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
      {gap.key === "nationality" && <ChoiceField kind="country" value={null} onSave={onSave} />}
      {gap.key === "dateOfBirth" && <ChoiceField kind="date" value={null} onSave={onSave} />}
      {gap.key === "projectId" && <ChoiceField kind="project" value={null} options={data.projects.map((p) => ({ value: p.id, label: p.name }))} onSave={onSave} placeholder="Choose a project" />}
      {kind && <Notice msg={flow.msg} onConfirm={() => void flow.run(draft.trim(), true)} onDismiss={flow.clear} />}
    </div>
  );
}

/**
 * A site worker's trade is their first known trade, so choosing one here makes it
 * theirs and adds it to Known Trade Details. Levels and rates (the hourly rate
 * comes from the trade) are managed in the list underneath.
 */
function TradeEditor({ data, reload }: { data: QuickView; reload: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [add, setAdd] = useState<{ trade: string; level: number; rate: number | "" }>({ trade: "", level: DEFAULT_SKILL_LEVEL, rate: "" });
  const options = [...new Set([...(data.trade ? [data.trade] : []), ...TRADES])].map((t) => ({ value: t, label: t }));
  const current = data.skills.find((k) => k.name.toLowerCase() === (data.trade ?? "").toLowerCase());
  const hourlyNoRate = data.payStructure === "HOURLY" && !!current && current.rate == null;

  async function change(trade: string) {
    if (!trade || trade === data.trade) return;
    setBusy(true); setError(null);
    const r = await setEmployeeTradeAction({ id: data.id, trade }).catch(() => ({ error: "That didn't save. Please try again." }));
    setBusy(false);
    if ("error" in r) setError(r.error); else reload();
  }
  async function addTrade() {
    if (!add.trade) return;
    const f = new FormData();
    f.append("employeeId", data.id); f.append("skillName", add.trade); f.append("proficiencyPercent", String(add.level));
    if (add.rate !== "") f.append("rate", String(add.rate));
    setBusy(true);
    await addSkillAction(f);
    setBusy(false);
    setAdd({ trade: "", level: DEFAULT_SKILL_LEVEL, rate: "" });
    reload();
  }
  async function remove(skillId: string) {
    const f = new FormData();
    f.append("employeeId", data.id); f.append("skillId", skillId);
    setBusy(true);
    await removeSkillAction(f);
    setBusy(false);
    reload();
  }

  return (
    <div className="min-w-0">
      <Select value={data.trade ?? ""} onChange={(v) => void change(v)} options={options} placeholder="Choose a trade" searchable disabled={busy} />
      {error && <p role="alert" className="mt-1 text-xs text-[var(--error)]">{error}</p>}
      {current && data.canViewPay && (
        <p className={cn("mt-1 text-xs", hourlyNoRate ? "text-[var(--warning)]" : "text-muted")}>
          {current.level != null ? `${skillLevelLabel(current.level)} · ` : ""}{current.rate != null ? `AED ${current.rate.toFixed(2)} per hour` : hourlyNoRate ? "No rate set for this trade, so hourly pay would be zero" : "No rate set"}
        </p>
      )}
      <details className="mt-1.5">
        <summary className="cursor-pointer text-xs font-medium text-[var(--brand-primary)] select-none">Known trades ({data.skills.length})</summary>
        <div className="mt-2 space-y-2 rounded-[12px] border border-default p-2.5">
          {data.skills.length === 0 && <p className="text-xs text-subtle">No known trades yet.</p>}
          {data.skills.map((k) => (
            <div key={k.id} className="flex items-center justify-between gap-2 text-xs">
              <span className="min-w-0 truncate"><b className="text-primary">{k.name}</b>{k.level != null && ` · ${k.level}%`}{data.canViewPay && k.rate != null && ` · AED ${k.rate.toFixed(2)}`}</span>
              <button type="button" disabled={busy} onClick={() => void remove(k.id)} className="shrink-0 font-medium text-[var(--error)] hover:underline">Remove</button>
            </div>
          ))}
          <div className="space-y-2 border-t border-default pt-2">
            <Select value={add.trade} onChange={(v) => setAdd((a) => ({ ...a, trade: v }))} options={TRADES.map((t) => ({ value: t, label: t }))} placeholder="Add another trade…" searchable />
            <Slider label="Level" valueLabel={`${skillLevelLabel(add.level)} · ${add.level}%`} min={SKILL_LEVEL_MIN} max={SKILL_LEVEL_MAX} step={SKILL_LEVEL_STEP} value={add.level} onChange={(v) => setAdd((a) => ({ ...a, level: v }))} ariaLabel="Trade level" />
            {data.canViewPay && <NumberInput step={0.01} min={0} value={add.rate} onChange={(v) => setAdd((a) => ({ ...a, rate: v }))} placeholder="Rate (AED per hour)" ariaLabel="Trade rate" />}
            <button type="button" className="btn btn-secondary btn-sm" disabled={!add.trade || busy} onClick={() => void addTrade()}>Add trade</button>
          </div>
        </div>
      </details>
    </div>
  );
}
