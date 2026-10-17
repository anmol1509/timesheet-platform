"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DrawerFrame } from "@/components/quick-view/DrawerFrame";
import { ScanDrop } from "@/components/quick-view/ScanDrop";
import { ScanSummary, type ScanSummaryData } from "@/components/quick-view/ScanSummary";
import { ChoiceField, ClickToEdit, Pill, Row, TextEditor, Notice, useFieldFlow, type Kind, type SaveResult } from "@/components/quick-view/fields";
import { complianceStatus, daysUntil } from "@/lib/compliance";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from "@/lib/constants";
import { shrinkImage } from "@/lib/compressImage";
import { cn } from "@/lib/cn";
import { uploadAttachmentAction } from "@/lib/attachments";
import type { ExtractedCompanyFields } from "@/app/api/documents/extract-company/route";
import { applySupplierScanAction, loadSupplierQuickViewAction, saveSupplierFieldAction, type SupplierQuickView } from "./quick-view";

/** What the list already knows about a supplier: the header and the figures that are read, not edited, here. */
export type SupplierPerson = {
  id: string;
  name: string;
  employeeCount: number;
  billBalance: number;
  billOverdue: number;
  parentName: string | null;
};

type TabId = "overview" | "compliance" | "missing";
type Save = (field: string, value: string | null, label: string, confirm?: boolean) => Promise<SaveResult>;
type Outcome = ScanSummaryData;

const KNOWN_DOCS = new Set(["TRADE_LICENSE", "MOHRE_PERMIT", "ESTABLISHMENT_CARD", "TRN_CERTIFICATE", "WORKMEN_COMPENSATION_INSURANCE", "EJARI_TENANCY", "CHAMBER_OF_COMMERCE"]);
const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }) : "—");
const aed = (n: number) => `AED ${Math.round(n).toLocaleString("en-AE")}`;
const GATE_TONE = { Approved: "ok", Pending: "warn", Rejected: "err" } as const;

function gapsFor(d: SupplierQuickView) {
  const hasLicenceFile = d.attachments.some((a) => a.docType === "TRADE_LICENSE");
  return [
    { key: "tradeLicenseNumber", label: "Trade licence number", done: !!d.tradeLicenseNumber, level: "Required" as const, why: "Decides whether this supplier can be used at all", kind: "text" as Kind },
    { key: "tradeLicenseExpiry", label: "Trade licence expiry", done: !!d.tradeLicenseExpiry, level: "Required" as const, why: "So renewals are flagged before it lapses", kind: null },
    { key: "scan", label: "Trade licence copy", done: hasLicenceFile, level: "Required" as const, why: "Attach a scan; the details are read from it", kind: null },
    { key: "trn", label: "TRN", done: !!d.trn, level: "Required" as const, why: "15 digits, needed on invoices and bills", kind: "trn" as Kind },
    { key: "contactPerson", label: "Contact person", done: !!d.contactPerson, level: "Recommended" as const, why: "Who to call about workers and payments", kind: "text" as Kind },
    { key: "contactPhone", label: "Contact phone", done: !!d.contactPhone, level: "Recommended" as const, why: "", kind: "phone" as Kind },
    { key: "contactEmail", label: "Contact email", done: !!d.contactEmail, level: "Recommended" as const, why: "Where supplier letters and offers are sent", kind: "text" as Kind },
    { key: "category", label: "Category", done: !!d.category, level: "Recommended" as const, why: "Used to group suppliers", kind: "text" as Kind },
  ];
}

function licence(iso: string | null): { tone: "ok" | "warn" | "err" | "mute"; text: string; days: number | null } {
  if (!iso) return { tone: "mute", text: "Not recorded", days: null };
  const days = daysUntil(new Date(iso));
  const s = complianceStatus(new Date(iso));
  if (s === "expired") return { tone: "err", text: `Expired ${-days}d ago`, days };
  if (s === "expiring") return { tone: "warn", text: days === 0 ? "Expires today" : `Expires in ${days}d`, days };
  return { tone: "ok", text: "Valid", days };
}

export function SupplierDrawer({ id, order, people, onNavigate, onClose, initialTab }: { id: string; order: string[]; people: Map<string, SupplierPerson>; onNavigate: (id: string) => void; onClose: () => void; initialTab?: string }) {
  const router = useRouter();
  const [state, setState] = useState<{ id: string; data: SupplierQuickView | null } | null>(null);
  const [tab, setTab] = useState<TabId>(initialTab === "compliance" || initialTab === "missing" ? initialTab : "overview");
  const [scanState, setScanState] = useState<{ id: string; outcome: Outcome } | null>(null);
  const [undo, setUndo] = useState<{ field: string; label: string; previous: string | null } | null>(null);
  const data = state?.id === id ? state.data : undefined;
  const scan = scanState?.id === id ? scanState.outcome : null;
  const row = people.get(id);

  useEffect(() => {
    let off = false;
    loadSupplierQuickViewAction(id).then((d) => { if (!off) setState({ id, data: d }); });
    return () => { off = true; };
  }, [id]);
  useEffect(() => {
    if (!undo) return;
    const t = setTimeout(() => setUndo(null), 7000);
    return () => clearTimeout(t);
  }, [undo]);

  const reload = () => { void loadSupplierQuickViewAction(id).then((d) => setState({ id, data: d })); router.refresh(); };
  const patch = (field: string, value: string | null) => setState((s) => (s && s.id === id && s.data ? { ...s, data: { ...s.data, [field]: value } } : s));

  const save: Save = async (field, value, label, confirm = false) => {
    const r = await saveSupplierFieldAction({ id, field, value, confirm });
    if (r.ok) { patch(field, r.value); setUndo({ field, label, previous: r.previous }); router.refresh(); }
    return r;
  };
  const doUndo = async () => {
    if (!undo) return;
    const u = undo;
    setUndo(null);
    const r = await saveSupplierFieldAction({ id, field: u.field, value: u.previous, confirm: true });
    if (r.ok) { patch(u.field, r.value); router.refresh(); }
  };
  const bound = (field: string, label: string) => (v: string | null, confirm?: boolean) => save(field, v, label, confirm);
  async function useScanValue(c: { key: string; label: string; scan: string }) {
    const r = await save(c.key, c.scan, c.label, true);
    if (r.ok) setScanState((s) => (s && s.id === id ? { ...s, outcome: { ...s.outcome, conflicts: s.outcome.conflicts.filter((x) => x.key !== c.key) } } : s));
  }
  function onScanDone(outcome: Outcome) { setScanState({ id, outcome }); reload(); }

  const index = order.indexOf(id);
  const go = (delta: number) => { if (order.length > 1) onNavigate(order[(index + delta + order.length) % order.length]); };
  const gaps = useMemo(() => (data ? gapsFor(data) : []), [data]);
  const open = gaps.filter((g) => !g.done);
  const pct = gaps.length ? Math.round(((gaps.length - open.length) / gaps.length) * 100) : 100;
  const lic = data ? licence(data.tradeLicenseExpiry) : null;
  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "compliance", label: "Compliance" },
    { id: "missing", label: "Missing", count: open.length },
  ];
  const pending = data ? Object.values(data.approvals).filter((v) => v === "Pending").length : 0;

  return (
    <DrawerFrame
      index={index}
      total={order.length}
      onStep={go}
      fullHref={`/suppliers/${id}`}
      fullLabel="Open full supplier"
      title={data ? data.name : (row?.name ?? "Loading…")}
      subtitle={data ? [data.code, data.category, data.parentName && `Sub of ${data.parentName}`].filter(Boolean).join(" · ") : undefined}
      badge={data ? (data.status === "ACTIVE" ? (data.isOwnCompany ? "Own company" : "Active") : data.status.toLowerCase()) : undefined}
      tabs={tabs}
      tab={tab}
      onTab={(t) => setTab(t as TabId)}
      undo={undo ? { label: undo.label, onUndo: () => void doUndo() } : null}
      nextLabel="Next supplier"
      onNext={() => go(1)}
      nextDisabled={order.length < 2}
      onClose={onClose}
    >
      {data === undefined && <div className="space-y-3" aria-busy="true">{[0, 1, 2, 3].map((n) => <div key={n} className="h-10 animate-pulse rounded-xl bg-surface-sunken" />)}</div>}
      {data === null && <p className="py-10 text-center text-sm text-muted">This supplier couldn&apos;t be found.</p>}
      {data && !data.canEdit && <p className="mb-3 rounded-lg bg-surface-sunken px-3 py-2 text-xs text-muted">You can view this supplier but not edit it.</p>}

      {data && tab === "overview" && (
        <div className="space-y-4">
          {lic && (lic.tone === "err" || lic.tone === "warn") && (
            <div className={cn("flex items-center gap-3 rounded-[14px] border px-3 py-2.5 text-sm", lic.tone === "err" ? "border-[var(--error-border)] bg-[var(--error-soft)]" : "border-[var(--warning-border)] bg-[var(--warning-soft)]")}>
              <span className="flex-1 text-primary"><b>Trade licence {lic.text.toLowerCase()}.</b></span>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => setTab("compliance")}>Renew</button>
            </div>
          )}
          <fieldset disabled={!data.canEdit} className="min-w-0">
            <h3 className="mb-2 text-xs font-semibold text-primary">Key details <span className="font-normal text-muted">· click a value to edit</span></h3>
            <dl className="rounded-[14px] border border-default">
              <Row label="Contact"><ClickToEdit label="contact person" value={data.contactPerson} onSave={bound("contactPerson", "Contact person")} /></Row>
              <Row label="Phone"><ClickToEdit label="contact phone" kind="phone" value={data.contactPhone} onSave={bound("contactPhone", "Contact phone")} /></Row>
              <Row label="Email"><ClickToEdit label="contact email" value={data.contactEmail} onSave={bound("contactEmail", "Contact email")} /></Row>
              <Row label="Category"><ClickToEdit label="category" value={data.category} onSave={bound("category", "Category")} /></Row>
              <Row label="Payment terms"><ClickToEdit label="payment terms" value={data.paymentTerms} onSave={bound("paymentTerms", "Payment terms")} /></Row>
            </dl>
          </fieldset>
          {row && (
            <div className="grid grid-cols-2 gap-2.5 text-sm">
              <Link href={`/employees?supplier=${id}`} className="rounded-[14px] border border-default px-3 py-2.5 hover:bg-surface-hover"><p className="text-xs text-muted">Workers</p><p className="tabular text-base font-semibold text-primary">{row.employeeCount}</p></Link>
              <Link href="/finance/bills" className="rounded-[14px] border border-default px-3 py-2.5 hover:bg-surface-hover"><p className="text-xs text-muted">Bills outstanding</p><p className={cn("tabular text-base font-semibold", row.billOverdue > 0 ? "text-[var(--error)]" : "text-primary")}>{aed(row.billBalance)}</p>{row.billOverdue > 0 && <p className="text-[11px] text-[var(--error)]">{aed(row.billOverdue)} overdue</p>}</Link>
            </div>
          )}
        </div>
      )}

      {data && tab === "compliance" && (
        <fieldset disabled={!data.canEdit} className="min-w-0 space-y-3">
          {scan && <ScanSummary outcome={scan} onUse={useScanValue} onDismiss={() => setScanState(null)} />}
          <SupplierScan supplierId={id} onDone={onScanDone} title="Scan the trade licence" hint="Licence number, expiry, TRN and contact details are read and saved." />
          <dl className="rounded-[14px] border border-default">
            <Row label="Licence no."><ClickToEdit label="trade licence number" value={data.tradeLicenseNumber} onSave={bound("tradeLicenseNumber", "Trade licence number")} /></Row>
            <Row label="Expires">
              <ChoiceField kind="date" value={data.tradeLicenseExpiry} onSave={bound("tradeLicenseExpiry", "Trade licence expiry")} />
              {lic && <div className="mt-1"><Pill tone={lic.tone}>{lic.text}</Pill></div>}
            </Row>
            <Row label="TRN"><ClickToEdit label="TRN" kind="trn" value={data.trn} onSave={bound("trn", "TRN")} /></Row>
            <Row label="MOHRE permit"><ClickToEdit label="MOHRE permit number" value={data.mohrePermitNumber} onSave={bound("mohrePermitNumber", "MOHRE permit number")} /></Row>
          </dl>
          <div>
            <h3 className="mb-2 text-xs font-semibold text-primary">Approvals {pending > 0 && <span className="font-normal text-muted">· {pending} waiting</span>}</h3>
            <div className="flex flex-wrap gap-2 rounded-[14px] border border-default px-3 py-2.5 text-sm">
              {([["Projects", data.approvals.project], ["Labour", data.approvals.labour], ["Invoicing", data.approvals.invoicing]] as const).map(([label, v]) => (
                <span key={label} className="flex items-center gap-1.5 text-muted">{label}<Pill tone={GATE_TONE[v as keyof typeof GATE_TONE] ?? "mute"}>{v}</Pill></span>
              ))}
            </div>
            {pending > 0 && <Link href="/approvals?type=SUPPLIER" className="mt-1.5 block text-xs font-medium text-[var(--brand-primary)] hover:underline">Decide in Approvals</Link>}
          </div>
          {data.attachments.length > 0 && (
            <div>
              <h3 className="mb-2 text-xs font-semibold text-primary">Documents on file</h3>
              <ul className="rounded-[14px] border border-default text-sm">
                {data.attachments.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 border-b border-default px-3 py-2 last:border-b-0">
                    <span className="min-w-0"><span className="block truncate font-medium text-primary">{a.filename}</span><span className="text-xs text-muted">{a.docType.replace(/_/g, " ").toLowerCase()}{a.expiryDate && ` · expires ${fmtDate(a.expiryDate)}`}</span></span>
                  </li>
                ))}
              </ul>
            </div>
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
          {open.some((g) => ["tradeLicenseNumber", "tradeLicenseExpiry", "trn", "scan"].includes(g.key)) && (
            <SupplierScan supplierId={id} onDone={onScanDone} title="Scan the trade licence" hint="Licence number, expiry and TRN are read and saved." />
          )}
          {open.some((g) => g.key !== "scan") && (
            <div className="rounded-[14px] border border-default">
              {open.filter((g) => g.key !== "scan").map((g) => <GapRow key={g.key} gap={g} save={save} />)}
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

function GapRow({ gap, save }: { gap: ReturnType<typeof gapsFor>[number]; save: Save }) {
  const [draft, setDraft] = useState("");
  const onSave = (v: string | null, confirm?: boolean) => save(gap.key, v, gap.label, confirm);
  const flow = useFieldFlow(onSave);
  return (
    <div className="border-b border-default px-3 py-3 last:border-b-0">
      <div className="flex items-baseline justify-between gap-2">
        <b className="text-sm font-semibold text-primary">{gap.label}</b>
        <Pill tone={gap.level === "Required" ? "err" : "warn"}>{gap.level}</Pill>
      </div>
      {gap.why && <p className="mt-0.5 text-[11px] text-muted">{gap.why}</p>}
      <div className="mt-2">
        {gap.kind ? (
          <form className="flex items-start gap-2" onSubmit={(e) => { e.preventDefault(); if (draft.trim()) void flow.run(draft.trim()); }}>
            <div className="min-w-0 flex-1"><TextEditor kind={gap.kind} value={draft} onChange={setDraft} /></div>
            <button type="submit" className="btn btn-primary" disabled={!draft.trim() || flow.busy}>Save</button>
          </form>
        ) : (
          <ChoiceField kind="date" value={null} onSave={onSave} />
        )}
        {gap.kind && <Notice msg={flow.msg} onConfirm={() => void flow.run(draft.trim(), true)} onDismiss={flow.clear} />}
      </div>
    </div>
  );
}

/**
 * One way to add a company document: it is read, kept against the supplier, and everything readable is put on the
 * record in the same step, so nothing is typed that the scan already said.
 */
function SupplierScan({ supplierId, onDone, title, hint }: { supplierId: string; onDone: (o: Outcome) => void; title: string; hint: string }) {
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(files: File[]) {
    if (files.length === 0) return;
    setError(null);
    const out: Outcome = { applied: [], conflicts: [], files: 0, unread: 0, reason: null };
    try {
      for (const [n, raw] of files.entries()) {
        setStatus(files.length > 1 ? `Reading ${n + 1} of ${files.length}…` : "Reading the document…");
        const file = await shrinkImage(raw);
        if (file.size > MAX_UPLOAD_BYTES) { setError(`"${file.name}" is too large — max ${MAX_UPLOAD_LABEL}.`); continue; }
        let fields: ExtractedCompanyFields = {};
        if (file.type.startsWith("image/") || file.type === "application/pdf") {
          const body = new FormData();
          body.append("file", file);
          const res = await fetch("/api/documents/extract-company", { method: "POST", body }).catch(() => null);
          const payload = res ? await res.json().catch(() => null) : null;
          if (res?.ok && payload) fields = payload as ExtractedCompanyFields;
          else { out.unread++; out.reason = (payload && typeof payload.error === "string" && payload.error) || "The document couldn't be read."; }
        }
        setStatus("Saving…");
        const docType = fields.docType && KNOWN_DOCS.has(fields.docType) ? fields.docType : "TRADE_LICENSE";
        const form = new FormData();
        form.append("entityType", "SUPPLIER");
        form.append("entityId", supplierId);
        form.append("docType", docType);
        form.append("expiryDate", fields.documentExpiry || (docType === "TRADE_LICENSE" ? fields.tradeLicenseExpiry || "" : ""));
        form.append("revalidate", `/suppliers/${supplierId}`);
        form.append("file", file);
        const r = await uploadAttachmentAction(form);
        if (r && "error" in r && r.error) { setError(r.error); continue; }
        out.files++;
        if (Object.keys(fields).length > 0) {
          const a = await applySupplierScanAction({ id: supplierId, fields });
          if ("error" in a) setError(a.error);
          else {
            for (const x of a.applied) if (!out.applied.some((y) => y.key === x.key)) out.applied.push(x);
            for (const c of a.conflicts) if (!out.conflicts.some((y) => y.key === c.key)) out.conflicts.push(c);
          }
        }
      }
    } catch {
      setError("That didn't upload. Please try again.");
    } finally {
      setStatus(null);
    }
    if (out.files > 0) onDone(out);
  }

  return <ScanDrop title={title} hint={hint} compact multiple status={status} error={error} onFiles={(f) => void run(f)} />;
}
