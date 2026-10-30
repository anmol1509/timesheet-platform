"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { FileSpreadsheet, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { ACCOUNT_TYPES, TYPE_LABEL } from "@/lib/books/chart";
import { guessType, matchAccount, type ChartAccount, type TbParse, type TbRow } from "@/lib/books/importTb";
import { importOpeningBalancesAction } from "../actions";
import { Alert } from "@/components/Alert";

const aed = (n: number) => n.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const SOURCES = [
  { k: "tally", l: "Tally", how: "In Tally: Gateway → Display More Reports → Trial Balance, set the date you start on, then Export (Ctrl+E) → Excel." },
  { k: "zoho", l: "Zoho Books", how: "In Zoho Books: Reports → Accountant → Trial Balance, pick the start date, then Export → XLSX or CSV." },
  { k: "qb", l: "QuickBooks", how: "In QuickBooks: Reports → Accountant → Trial Balance, pick the date, then Export to Excel." },
  { k: "excel", l: "Excel / other", how: "A sheet with a name column and Debit and Credit columns (or one Balance column marked Dr / Cr) works." },
];
type Choice = string; // an account id, or "new:<TYPE>"

/** Trial balance from another system → mapped onto our chart → tied out → saved as opening balances. */
export function ImportWizard({ chart, openingDate }: { chart: ChartAccount[]; openingDate: string }) {
  const [source, setSource] = useState("tally");
  const [parsed, setParsed] = useState<TbParse | null>(null);
  const [choices, setChoices] = useState<Choice[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [saving, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  async function load(file: File) {
    setBusy(true); setError(null); setDone(null);
    try {
      const body = new FormData(); body.append("file", file);
      const res = await fetch("/api/books/parse", { method: "POST", body });
      const json = (await res.json()) as TbParse & { error?: string };
      if (!res.ok || json.error) { setParsed(null); setError(json.error ?? "Couldn't read that file."); return; }
      setParsed(json);
      setChoices(json.rows.map((r) => matchAccount(r, chart)?.id ?? `new:${guessType(r)}`));
    } catch { setError("Couldn't read that file."); } finally { setBusy(false); }
  }

  const options = useMemo(() => [
    ...ACCOUNT_TYPES.map((t) => ({ value: `new:${t}`, label: `New ${TYPE_LABEL[t].toLowerCase()} account` })),
    ...chart.map((a) => ({ value: a.id, label: `${a.code} · ${a.name}` })),
  ], [chart]);

  const rows: TbRow[] = parsed?.rows ?? [];
  const debit = rows.reduce((s, r) => s + r.debit, 0);
  const credit = rows.reduce((s, r) => s + r.credit, 0);
  const diff = Math.round((debit - credit) * 100) / 100;
  const matched = choices.filter((c) => !c.startsWith("new:")).length;
  const tied = parsed?.sourceDebit != null && Math.abs(parsed.sourceDebit - debit) < 0.005 && (parsed.sourceCredit == null || Math.abs(parsed.sourceCredit - credit) < 0.005);

  function apply() {
    start(async () => {
      const r = await importOpeningBalancesAction(rows.map((row, i) => {
        const c = choices[i];
        return c.startsWith("new:") ? { newName: row.name, newCode: row.code, newType: c.slice(4), debit: row.debit, credit: row.credit } : { accountId: c, debit: row.debit, credit: row.credit };
      }));
      if (r.error) { setError(r.error); return; }
      setError(null);
      setDone(`Imported ${rows.length} balances as at ${openingDate}${r.created ? `, ${r.created} new accounts created` : ""}.${r.plug ? ` ${aed(Math.abs(r.plug))} difference parked in Opening balance equity.` : " Debits equal credits."}`);
      setParsed(null);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Where are you coming from">
        {SOURCES.map((s) => <button key={s.k} type="button" onClick={() => setSource(s.k)} className={`rounded-full border px-3 py-1 text-xs font-medium ${source === s.k ? "border-brand bg-brand-soft text-brand" : "border-default text-secondary hover:bg-surface-hover"}`}>{s.l}</button>)}
      </div>
      <p className="text-sm text-muted">{SOURCES.find((s) => s.k === source)!.how} Export it as of <span className="font-medium text-primary">{openingDate}</span>, the day your books start here.</p>
      <input ref={input} type="file" accept=".xlsx,.csv,text/csv" className="sr-only" aria-label="Choose a trial balance file" onChange={(e) => { const f = e.target.files?.[0]; if (f) void load(f); e.target.value = ""; }} />
      <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={() => input.current?.click()}>{busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <FileSpreadsheet className="h-4 w-4" aria-hidden />}Upload trial balance</Button>
      {error && <Alert>{error}</Alert>}
      {done && <p role="status" className="text-sm text-success">{done}</p>}

      {parsed && rows.length > 0 && (
        <div className="space-y-3">
          <div className="max-h-[28rem] overflow-auto rounded-[var(--radius-card)] border border-default">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-[var(--surface-sunken)] text-left text-xs text-muted"><tr><th className="px-3 py-2 font-medium">In your file</th><th className="px-3 py-2 font-medium">Goes to</th><th className="px-3 py-2 text-right font-medium">Debit</th><th className="px-3 py-2 text-right font-medium">Credit</th></tr></thead>
              <tbody className="divide-y divide-default">
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td className="px-3 py-1.5">{r.name}</td>
                    <td className="w-72 px-3 py-1"><Select value={choices[i]} onChange={(v) => setChoices((c) => c.map((x, j) => (j === i ? v : x)))} options={options} searchable searchPlaceholder="Search accounts" /></td>
                    <td className="tabular px-3 py-1.5 text-right">{r.debit ? aed(r.debit) : ""}</td>
                    <td className="tabular px-3 py-1.5 text-right">{r.credit ? aed(r.credit) : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <dl className="grid gap-2 rounded-[var(--radius-card)] bg-[var(--surface-sunken)] p-3 text-sm sm:grid-cols-3">
            <div><dt className="text-xs text-muted">Read from file</dt><dd className="tabular font-medium text-primary">Dr {aed(debit)} · Cr {aed(credit)}</dd></div>
            <div><dt className="text-xs text-muted">Matches the file total</dt><dd className={`font-medium ${parsed.sourceDebit == null ? "text-muted" : tied ? "text-success" : "text-error"}`}>{parsed.sourceDebit == null ? "No total row found" : tied ? `Yes, ${aed(parsed.sourceDebit)}` : `No: file says Dr ${aed(parsed.sourceDebit)}`}</dd></div>
            <div><dt className="text-xs text-muted">Mapped</dt><dd className="font-medium text-primary">{matched} to existing, {rows.length - matched} new accounts</dd></div>
          </dl>
          {diff !== 0 && <p className="text-sm text-warning">Debits and credits differ by {aed(Math.abs(diff))}. That would be parked in Opening balance equity, so check the export is complete before importing.</p>}
          <Button type="button" disabled={saving} onClick={apply} loading={saving}>{`Import ${rows.length} balances`}</Button>
          <p className="text-xs text-muted">This replaces any opening balances you saved before. Later months follow from invoices, bills, payments and vouchers here; your old transactions are not needed.</p>
        </div>
      )}
    </div>
  );
}
