"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { DatePicker } from "@/components/ui/DatePicker";
import type { Policy } from "@/lib/books/accruals";
import { METHOD_LABEL, type CustomRule, type RuleMethod } from "@/lib/books/customProvisions";
import { lockBooksAction, refreshPostingsAction, saveOpeningBalancesAction, saveProvisionRuleAction, saveProvisionSettingsAction } from "../actions";

const aed = (n: number) => n.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = (s: string) => Math.round((Number(s.replace(/,/g, "")) || 0) * 100) / 100;

type Row = { id: string; code: string; name: string; type: string; debit: number; credit: number };

/** Opening balances typed by hand: any difference goes to Opening balance equity so the books open balanced. */
export function OpeningBalancesEditor({ rows, canEdit, openingDate }: { rows: Row[]; canEdit: boolean; openingDate: string }) {
  const [vals, setVals] = useState(() => Object.fromEntries(rows.map((r) => [r.id, { debit: r.debit ? String(r.debit) : "", credit: r.credit ? String(r.credit) : "" }])));
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const set = (id: string, side: "debit" | "credit", v: string) => setVals((c) => ({ ...c, [id]: side === "debit" ? { debit: v, credit: v ? "" : (c[id]?.credit ?? "") } : { credit: v, debit: v ? "" : (c[id]?.debit ?? "") } }));
  const at = (id: string) => vals[id] ?? { debit: "", credit: "" };
  const debit = Object.values(vals).reduce((s, v) => s + num(v.debit), 0);
  const credit = Object.values(vals).reduce((s, v) => s + num(v.credit), 0);
  const diff = Math.round((debit - credit) * 100) / 100;
  return (
    <div className="space-y-3">
      <div className="max-h-96 overflow-auto rounded-[var(--radius-card)] border border-default">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-[var(--surface-sunken)] text-left text-xs text-muted"><tr><th className="px-3 py-2 font-medium">Account</th><th className="w-32 px-3 py-2 text-right font-medium">Debit</th><th className="w-32 px-3 py-2 text-right font-medium">Credit</th></tr></thead>
          <tbody className="divide-y divide-default">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-3 py-1.5"><span className="mr-2 font-mono text-xs text-muted">{r.code}</span>{r.name}</td>
                {(["debit", "credit"] as const).map((side) => (
                  <td key={side} className="px-3 py-1">
                    <input inputMode="decimal" disabled={!canEdit} aria-label={`${side} ${r.name}`} value={at(r.id)[side]} onChange={(e) => set(r.id, side, e.target.value)} className="input h-8 w-full text-right" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <span className="text-muted">Debit <span className="tabular font-medium text-primary">{aed(debit)}</span> · Credit <span className="tabular font-medium text-primary">{aed(credit)}</span>{diff !== 0 && <span className="ml-2 text-warning">{aed(Math.abs(diff))} difference goes to Opening balance equity</span>}</span>
        {canEdit && (
          <Button type="button" size="sm" disabled={pending} onClick={() => start(async () => {
            const r = await saveOpeningBalancesAction(rows.map((x) => ({ accountId: x.id, debit: num(at(x.id).debit), credit: num(at(x.id).credit) })));
            setMsg(r.error ? { ok: false, text: r.error } : { ok: true, text: `Saved as at ${openingDate}.` });
          })}>{pending ? "Saving…" : "Save opening balances"}</Button>
        )}
      </div>
      {msg && <p role={msg.ok ? "status" : "alert"} className={`text-sm ${msg.ok ? "text-success" : "text-error"}`}>{msg.text}</p>}
    </div>
  );
}

/** Closing a period: nothing on or before the date can be added, changed or voided. */
export function LockControl({ lockedUntil, minDate }: { lockedUntil: string | null; minDate: string }) {
  const [date, setDate] = useState(lockedUntil ?? "");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const run = (d: string | null) => start(async () => { const r = await lockBooksAction(d); setMsg(r.error ? { ok: false, text: r.error } : { ok: true, text: d ? `Locked up to ${d}.` : "Unlocked." }); });
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <DatePicker value={date} onChange={setDate} ariaLabel="Lock books up to" min={minDate} />
        <Button type="button" size="sm" disabled={pending || !date} onClick={() => run(date)}>Lock up to this date</Button>
        {lockedUntil && <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => { setDate(""); run(null); }}>Unlock</Button>}
      </div>
      {msg && <p role={msg.ok ? "status" : "alert"} className={`text-sm ${msg.ok ? "text-success" : "text-error"}`}>{msg.text}</p>}
    </div>
  );
}

/** The books refresh themselves when opened; this forces it and says what changed. */
export function RefreshControl() {
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-2">
      <Button type="button" size="sm" variant="secondary" disabled={pending} onClick={() => start(async () => {
        const r = await refreshPostingsAction();
        setMsg(r.error ? r.error : `${r.created} new, ${r.updated} updated, ${r.removed} removed.${r.unmapped?.length ? ` Not posted (no account): ${r.unmapped.join(", ")}.` : ""}`);
      })}>{pending ? "Posting…" : "Post everything now"}</Button>
      {msg && <p role="status" className="text-sm text-secondary">{msg}</p>}
    </div>
  );
}

type PolicyText = { daysFirst: string; daysAfter: string; firstYears: string; capMonths: string; startAfterMonths: string; basis: "basic" | "fixed"; leaveDays: string; leaveCap: string; ticketAmount: string; ticketEvery: string };
const toText = (p: Policy): PolicyText => ({ daysFirst: String(p.gratuity.daysFirst), daysAfter: String(p.gratuity.daysAfter), firstYears: String(p.gratuity.firstYears), capMonths: String(p.gratuity.capMonths), startAfterMonths: String(p.gratuity.startAfterMonths), basis: p.gratuity.basis, leaveDays: p.leave.defaultDays == null ? "" : String(p.leave.defaultDays), leaveCap: String(p.leave.capYears), ticketAmount: p.tickets.defaultAmount == null ? "" : String(p.tickets.defaultAmount), ticketEvery: p.tickets.defaultEveryMonths == null ? "" : String(p.tickets.defaultEveryMonths) });
const n = (v: string) => (v.trim() === "" ? null : Number(v));
const fromText = (t: PolicyText): Policy => ({
  gratuity: { daysFirst: n(t.daysFirst) ?? 21, daysAfter: n(t.daysAfter) ?? 30, firstYears: n(t.firstYears) ?? 5, capMonths: n(t.capMonths) ?? 24, startAfterMonths: n(t.startAfterMonths) ?? 0, basis: t.basis },
  leave: { defaultDays: n(t.leaveDays), capYears: n(t.leaveCap) ?? 1 },
  tickets: { defaultAmount: n(t.ticketAmount), defaultEveryMonths: n(t.ticketEvery) },
});

function Num({ label, value, onChange, disabled, suffix, placeholder }: { label: string; value: string; onChange: (v: string) => void; disabled: boolean; suffix?: string; placeholder?: string }) {
  return (
    <label className="block text-xs text-muted">{label}
      <span className="mt-1 flex items-center gap-1.5"><input inputMode="decimal" disabled={disabled} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className="input h-8 w-24 text-right text-sm" />{suffix && <span>{suffix}</span>}</span>
    </label>
  );
}

/** Month-end provisions: what is owed to staff later is charged to the month they earn it. Every rule here is the company's to set. */
export function ProvisionSettings({ initial, policy, canEdit }: { initial: { gratuity: boolean; leave: boolean; tickets: boolean }; policy: Policy; canEdit: boolean }) {
  const [on, setOn] = useState(initial);
  const [t, setT] = useState<PolicyText>(() => toText(policy));
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const set = (k: keyof PolicyText) => (v: string) => setT((c) => ({ ...c, [k]: v }));
  const Box = ({ k, title, note, children }: { k: "gratuity" | "leave" | "tickets"; title: string; note: string; children: React.ReactNode }) => (
    <li className="px-4 py-3">
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" className="mt-1" disabled={!canEdit} checked={on[k]} onChange={(e) => setOn((c) => ({ ...c, [k]: e.target.checked }))} />
        <span><span className="font-medium text-primary">{title}</span><span className="block text-xs text-muted">{note}</span></span>
      </label>
      {on[k] && <div className="ml-7 mt-3 flex flex-wrap items-end gap-4">{children}</div>}
    </li>
  );
  return (
    <div className="space-y-3">
      <ul className="divide-y divide-default rounded-[var(--radius-card)] border border-default">
        {Box({ k: "gratuity", title: "End-of-service gratuity", note: "Set aside from each person's first day, so it is never a surprise at settlement. Defaults follow UAE labour law.", children: (
          <>
            <Num label="Days of pay a year" value={t.daysFirst} onChange={set("daysFirst")} disabled={!canEdit} suffix="days" />
            <Num label="For the first" value={t.firstYears} onChange={set("firstYears")} disabled={!canEdit} suffix="years" />
            <Num label="Then" value={t.daysAfter} onChange={set("daysAfter")} disabled={!canEdit} suffix="days a year" />
            <Num label="Capped at" value={t.capMonths} onChange={set("capMonths")} disabled={!canEdit} suffix="months of pay" />
            <Num label="Start after" value={t.startAfterMonths} onChange={set("startAfterMonths")} disabled={!canEdit} suffix="months" />
            <label className="block text-xs text-muted">Worked out on
              <select disabled={!canEdit} value={t.basis} onChange={(e) => setT((c) => ({ ...c, basis: e.target.value as "basic" | "fixed" }))} className="input mt-1 h-8 w-44 text-sm"><option value="basic">Basic pay</option><option value="fixed">Basic + allowances</option></select>
            </label>
          </>
        ) })}
        {Box({ k: "leave", title: "Annual leave", note: "Uses each person's leave days; people without their own use the default below. Enter 0 on a person to exclude them.", children: (
          <>
            <Num label="Default paid leave" value={t.leaveDays} onChange={set("leaveDays")} disabled={!canEdit} suffix="days a year" placeholder="none" />
            <Num label="Builds up to" value={t.leaveCap} onChange={set("leaveCap")} disabled={!canEdit} suffix="years of leave" />
          </>
        ) })}
        {Box({ k: "tickets", title: "Air tickets", note: "Uses each person's ticket terms; people without their own use the default below. Enter 0 on a person to exclude them.", children: (
          <>
            <Num label="Default ticket" value={t.ticketAmount} onChange={set("ticketAmount")} disabled={!canEdit} suffix="AED" placeholder="none" />
            <Num label="Given every" value={t.ticketEvery} onChange={set("ticketEvery")} disabled={!canEdit} suffix="months" placeholder="none" />
          </>
        ) })}
      </ul>
      {canEdit && (
        <div className="flex items-center gap-3">
          <Button type="button" size="sm" disabled={pending} onClick={() => start(async () => {
            const r = await saveProvisionSettingsAction({ ...on, policy: fromText(t) });
            setMsg(r.error ? { ok: false, text: r.error } : { ok: true, text: "Saved. Months that aren't locked are recalculated." });
          })}>{pending ? "Saving…" : "Save"}</Button>
          {msg && <p role={msg.ok ? "status" : "alert"} className={`text-sm ${msg.ok ? "text-success" : "text-error"}`}>{msg.text}</p>}
        </div>
      )}
    </div>
  );
}

const APPLIES: Record<CustomRule["appliesTo"], string> = { ALL: "Everyone", SITE_STAFF: "Site staff", STAFF: "Office staff" };

function RuleRow({ rule, canEdit }: { rule: CustomRule | null; canEdit: boolean }) {
  const [name, setName] = useState(rule?.name ?? "");
  const [method, setMethod] = useState<RuleMethod>(rule?.method ?? "PER_PERSON");
  const [amount, setAmount] = useState(rule ? String(rule.amount) : "");
  const [every, setEvery] = useState(rule ? String(rule.everyMonths) : "12");
  const [applies, setApplies] = useState<CustomRule["appliesTo"]>(rule?.appliesTo ?? "ALL");
  const [active, setActive] = useState(rule?.active ?? true);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const save = (nextActive: boolean) => start(async () => {
    const r = await saveProvisionRuleAction({ id: rule?.id, name, method, amount: Number(amount.replace(/,/g, "")) || 0, everyMonths: Number(every) || 0, appliesTo: applies, active: nextActive });
    if (r.error) { setMsg({ ok: false, text: r.error }); return; }
    setActive(nextActive);
    setMsg({ ok: true, text: "Saved." });
    if (!rule) { setName(""); setAmount(""); }
  });
  return (
    <li className={`px-4 py-3 ${rule && !active ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-end gap-3">
        <label className="block text-xs text-muted">{rule ? "Name" : "New provision"}<input disabled={!canEdit} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Annual bonus" className="input mt-1 block h-8 w-44 text-sm" /></label>
        <label className="block text-xs text-muted">Worked out as
          <select disabled={!canEdit} value={method} onChange={(e) => setMethod(e.target.value as RuleMethod)} className="input mt-1 block h-8 w-56 text-sm">{(Object.keys(METHOD_LABEL) as RuleMethod[]).map((k) => <option key={k} value={k}>{METHOD_LABEL[k]}</option>)}</select>
        </label>
        <label className="block text-xs text-muted">Amount<input disabled={!canEdit} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="input mt-1 block h-8 w-24 text-right text-sm" /></label>
        <label className="block text-xs text-muted">Every (months)<input disabled={!canEdit} inputMode="numeric" value={every} onChange={(e) => setEvery(e.target.value)} className="input mt-1 block h-8 w-20 text-right text-sm" /></label>
        {method !== "COMPANY" && (
          <label className="block text-xs text-muted">For
            <select disabled={!canEdit} value={applies} onChange={(e) => setApplies(e.target.value as CustomRule["appliesTo"])} className="input mt-1 block h-8 w-36 text-sm">{(Object.keys(APPLIES) as CustomRule["appliesTo"][]).map((k) => <option key={k} value={k}>{APPLIES[k]}</option>)}</select>
          </label>
        )}
        {canEdit && (
          <div className="flex gap-2">
            <Button type="button" size="sm" disabled={pending} onClick={() => save(rule ? active : true)}>{pending ? "Saving…" : rule ? "Save" : "Add"}</Button>
            {rule && <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => save(!active)}>{active ? "Switch off" : "Switch on"}</Button>}
          </div>
        )}
      </div>
      {msg && <p role={msg.ok ? "status" : "alert"} className={`mt-2 text-xs ${msg.ok ? "text-success" : "text-error"}`}>{msg.text}</p>}
    </li>
  );
}

/** The company's own provisions, on top of gratuity, leave and tickets. */
export function CustomProvisions({ rules, canEdit }: { rules: CustomRule[]; canEdit: boolean }) {
  return (
    <div className="space-y-2">
      <ul className="divide-y divide-default rounded-[var(--radius-card)] border border-default">
        {rules.map((r) => <RuleRow key={`${r.id}:${r.name}:${r.amount}:${r.everyMonths}:${r.method}:${r.appliesTo}:${r.active}`} rule={r} canEdit={canEdit} />)}
        {canEdit && <RuleRow key="new" rule={null} canEdit />}
      </ul>
      <p className="text-xs text-muted">Each builds up month by month across its cycle and starts again after it. When you pay it out, record the payment against its provision account and the books keep the balance right.</p>
    </div>
  );
}
