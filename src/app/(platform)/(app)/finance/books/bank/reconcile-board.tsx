"use client";

import { useRef, useState, useTransition } from "react";
import { Check, FileSpreadsheet, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/Dialog";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import type { StatementParse } from "@/lib/books/bankStatement";
import type { Suggestion } from "@/lib/books/reconcile";
import { acceptMatchesAction, addEntryForStatementLineAction, clearUnmatchedStatementAction, importStatementAction, matchStatementLineAction, unmatchStatementLineAction } from "./actions";

export type LedgerRow = { entryId: string; date: string; number: string; narration: string; amount: number };
export type StatementRow = { id: string; date: string; description: string; reference?: string | null; amount: number; entry: LedgerRow | null };

const aed = (n: number) => n.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const day = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
const Amount = ({ n }: { n: number }) => <span className={`tabular ${n < 0 ? "text-error" : "text-success"}`}>{n < 0 ? "−" : "+"}{aed(Math.abs(n))}</span>;

export function ReconcileBoard({ accountId, accountName, canWrite, ledgerBalance, statementBalance, statementBalanceDate, statement, unmatchedLedger, suggestions, counterAccounts }: {
  accountId: string; accountName: string; canWrite: boolean; ledgerBalance: number; statementBalance: number | null; statementBalanceDate: string | null;
  statement: StatementRow[]; unmatchedLedger: LedgerRow[]; suggestions: Suggestion[]; counterAccounts: { id: string; label: string }[];
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [adding, setAdding] = useState<StatementRow | null>(null);
  const [counter, setCounter] = useState("");
  const [narration, setNarration] = useState("");
  const [showMatched, setShowMatched] = useState(false);

  const stmtById = new Map(statement.map((s) => [s.id, s]));
  const ledgerById = new Map(unmatchedLedger.map((l) => [l.entryId, l]));
  const suggested = new Set(suggestions.map((s) => s.statementId));
  const needsEntry = statement.filter((s) => !s.entry && !suggested.has(s.id));
  const matched = statement.filter((s) => s.entry);
  const unclearedBooks = unmatchedLedger.filter((l) => !suggestions.some((s) => s.entryId === l.entryId));
  const reconciled = statement.length > 0 && statement.every((s) => s.entry) && unmatchedLedger.length === 0;

  const run = (fn: () => Promise<{ error?: string }>, ok?: string) => start(async () => { const r = await fn(); setMsg(r.error ? { ok: false, text: r.error } : ok ? { ok: true, text: ok } : null); });

  async function upload(file: File) {
    setBusy(true); setMsg(null);
    try {
      const body = new FormData(); body.append("file", file);
      const res = await fetch("/api/books/parse?kind=statement", { method: "POST", body });
      const json = (await res.json()) as StatementParse;
      if (!res.ok || json.error) { setMsg({ ok: false, text: json.error ?? "Couldn't read that file." }); return; }
      const r = await importStatementAction(accountId, json.lines);
      setMsg(r.error ? { ok: false, text: r.error } : { ok: true, text: `Added ${r.added} transactions${r.duplicates ? `, ${r.duplicates} were already uploaded` : ""}${json.skipped ? `, ${json.skipped} rows skipped` : ""}.` });
    } catch { setMsg({ ok: false, text: "Couldn't read that file." }); } finally { setBusy(false); }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-[var(--radius-card)] border border-border bg-surface p-4"><p className="text-xs text-muted">Books say</p><p className="tabular mt-1 text-xl font-semibold text-primary">{aed(ledgerBalance)}</p></div>
        <div className="rounded-[var(--radius-card)] border border-border bg-surface p-4"><p className="text-xs text-muted">Bank says{statementBalanceDate ? ` (${day(statementBalanceDate)})` : ""}</p><p className="tabular mt-1 text-xl font-semibold text-primary">{statementBalance === null ? "—" : aed(statementBalance)}</p></div>
        <div className="rounded-[var(--radius-card)] border border-border bg-surface p-4"><p className="text-xs text-muted">Still to match</p><p className={`mt-1 text-xl font-semibold ${reconciled ? "text-success" : "text-primary"}`}>{reconciled ? "All matched" : `${statement.length - matched.length} bank · ${unmatchedLedger.length} books`}</p></div>
      </div>

      {canWrite && (
        <div className="flex flex-wrap items-center gap-2">
          <input ref={input} type="file" accept=".xlsx,.csv,text/csv" className="sr-only" aria-label="Choose a bank statement file" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ""; }} />
          <Button type="button" size="sm" disabled={busy} onClick={() => input.current?.click()}>{busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <FileSpreadsheet className="h-4 w-4" aria-hidden />}Upload statement</Button>
          <span className="text-xs text-muted">Excel or CSV from the online banking of {accountName}, with Date, Description and Withdrawal / Deposit columns.</span>
          {statement.some((s) => !s.entry) && <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => { if (confirm("Remove the statement lines that are not matched yet?")) run(() => clearUnmatchedStatementAction(accountId), "Removed."); }}>Clear unmatched lines</Button>}
        </div>
      )}
      {msg && <p role={msg.ok ? "status" : "alert"} className={`text-sm ${msg.ok ? "text-success" : "text-error"}`}>{msg.text}</p>}

      {statement.length === 0 && <p className="rounded-[var(--radius-card)] border border-dashed border-border p-8 text-center text-sm text-muted">Upload your bank statement to start. Lines in the bank and in the books with the same amount and date are paired for you.</p>}

      {suggestions.length > 0 && (
        <section className="overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface">
          <div className="flex items-center justify-between bg-[var(--surface-sunken)] px-4 py-2"><h2 className="text-sm font-semibold text-primary">Suggested matches ({suggestions.length})</h2>{canWrite && <Button type="button" size="sm" disabled={pending} onClick={() => run(async () => { const r = await acceptMatchesAction(suggestions.map((s) => ({ statementId: s.statementId, entryId: s.entryId }))); return r.error ? r : (setMsg({ ok: true, text: `Matched ${r.matched}.` }), {}); })}><Check className="h-4 w-4" aria-hidden />Accept all</Button>}</div>
          <ul className="divide-y divide-border text-sm">
            {suggestions.map((s) => {
              const a = stmtById.get(s.statementId)!, b = ledgerById.get(s.entryId)!;
              return (
                <li key={s.statementId} className="grid items-center gap-2 px-4 py-2 sm:grid-cols-[1fr_1fr_auto]">
                  <div><p className="truncate text-primary">{a.description}</p><p className="text-xs text-muted">{day(a.date)} · <Amount n={a.amount} /></p></div>
                  <div><p className="truncate text-secondary">{b.narration}</p><p className="text-xs text-muted">{day(b.date)} · {b.number}{s.confidence === "exact" ? " · same reference" : ""}</p></div>
                  {canWrite && <Button type="button" size="xs" variant="secondary" disabled={pending} onClick={() => run(() => matchStatementLineAction(s.statementId, s.entryId))}>Match</Button>}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {needsEntry.length > 0 && (
        <section className="overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface">
          <h2 className="bg-[var(--surface-sunken)] px-4 py-2 text-sm font-semibold text-primary">In the bank, not in the books ({needsEntry.length})</h2>
          <ul className="divide-y divide-border text-sm">
            {needsEntry.map((s) => {
              const options = unmatchedLedger.filter((l) => Math.round(l.amount * 100) === Math.round(s.amount * 100));
              return (
                <li key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-2">
                  <div className="min-w-0 flex-1"><p className="truncate text-primary">{s.description}</p><p className="text-xs text-muted">{day(s.date)}{s.reference ? ` · ${s.reference}` : ""}</p></div>
                  <Amount n={s.amount} />
                  {canWrite && (
                    <div className="flex items-center gap-2">
                      {options.length > 0 && <select aria-label={`Match ${s.description} to an entry`} defaultValue="" className="input h-8 w-44 text-xs" onChange={(e) => { if (e.target.value) run(() => matchStatementLineAction(s.id, e.target.value)); }}><option value="">Match to entry…</option>{options.map((o) => <option key={o.entryId} value={o.entryId}>{day(o.date)} · {o.narration.slice(0, 40)}</option>)}</select>}
                      <Button type="button" size="xs" variant="secondary" onClick={() => { setAdding(s); setCounter(""); setNarration(s.description); }}><Plus className="h-3.5 w-3.5" aria-hidden />Add to books</Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {unclearedBooks.length > 0 && statement.length > 0 && (
        <section className="overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface">
          <h2 className="bg-[var(--surface-sunken)] px-4 py-2 text-sm font-semibold text-primary">In the books, not on the statement ({unclearedBooks.length})</h2>
          <p className="px-4 pt-2 text-xs text-muted">Usually cheques not yet cashed or deposits still on their way. They clear when a later statement shows them.</p>
          <ul className="divide-y divide-border text-sm">
            {unclearedBooks.map((l) => <li key={l.entryId} className="flex items-center gap-3 px-4 py-2"><div className="min-w-0 flex-1"><p className="truncate text-primary">{l.narration}</p><p className="text-xs text-muted">{day(l.date)} · {l.number}</p></div><Amount n={l.amount} /></li>)}
          </ul>
        </section>
      )}

      {matched.length > 0 && (
        <section className="rounded-[var(--radius-card)] border border-border bg-surface">
          <button type="button" onClick={() => setShowMatched((v) => !v)} className="flex w-full items-center justify-between px-4 py-2 text-sm font-semibold text-primary" aria-expanded={showMatched}>Matched ({matched.length})<span className="text-xs font-normal text-muted">{showMatched ? "Hide" : "Show"}</span></button>
          {showMatched && (
            <ul className="divide-y divide-border border-t border-border text-sm">
              {matched.map((s) => <li key={s.id} className="flex items-center gap-3 px-4 py-2"><div className="min-w-0 flex-1"><p className="truncate text-primary">{s.description}</p><p className="truncate text-xs text-muted">{day(s.date)} → {s.entry?.number} {s.entry?.narration}</p></div><Amount n={s.amount} />{canWrite && <button type="button" onClick={() => run(() => unmatchStatementLineAction(s.id))} className="text-xs text-muted hover:text-error">Unmatch</button>}</li>)}
            </ul>
          )}
        </section>
      )}

      <Dialog open={!!adding} onOpenChange={(o) => !o && setAdding(null)}>
        <DialogContent title="Add to the books" description={adding ? `${day(adding.date)} · ${adding.amount < 0 ? "paid out" : "received"} ${aed(Math.abs(adding.amount))}` : undefined}>
          <div className="space-y-3">
            <label className="block text-sm font-medium text-primary">{adding && adding.amount < 0 ? "What was it spent on" : "Where did it come from"}
              <div className="mt-1"><Select value={counter} onChange={setCounter} options={counterAccounts.map((a) => ({ value: a.id, label: a.label }))} placeholder="Choose account" searchable searchPlaceholder="Search accounts" /></div>
            </label>
            <label className="block text-sm font-medium text-primary">Narration<Input className="mt-1" value={narration} onChange={(e) => setNarration(e.target.value)} /></label>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setAdding(null)}>Cancel</Button>
            <Button type="button" disabled={pending || !counter} onClick={() => adding && run(async () => { const r = await addEntryForStatementLineAction(adding.id, counter, narration); if (!r.error) setAdding(null); return r; })}>{pending ? "Saving…" : "Post and match"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
