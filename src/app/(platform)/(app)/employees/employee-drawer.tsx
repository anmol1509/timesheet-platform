"use client";

import { useTradeNames } from "@/components/TradesProvider";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FileWarning } from "lucide-react";
import { EmployeeAvatar } from "@/components/Avatar";
import { DatePicker } from "@/components/ui/DatePicker";
import { Select } from "@/components/ui/Select";
import { complianceStatus, daysUntil } from "@/lib/compliance";
import { cn } from "@/lib/cn";
import { Slider } from "@/components/ui/Slider";
import { NumberInput } from "@/components/ui/NumberInput";
import { TRADES } from "@/lib/trades";
import { DEFAULT_SKILL_LEVEL, SKILL_LEVEL_MAX, SKILL_LEVEL_MIN, SKILL_LEVEL_STEP, skillLevelLabel } from "@/lib/skillLevel";
import { addSkillAction, removeSkillAction } from "./[id]/actions";
import { loadQuickViewAction, saveEmployeeFieldAction, setEmployeeTradeAction, type QuickView } from "./quick-view";
import { DrawerFrame } from "@/components/quick-view/DrawerFrame";
import { ScanSummary } from "@/components/quick-view/ScanSummary";
import { ChoiceField, ClickToEdit, Notice, Pill, ReadOnly, Row, TextEditor, useFieldFlow, type Kind, type SaveResult } from "@/components/quick-view/fields";
import { ScanUpload, type ScanOutcome } from "./scan-upload";
import { BLOOD_GROUPS } from "./quick-view-fields";
import { Alert } from "@/components/Alert";

export type DrawerPerson = { id: string; name: string; complete: boolean };

type TabId = "overview" | "documents" | "missing";
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
const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }) : "—");

/** What the person still has to supply, in the order the profile form asks for it. */
function gapsFor(d: QuickView) {
  // A typed number or date is not enough: the passport and the Emirates ID each need their own file on record.
  const hasPassportFile = d.docs.some((x) => x.type === "PASSPORT");
  const hasEidFile = d.docs.some((x) => x.type === "EMIRATES_ID");
  const scanLabel = !hasPassportFile && !hasEidFile ? "Passport and Emirates ID scans" : !hasPassportFile ? "Passport scan" : "Emirates ID scan";
  const items: { key: string; label: string; done: boolean; level: "Required" | "Recommended" }[] = [
    { key: "passportNumber", label: "Passport number", done: !!d.passportNumber, level: "Required" },
    { key: "emiratesId", label: "Emirates ID", done: !!d.emiratesId, level: "Required" },
    { key: "nationality", label: "Nationality", done: !!d.nationality, level: "Required" },
    { key: "dateOfBirth", label: "Date of birth", done: !!d.dateOfBirth, level: "Required" },
    { key: "scan", label: scanLabel, done: hasPassportFile && hasEidFile, level: "Required" },
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

function docState(iso: string | null): { tone: "ok" | "warn" | "err" | "mute"; text: string; days: number | null } {
  if (!iso) return { tone: "mute", text: "Not recorded", days: null };
  const days = daysUntil(new Date(iso));
  const s = complianceStatus(new Date(iso));
  if (s === "expired") return { tone: "err", text: `Expired ${-days}d ago`, days };
  if (s === "expiring") return { tone: "warn", text: days === 0 ? "Expires today" : `Expires in ${days}d`, days };
  return { tone: "ok", text: "Valid", days };
}

export function EmployeeDrawer({ id, order, people, onNavigate, onClose, initialTab, initialDoc }: { id: string; order: string[]; people: Map<string, DrawerPerson>; onNavigate: (id: string) => void; onClose: () => void; initialTab?: string; initialDoc?: string }) {
  const router = useRouter();
  const [state, setState] = useState<{ id: string; data: QuickView | null } | null>(null);
  const [tab, setTab] = useState<TabId>(initialTab === "documents" || initialTab === "missing" ? initialTab : "overview");
  const [openDoc, setOpenDoc] = useState<string | null>(initialDoc && DOCS.some((x) => x.field === initialDoc) ? initialDoc : null);
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
    <DrawerFrame
      index={index}
      total={order.length}
      onStep={go}
      fullHref={profileHref}
      avatar={data ? <EmployeeAvatar employeeId={data.id} name={data.name} hasPhoto={data.hasPhoto} size="lg" /> : undefined}
      title={data ? data.name : "Loading…"}
      subtitle={data ? `${data.category === "STAFF" ? (data.position ?? "Staff") : (data.trade ?? "Site staff")} · ${data.employeeIdNo}${data.nationality ? ` · ${data.nationality}` : ""}` : undefined}
      badge={data ? badge : undefined}
      tabs={tabs}
      tab={tab}
      onTab={(t) => setTab(t as TabId)}
      undo={undo ? { label: undo.label, onUndo: () => void doUndo() } : null}
      footerHint={tab === "missing" ? `${withGaps.length} ${withGaps.length === 1 ? "person has" : "people have"} gaps` : undefined}
      nextLabel={tab === "missing" ? "Next with gaps" : "Next person"}
      onNext={tab === "missing" ? nextGap : () => go(1)}
      nextDisabled={tab === "missing" ? withGaps.filter((x) => x !== id).length === 0 : order.length < 2}
      onClose={onClose}
    >
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
                          {files === 0 && !!data.expiry[d.field] && <Pill tone="warn">Date typed, no file</Pill>}
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
            {open.some((g) => g.key === "scan") && (
              <Alert tone="warning" title={`${open.find((g) => g.key === "scan")!.label} needed`}>
                {data.passportNumber || data.emiratesId ? "A typed number is not enough: upload the scan so it is on file and can be checked." : "Upload the scan so it is on file and can be checked."}
              </Alert>
            )}
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
    </DrawerFrame>
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
  const tradeNames = useTradeNames();
  const options = [...new Set([...(data.trade ? [data.trade] : []), ...tradeNames])].map((t) => ({ value: t, label: t }));
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
      {error && <Alert inline className="mt-1">{error}</Alert>}
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
