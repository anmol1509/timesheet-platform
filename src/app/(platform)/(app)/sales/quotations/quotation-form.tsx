"use client";

import { Plus, X } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { Select } from "@/components/ui/Select";
import { createQuotationAction, updateQuotationAction } from "./actions";
import { DatePicker } from "@/components/ui/DatePicker";
import { DraftBar } from "@/components/DraftBar";
import { NumberInput } from "@/components/ui/NumberInput";
import { cn } from "@/lib/cn";
import {
  RESPONSIBILITY_OPTIONS,
  conversionNote,
  costOf,
  defaultCostParts,
  lineProfit,
  monthlyEach,
  quoteProfit,
  quoteTotals,
  type Adjustment,
  type CostPart,
  type QuoteSettings,
} from "@/lib/quotationMath";

import { Button } from "@/components/ui/Button";
type Client = { id: string; name: string };
type Contact = { id: string; name: string; designation: string | null; email: string | null };

export type LineRow = {
  id: string;
  trade: string;
  quantity: string;
  rate: string;
  unit: "MONTH" | "DAY" | "HOUR" | "CUSTOM";
  unitLabel: string;
  unitsPerMonth: string;
  durationMonths: string;
  hoursPerDay: string;
  otRate: string;
  nationality: string;
  workingHours: string;
  /** Total cost per worker per month, typed or summed from `costParts`. */
  cost: string;
  costParts: CostPart[];
  open: boolean;
};

export type QuotationFormInitial = {
  quotationId?: string;
  status?: string;
  version?: number;
  clientId: string;
  contactId: string;
  validUntil: string;
  terms: string;
  coverIntro: string;
  coverClosing: string;
  accommodationResponsibility: string;
  transportationResponsibility: string;
  ppeResponsibility: string;
  currency: string;
  showCost: boolean;
  nextFollowUpAt: string;
  adjustments: Adjustment[];
  lines: Omit<LineRow, "open">[];
};

function blankLine(): LineRow {
  return { id: crypto.randomUUID(), trade: "", quantity: "1", rate: "", unit: "MONTH", unitLabel: "", unitsPerMonth: "1", durationMonths: "", hoursPerDay: "", otRate: "", nationality: "", workingHours: "", cost: "", costParts: [], open: false };
}

const n = (v: string) => (v.trim() === "" || !Number.isFinite(Number(v)) ? null : Number(v));
const money = (v: number, currency = "AED") => `${currency} ${v.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: v % 1 ? 2 : 0 })}`;
const signed = (v: number) => `${v < 0 ? "−" : "+"}${Math.abs(Math.round(v)).toLocaleString()}`;

function toPriced(l: LineRow) {
  return {
    quantity: n(l.quantity) ?? 0,
    rate: n(l.rate) ?? 0,
    unit: l.unit,
    unitLabel: l.unitLabel,
    unitsPerMonth: n(l.unitsPerMonth) ?? 1,
    hoursPerDay: n(l.hoursPerDay),
    durationMonths: n(l.durationMonths),
    costPerMonth: n(l.cost),
  };
}

export function QuotationForm({
  clients,
  contacts,
  tradeOptions,
  settings,
  salaryHints,
  initial,
  enquiryId,
}: {
  clients: Client[];
  contacts: Record<string, Contact[]>;
  tradeOptions: { value: string }[];
  settings: QuoteSettings;
  /** Average monthly pay by trade (lower-case), used to suggest a cost. */
  salaryHints: Record<string, number>;
  initial: QuotationFormInitial;
  enquiryId: string;
}) {
  const editing = !!initial.quotationId;
  const [pending, startTransition] = useTransition();
  const [clientId, setClientId] = useState(initial.clientId);
  const [contactId, setContactId] = useState(initial.contactId);
  const [validUntil, setValidUntil] = useState(initial.validUntil);
  const [nextFollowUpAt, setNextFollowUpAt] = useState(initial.nextFollowUpAt);
  const [currency, setCurrency] = useState(initial.currency);
  const [terms, setTerms] = useState(initial.terms);
  const [coverIntro, setCoverIntro] = useState(initial.coverIntro);
  const [coverClosing, setCoverClosing] = useState(initial.coverClosing);
  const [accommodation, setAccommodation] = useState(initial.accommodationResponsibility);
  const [transport, setTransport] = useState(initial.transportationResponsibility);
  const [ppe, setPpe] = useState(initial.ppeResponsibility);
  const [showCost, setShowCost] = useState(initial.showCost);
  const [showDuration, setShowDuration] = useState(initial.lines.some((l) => l.durationMonths));
  const [showOt, setShowOt] = useState(initial.lines.some((l) => l.otRate));
  const [adjustments, setAdjustments] = useState<Adjustment[]>(initial.adjustments);
  const [lines, setLines] = useState<LineRow[]>(initial.lines.length ? initial.lines.map((l) => ({ ...l, open: false })) : [blankLine()]);
  const [revisionNote, setRevisionNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const isRevision = editing && initial.status !== "DRAFT";
  const priced = useMemo(() => lines.map(toPriced), [lines]);
  const totals = useMemo(() => quoteTotals(priced.filter((l) => l.quantity > 0 && l.rate >= 0), adjustments, settings), [priced, adjustments, settings]);
  const profit = useMemo(() => quoteProfit(priced.filter((l) => l.quantity > 0), settings), [priced, settings]);
  const contactOptions = contacts[clientId] ?? [];

  function updateLine(id: string, patch: Partial<LineRow>) {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }
  function setParts(id: string, parts: CostPart[]) {
    updateLine(id, { costParts: parts, cost: parts.length ? String(costOf(parts)) : "" });
  }
  function suggestCost(l: LineRow) {
    const parts = defaultCostParts({ salary: salaryHints[l.trade.trim().toLowerCase()] ?? null, accommodation, transport, ppe }, settings);
    if (parts.length === 0) {
      setError("Nothing to suggest yet: set the usual costs under Quotation settings, or type a cost for this trade.");
      return;
    }
    setError(null);
    setParts(l.id, parts);
  }
  function addAdjustment(kind: Adjustment["kind"], name: string, mode: Adjustment["mode"], value: number) {
    setAdjustments((prev) => [...prev, { kind, name, mode, value }]);
  }

  function formState() {
    return { clientId, contactId, validUntil, nextFollowUpAt, currency, terms, coverIntro, coverClosing, accommodation, transport, ppe, showCost, adjustments, lines };
  }

  function submit() {
    setError(null);
    if (!clientId) return setError("Choose the client.");
    const rows = lines.filter((l) => l.trade && (n(l.quantity) ?? 0) > 0 && l.rate !== "");
    if (rows.length === 0) return setError("Add at least one line with a trade, quantity and price.");
    const fd = new FormData();
    if (editing) fd.append("quotationId", initial.quotationId!);
    fd.append("clientId", clientId);
    if (enquiryId) fd.append("enquiryId", enquiryId);
    fd.append("contactId", contactId);
    fd.append("validUntil", validUntil);
    fd.append("nextFollowUpAt", nextFollowUpAt);
    fd.append("currency", currency);
    fd.append("terms", terms);
    fd.append("coverIntro", coverIntro);
    fd.append("coverClosing", coverClosing);
    fd.append("accommodationResponsibility", accommodation);
    fd.append("transportationResponsibility", transport);
    fd.append("ppeResponsibility", ppe);
    if (showCost) fd.append("showCost", "on");
    if (revisionNote.trim()) fd.append("revisionNote", revisionNote.trim());
    fd.append("adjustmentsJson", JSON.stringify(adjustments));
    fd.append(
      "linesJson",
      JSON.stringify(
        rows.map((l) => ({
          trade: l.trade,
          quantity: n(l.quantity),
          rate: n(l.rate),
          unit: l.unit,
          unitLabel: l.unit === "CUSTOM" ? l.unitLabel : null,
          unitsPerMonth: l.unit === "CUSTOM" ? n(l.unitsPerMonth) : 1,
          durationMonths: showDuration ? n(l.durationMonths) : null,
          hoursPerDay: l.unit === "HOUR" ? n(l.hoursPerDay) : null,
          otRate: showOt ? n(l.otRate) : null,
          nationality: l.nationality || null,
          workingHours: l.workingHours || null,
          costPerMonth: showCost ? n(l.cost) : null,
          costBreakdown: showCost && l.costParts.length ? l.costParts : null,
        })),
      ),
    );
    startTransition(async () => {
      const res = editing ? await updateQuotationAction(fd) : await createQuotationAction(fd);
      // Both actions redirect on success, so a return means they refused.
      if (res === undefined) setError("The quotation wasn't saved. Check the client, contact and lines, then try again.");
    });
  }

  const unitOptions = [
    { value: "MONTH", label: "per month" },
    { value: "DAY", label: "per day" },
    { value: "HOUR", label: "per hour" },
    ...settings.units.map((u) => ({ value: `CUSTOM:${u.key}`, label: `per ${u.label}` })),
  ];
  const unitValue = (l: LineRow) => (l.unit === "CUSTOM" ? `CUSTOM:${settings.units.find((u) => u.label === l.unitLabel)?.key ?? l.unitLabel}` : l.unit);
  function pickUnit(l: LineRow, v: string) {
    if (v.startsWith("CUSTOM:")) {
      const u = settings.units.find((x) => x.key === v.slice(7));
      updateLine(l.id, { unit: "CUSTOM", unitLabel: u?.label ?? "", unitsPerMonth: String(u?.perMonth ?? 1) });
    } else updateLine(l.id, { unit: v as LineRow["unit"], unitLabel: "", unitsPerMonth: "1" });
  }

  const hasVat = adjustments.some((a) => a.kind === "TAX" && /vat/i.test(a.name));
  const target = settings.targetProfit;

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-5">
        {!editing && (
          <DraftBar
            type="QUOTATION"
            draftKey={enquiryId || "new"}
            state={formState()}
            title={clients.find((c) => c.id === clientId)?.name}
            hasContent={!!(terms.trim() || validUntil || lines.some((l) => l.trade || l.rate))}
            onRestore={(d) => {
              setClientId(d.clientId || initial.clientId);
              setContactId(d.contactId ?? "");
              setValidUntil(d.validUntil ?? "");
              setNextFollowUpAt(d.nextFollowUpAt ?? "");
              setCurrency(d.currency ?? "AED");
              setTerms(d.terms ?? "");
              setCoverIntro(d.coverIntro ?? "");
              setCoverClosing(d.coverClosing ?? "");
              setAccommodation(d.accommodation ?? "");
              setTransport(d.transport ?? "");
              setPpe(d.ppe ?? "");
              setShowCost(!!d.showCost);
              setAdjustments(d.adjustments ?? []);
              setLines(d.lines?.length ? d.lines.map((l: Partial<LineRow>) => ({ ...blankLine(), ...l })) : [blankLine()]);
            }}
          />
        )}

        <div className="card grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
          <Field label="Client">
            <Select
              value={clientId}
              onChange={(v) => { setClientId(v); setContactId(""); }}
              placeholder="Select client"
              disabled={editing}
              options={clients.map((c) => ({ value: c.id, label: c.name }))}
            />
          </Field>
          <Field label="Address to">
            <Select
              value={contactId}
              onChange={setContactId}
              placeholder={contactOptions.length ? "Select contact" : "No contacts on this client"}
              disabled={contactOptions.length === 0}
              options={[{ value: "", label: "No one in particular" }, ...contactOptions.map((c) => ({ value: c.id, label: [c.name, c.designation].filter(Boolean).join(" · ") }))]}
            />
          </Field>
          <Field label="Valid until">
            <DatePicker value={validUntil} onChange={setValidUntil} className="w-full" />
          </Field>
          <Field label="Next follow-up">
            <DatePicker value={nextFollowUpAt} onChange={setNextFollowUpAt} className="w-full" />
          </Field>
        </div>

        <div className="card p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-primary">Lines</h2>
            <div className="flex flex-wrap gap-2">
              <Chip on={showDuration} onClick={() => setShowDuration((v) => !v)}>Duration</Chip>
              <Chip on={showOt} onClick={() => setShowOt((v) => !v)}>OT rate</Chip>
              <Chip on={showCost} onClick={() => setShowCost((v) => !v)}>Cost &amp; profit</Chip>
            </div>
          </div>
          <div className="space-y-3">
            {lines.map((l) => {
              const p = toPriced(l);
              const each = monthlyEach(p, settings);
              const note = conversionNote(p, settings);
              const lp = showCost ? lineProfit(p, settings) : null;
              return (
                <div key={l.id} className="rounded-xl border border-default p-3">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-12">
                    <div className="col-span-2 sm:col-span-4">
                      <Select value={l.trade} onChange={(v) => updateLine(l.id, { trade: v })} placeholder="Trade" options={tradeOptions.map((o) => ({ value: o.value, label: o.value }))} />
                    </div>
                    <div className="sm:col-span-2">
                      <NumberInput value={l.quantity} onChange={(v) => updateLine(l.id, { quantity: String(v) })} min={1} placeholder="Qty" />
                    </div>
                    <div className="col-span-2 flex gap-1.5 sm:col-span-4">
                      <div className="min-w-0 flex-1">
                        <NumberInput value={l.rate} onChange={(v) => updateLine(l.id, { rate: String(v) })} step={0.01} placeholder="Price" />
                      </div>
                      <div className="w-32 shrink-0">
                        <Select value={unitValue(l)} onChange={(v) => pickUnit(l, v)} searchable={false} options={unitOptions} />
                      </div>
                    </div>
                    <div className="col-span-2 flex items-center justify-between gap-2 sm:col-span-2 sm:justify-end">
                      <button type="button" onClick={() => updateLine(l.id, { open: !l.open })} className="text-xs font-medium text-[var(--brand-primary)] hover:underline">{l.open ? "Less" : "More"}</button>
                      <button type="button" aria-label="Remove line" onClick={() => setLines((prev) => prev.filter((r) => r.id !== l.id))} disabled={lines.length === 1} className="rounded-md p-1.5 text-subtle hover:bg-[var(--error-soft)] hover:text-[var(--error)] disabled:opacity-30">
                        <X className="h-4 w-4" aria-hidden />
                      </button>
                    </div>
                  </div>
                  {(showDuration || showOt || l.unit === "HOUR" || l.open) && (
                    <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {showDuration && <LabeledNumber label="Months" value={l.durationMonths} onChange={(v) => updateLine(l.id, { durationMonths: v })} />}
                      {l.unit === "HOUR" && <LabeledNumber label="Hours per day" value={l.hoursPerDay} onChange={(v) => updateLine(l.id, { hoursPerDay: v })} placeholder={String(settings.hoursPerDay)} />}
                      {showOt && <LabeledNumber label={`OT rate / ${l.unit === "DAY" ? "day" : "hour"}`} value={l.otRate} onChange={(v) => updateLine(l.id, { otRate: v })} step={0.01} />}
                      {l.open && (
                        <>
                          <label className="block"><span className="mb-1 block text-xs text-muted">Nationality</span><input value={l.nationality} onChange={(e) => updateLine(l.id, { nationality: e.target.value })} className="input w-full" /></label>
                          <label className="block"><span className="mb-1 block text-xs text-muted">Working hours</span><input value={l.workingHours} onChange={(e) => updateLine(l.id, { workingHours: e.target.value })} className="input w-full" /></label>
                        </>
                      )}
                    </div>
                  )}
                  {p.rate > 0 && p.quantity > 0 && (
                    <p className="mt-2 text-xs text-muted">
                      <span className="font-medium text-primary tabular">{money(each, currency)}</span> per worker per month
                      {note && <span> · {note}</span>}
                      <span> · {money(each * p.quantity, currency)} a month for {p.quantity}</span>
                    </p>
                  )}
                  {showCost && (
                    <CostEditor line={l} salary={salaryHints[l.trade.trim().toLowerCase()] ?? null} onCost={(v) => updateLine(l.id, { cost: v, costParts: [] })} onParts={(parts) => setParts(l.id, parts)} onSuggest={() => suggestCost(l)} profit={lp} />
                  )}
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-subtle">Prices can be per month, per day or per hour on each line{settings.units.length ? ", or in your own units" : ""}. Day and hour prices turn into a monthly figure using {settings.daysPerMonth} working days{` and ${settings.hoursPerDay} hours a day`}.</p>
          <button type="button" onClick={() => setLines((prev) => [...prev, blankLine()])} className="btn btn-secondary btn-sm mt-3">
            <Plus className="h-4 w-4" aria-hidden />
            Add line
          </button>
        </div>

        <div className="card grid grid-cols-1 gap-4 p-5 sm:grid-cols-3">
          <h2 className="text-sm font-semibold text-primary sm:col-span-3">Terms</h2>
          <Responsibility label="Accommodation" value={accommodation} onChange={setAccommodation} />
          <Responsibility label="Transport" value={transport} onChange={setTransport} />
          <Responsibility label="PPE" value={ppe} onChange={setPpe} />
          <label className="block sm:col-span-3">
            <span className="mb-1 block text-xs font-medium text-muted">Other terms</span>
            <textarea value={terms} onChange={(e) => setTerms(e.target.value)} rows={2} className="input w-full" />
          </label>
          <div className="sm:col-span-3">
            <h3 className="text-xs font-semibold tracking-wide text-muted uppercase">Wording around the table (this quotation only)</h3>
            <p className="mt-1 text-xs text-muted">Leave empty to use the cover text you pick when sending. Anything written here replaces it for this quotation. <code>{"{CLIENT}"}</code>, <code>{"{CONTACT}"}</code>, <code>{"{TOTAL}"}</code>, <code>{"{VALID_UNTIL}"}</code>, <code>{"{DATE}"}</code> and <code>{"{COMPANY}"}</code> are filled in.</p>
            <label className="mt-2 block"><span className="mb-1 block text-xs font-medium text-muted">Opening paragraph</span><textarea value={coverIntro} onChange={(e) => setCoverIntro(e.target.value)} rows={3} className="input w-full" maxLength={2000} /></label>
            <label className="mt-2 block"><span className="mb-1 block text-xs font-medium text-muted">Closing paragraph</span><textarea value={coverClosing} onChange={(e) => setCoverClosing(e.target.value)} rows={3} className="input w-full" maxLength={2000} /></label>
          </div>
        </div>
      </div>

      <aside className="space-y-5 lg:sticky lg:top-20 lg:self-start">
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-primary">Summary</h2>
          <dl className="mt-3 space-y-1.5 text-sm">
            <Row label="Billed per month" value={money(totals.subtotal, currency)} />
            {totals.rows.map((r, i) => (
              <div key={i} className="flex items-center justify-between gap-2">
                <dt className="text-muted">{r.label}</dt>
                <dd className="tabular flex items-center gap-1.5">
                  {r.amount < 0 ? "−" : ""}{money(Math.abs(r.amount), currency)}
                  <button type="button" aria-label={`Remove ${r.name}`} onClick={() => setAdjustments((prev) => prev.filter((_, j) => j !== r.index))} className="text-subtle hover:text-[var(--error)]"><X className="h-3.5 w-3.5" aria-hidden /></button>
                </dd>
              </div>
            ))}
            <div className="flex items-baseline justify-between border-t border-default pt-2 text-base font-semibold text-primary">
              <dt>Total a month</dt>
              <dd className="tabular">{money(totals.total, currency)}</dd>
            </div>
            {totals.contractSubtotal != null && <Row label="Contract (before extras)" value={money(totals.contractSubtotal, currency)} />}
          </dl>
          <AdjustmentAdder hasVat={hasVat} currency={currency} onAdd={addAdjustment} />
          <p className="mt-2 text-xs text-subtle">Nothing is added unless you add it. Taxes and charges are named by you.</p>
        </div>

        {showCost && (
          <div className="card p-5">
            <div className="flex items-baseline justify-between"><h2 className="text-sm font-semibold text-primary">Profit</h2><span className="text-xs text-subtle">private · not printed</span></div>
            {profit.counted === 0 ? (
              <p className="mt-2 text-sm text-muted">Enter a cost on a line to see the profit.</p>
            ) : (
              <>
                <p className={cn("tabular mt-2 text-2xl font-semibold", profit.perMonth < 0 ? "text-[var(--error)]" : "text-primary")}>{signed(profit.perMonth)} <span className="text-sm font-normal text-muted">{currency} a month{profit.pct != null ? ` · ${profit.pct.toFixed(0)}%` : ""}</span></p>
                {lines.some((l) => lineProfit(toPriced(l), settings)?.belowCost) && <p className="mt-1 text-xs font-medium text-[var(--error)]">At least one line is priced below its cost. You can still save it.</p>}
                {target != null && (() => {
                  const workers = priced.filter((l) => lineProfit(l, settings)).reduce((s, l) => s + l.quantity, 0);
                  const per = workers > 0 ? profit.perMonth / workers : 0;
                  return <p className="mt-1 text-xs text-muted">{Math.round(per)} per worker per month · your target {target} {per >= target ? "✓" : "— below it"}</p>;
                })()}
                {profit.skipped > 0 && <p className="mt-1 text-xs text-subtle">{profit.skipped} line{profit.skipped === 1 ? " has" : "s have"} no cost entered and {profit.skipped === 1 ? "isn't" : "aren't"} counted.</p>}
              </>
            )}
          </div>
        )}

        {isRevision && (
          <label className="card block p-5">
            <span className="mb-1 block text-sm font-semibold text-primary">Saving as version {(initial.version ?? 1) + 1}</span>
            <span className="mb-2 block text-xs text-muted">Version {initial.version} is kept. Say what changed (optional).</span>
            <input value={revisionNote} onChange={(e) => setRevisionNote(e.target.value)} placeholder="e.g. Client asked for lower mason rate" className="input w-full" />
          </label>
        )}

        {error && <p role="alert" className="rounded-lg border border-[var(--error-border)] bg-[var(--error-soft)] px-3 py-2 text-sm text-[var(--error)]">{error}</p>}
        <Button size="btn" className="w-full" type="button" onClick={submit} disabled={pending || !clientId} loading={pending}>
          {editing ? (isRevision ? `Save as version ${(initial.version ?? 1) + 1}` : "Save changes") : "Create quotation"}
        </Button>
      </aside>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
      {children}
    </label>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on} className={cn("rounded-full border px-3 py-1 text-xs font-semibold transition", on ? "border-[var(--brand-primary)] bg-brand-soft text-[var(--brand-primary)]" : "border-dashed border-strong text-[var(--brand-primary)] hover:bg-surface-hover")}>
      {on ? `${children} ✓` : `+ ${children}`}
    </button>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-muted">{label}</dt>
      <dd className="tabular text-primary">{value}</dd>
    </div>
  );
}

function LabeledNumber({ label, value, onChange, step = 1, placeholder }: { label: string; value: string; onChange: (v: string) => void; step?: number; placeholder?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-muted">{label}</span>
      <NumberInput value={value} onChange={(v) => onChange(String(v))} step={step} min={0} placeholder={placeholder} />
    </label>
  );
}

function Responsibility({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const known = (RESPONSIBILITY_OPTIONS as readonly string[]).includes(value);
  const options = [...RESPONSIBILITY_OPTIONS.map((o) => ({ value: o, label: o })), ...(value && !known ? [{ value, label: value }] : [])];
  return (
    <Field label={label}>
      <Select value={value} onChange={onChange} searchable={false} placeholder="Not set" options={options} />
    </Field>
  );
}

function CostEditor({ line, salary, onCost, onParts, onSuggest, profit }: { line: LineRow; salary: number | null; onCost: (v: string) => void; onParts: (p: CostPart[]) => void; onSuggest: () => void; profit: ReturnType<typeof lineProfit> }) {
  const [open, setOpen] = useState(line.costParts.length > 0);
  const parts = line.costParts;
  return (
    <div className="mt-3 rounded-lg bg-surface-subtle p-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs font-medium text-muted">Our cost per worker per month</span>
        <div className="w-36">
          <NumberInput value={line.cost} onChange={(v) => onCost(String(v))} min={0} disabled={parts.length > 0} placeholder={salary ? `~${Math.round(salary)} pay` : "Cost"} />
        </div>
        <button type="button" onClick={() => setOpen((o) => !o)} className="text-xs font-medium text-[var(--brand-primary)] hover:underline">{open ? "Hide breakdown" : "Break it down"}</button>
        {profit && (
          <span className={cn("tabular ml-auto text-xs font-semibold", profit.belowCost ? "text-[var(--error)]" : "text-[var(--success)]")}>
            {signed(profit.each)} per worker{profit.pct != null ? ` · ${profit.pct.toFixed(0)}%` : ""}{profit.belowCost ? " ⚠ below cost" : ""}
          </span>
        )}
      </div>
      {open && (
        <div className="mt-3 space-y-1.5">
          {parts.map((p, i) => (
            <div key={i} className="flex items-center gap-2">
              <input value={p.label} onChange={(e) => onParts(parts.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} className="input min-w-0 flex-1" placeholder="Cost item" />
              <div className="w-32"><NumberInput value={String(p.amount)} onChange={(v) => onParts(parts.map((x, j) => (j === i ? { ...x, amount: Number(v) || 0 } : x)))} min={0} /></div>
              {p.note && <span className="hidden text-xs text-subtle md:inline">{p.note}</span>}
              <button type="button" aria-label="Remove cost item" onClick={() => onParts(parts.filter((_, j) => j !== i))} className="text-subtle hover:text-[var(--error)]"><X className="h-4 w-4" aria-hidden /></button>
            </div>
          ))}
          <div className="flex flex-wrap gap-2 pt-1">
            <button type="button" onClick={() => onParts([...parts, { label: "", amount: 0 }])} className="btn btn-secondary btn-sm"><Plus className="h-3.5 w-3.5" aria-hidden />Add cost</button>
            <button type="button" onClick={onSuggest} className="btn btn-secondary btn-sm">Suggest from pay and terms</button>
          </div>
        </div>
      )}
    </div>
  );
}

function AdjustmentAdder({ hasVat, currency, onAdd }: { hasVat: boolean; currency: string; onAdd: (kind: Adjustment["kind"], name: string, mode: Adjustment["mode"], value: number) => void }) {
  const [form, setForm] = useState<null | { kind: Adjustment["kind"]; name: string; mode: Adjustment["mode"]; value: string }>(null);
  return (
    <div className="mt-3">
      <div className="flex flex-wrap gap-2">
        {!hasVat && <button type="button" onClick={() => onAdd("TAX", "VAT", "PERCENT", 5)} className="rounded-full border border-dashed border-strong px-3 py-1 text-xs font-semibold text-[var(--brand-primary)] hover:bg-surface-hover">+ VAT 5%</button>}
        <button type="button" onClick={() => setForm({ kind: "DISCOUNT", name: "Discount", mode: "PERCENT", value: "" })} className="rounded-full border border-dashed border-strong px-3 py-1 text-xs font-semibold text-[var(--brand-primary)] hover:bg-surface-hover">+ Discount</button>
        <button type="button" onClick={() => setForm({ kind: "TAX", name: "", mode: "PERCENT", value: "" })} className="rounded-full border border-dashed border-strong px-3 py-1 text-xs font-semibold text-[var(--brand-primary)] hover:bg-surface-hover">+ Tax</button>
        <button type="button" onClick={() => setForm({ kind: "CHARGE", name: "", mode: "FIXED", value: "" })} className="rounded-full border border-dashed border-strong px-3 py-1 text-xs font-semibold text-[var(--brand-primary)] hover:bg-surface-hover">+ Charge</button>
      </div>
      {form && (
        <div className="mt-3 space-y-2 rounded-lg border border-default p-3">
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={form.kind === "CHARGE" ? "Charge name, e.g. Mobilisation" : form.kind === "TAX" ? "Tax name, e.g. Service tax" : "Discount name"} className="input w-full" />
          <div className="flex items-center gap-2">
            <div className="w-28"><NumberInput value={form.value} onChange={(v) => setForm({ ...form, value: String(v) })} step={0.01} min={0} /></div>
            <div className="w-24"><Select value={form.mode} onChange={(v) => setForm({ ...form, mode: v as Adjustment["mode"] })} searchable={false} options={[{ value: "PERCENT", label: "%" }, { value: "FIXED", label: currency }]} /></div>
            <button type="button" className="btn btn-primary btn-sm ml-auto" disabled={!form.name.trim() || !(Number(form.value) >= 0) || form.value === ""} onClick={() => { onAdd(form.kind, form.name.trim(), form.mode, Number(form.value)); setForm(null); }}>Add</button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setForm(null)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

